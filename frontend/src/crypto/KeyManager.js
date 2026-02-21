/**
 * KeyManager — Generates, stores, and manages E2E encryption keys.
 * Handles key bundle upload/download for X3DH protocol.
 */

import cryptoStore from './CryptoStore';
import {
  generateECDHKeyPair, generateSigningKeyPair,
  exportKeyPair, importKeyPair,
  exportPublicKey, ecdsaSign,
} from './utils';

const NUM_OTK = 20;

class KeyManager {
  constructor() {
    this._initialized = false;
    this.identityKeyPair = null;   // ECDH key pair
    this.signingKeyPair = null;    // ECDSA key pair
    this.signedPreKeyPair = null;  // ECDH key pair
  }

  /** Initialize — load or generate keys, register with server. */
  async initialize(token) {
    if (this._initialized) return;
    await cryptoStore.open();

    const stored = await cryptoStore.getIdentityKeyPair();
    if (stored) {
      this.identityKeyPair = await importKeyPair(stored.ecdhKeyPair);
      this.signingKeyPair = await importKeyPair(stored.signingKeyPair, 'ECDSA');
      const spk = await cryptoStore.getSignedPreKey();
      if (spk) this.signedPreKeyPair = await importKeyPair(spk.keyPair);

      // Verify server has our current identity key — re-upload if missing or stale
      await this._ensureBundleOnServer(token);
    } else {
      await this._generateAndRegister(token);
    }

    this._initialized = true;
    await this._replenishIfNeeded(token);
  }

  async _generateAndRegister(token) {
    // Identity key pairs
    this.identityKeyPair = await generateECDHKeyPair();
    this.signingKeyPair = await generateSigningKeyPair();
    await cryptoStore.saveIdentityKeyPair({
      ecdhKeyPair: await exportKeyPair(this.identityKeyPair),
      signingKeyPair: await exportKeyPair(this.signingKeyPair),
    });

    // Signed Pre Key
    this.signedPreKeyPair = await generateECDHKeyPair();
    const spkPub = await exportPublicKey(this.signedPreKeyPair.publicKey);
    const spkSig = await ecdsaSign(this.signingKeyPair.privateKey, spkPub);
    await cryptoStore.saveSignedPreKey({
      keyPair: await exportKeyPair(this.signedPreKeyPair),
      signature: spkSig,
    });

    // One-Time Pre Keys
    const otks = [];
    for (let i = 0; i < NUM_OTK; i++) {
      const kp = await generateECDHKeyPair();
      const exported = await exportKeyPair(kp);
      await cryptoStore.saveOneTimePreKey(i, { keyPair: exported });
      otks.push({ id: i, publicKey: exported.publicKey });
    }

    // Upload bundle to server
    const ikPub = await exportPublicKey(this.identityKeyPair.publicKey);
    const sigPub = await exportPublicKey(this.signingKeyPair.publicKey);
    await this._uploadBundle(token, {
      identityKey: ikPub,
      signingKey: sigPub,
      signedPreKey: spkPub,
      signedPreKeySignature: spkSig,
      oneTimePreKeys: otks,
    });
  }

  /**
   * Ensure the server has our current identity key bundle.
   * After DB wipe, multi-device login, or server migration, the server's
   * copy may be missing or stale — causing security code mismatch.
   * The server endpoint is idempotent (upsert), so re-uploading is safe.
   *
   * Fixes applied:
   *   1. Regenerates signedPreKey if missing (instead of silently skipping)
   *   2. Retries upload up to 3 times with backoff
   *   3. Verifies server key after upload to detect desync
   *   4. Detects multi-device conflict (server has different key)
   */
  async _ensureBundleOnServer(token) {
    try {
      if (!this.identityKeyPair || !this.signingKeyPair) return;

      // FIX #2: If signedPreKey is missing, regenerate it instead of skipping
      if (!this.signedPreKeyPair) {
        console.warn('[KeyManager] SignedPreKey missing from IndexedDB, regenerating...');
        this.signedPreKeyPair = await generateECDHKeyPair();
        const spkPub = await exportPublicKey(this.signedPreKeyPair.publicKey);
        const spkSig = await ecdsaSign(this.signingKeyPair.privateKey, spkPub);
        await cryptoStore.saveSignedPreKey({
          keyPair: await exportKeyPair(this.signedPreKeyPair),
          signature: spkSig,
        });
      }

      const ikPub = await exportPublicKey(this.identityKeyPair.publicKey);
      const sigPub = await exportPublicKey(this.signingKeyPair.publicKey);
      const spkPub = await exportPublicKey(this.signedPreKeyPair.publicKey);
      const spk = await cryptoStore.getSignedPreKey();
      const spkSig = spk?.signature || await ecdsaSign(this.signingKeyPair.privateKey, spkPub);

      // FIX #6: Check what server currently has to detect multi-device conflict
      const serverIK = await this._fetchMyIdentityKey(token);
      if (serverIK === ikPub) {
        this._syncFailed = false;
        console.log('[KeyManager] Server identity key matches local — no sync needed');
        return;
      }
      if (serverIK && serverIK !== ikPub) {
        console.warn('[KeyManager] ⚠ Server has DIFFERENT identity key!',
          'Multi-device conflict detected. Re-uploading current device key...');
      }

      // Gather existing OTKs from IndexedDB
      const existingOTKs = await cryptoStore.getAll('oneTimePreKeys');
      const otks = existingOTKs.map(k => ({ id: k.id, publicKey: k.keyPair.publicKey }));

      // FIX #3: Upload with retry (3 attempts with backoff)
      await this._uploadBundleWithRetry(token, {
        identityKey: ikPub,
        signingKey: sigPub,
        signedPreKey: spkPub,
        signedPreKeySignature: spkSig,
        oneTimePreKeys: otks,
      });

      // FIX #1: Verify server actually stored our key
      const verifiedIK = await this._fetchMyIdentityKey(token);
      if (verifiedIK && verifiedIK !== ikPub) {
        console.error('[KeyManager] CRITICAL: Server key does not match after upload!',
          { local: ikPub?.slice(0, 20), server: verifiedIK?.slice(0, 20) });
        this._syncFailed = true;
      } else {
        this._syncFailed = false;
        console.log('[KeyManager] Bundle synced and verified with server ✓');
      }
    } catch (e) {
      console.error('[KeyManager] Bundle sync failed:', e);
      this._syncFailed = true;
    }
  }

  /** Fetch our own identity key from the server (for verification). */
  async _fetchMyIdentityKey(token) {
    try {
      const res = await fetch('/api/keys/identity/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.identityKey || null;
    } catch { return null; }
  }

  /** Upload bundle with retry and exponential backoff. */
  async _uploadBundleWithRetry(token, bundle, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this._uploadBundle(token, bundle);
        return; // Success
      } catch (e) {
        if (attempt === maxRetries) {
          throw new Error(`Upload failed after ${maxRetries} attempts: ${e.message}`);
        }
        const delay = attempt * 1000; // 1s, 2s, 3s
        console.warn(`[KeyManager] Upload attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  async _uploadBundle(token, bundle) {
    const res = await fetch('/api/keys/bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(bundle),
    });
    if (!res.ok) throw new Error('Failed to upload key bundle');
  }

  /** Check if the last sync with server failed. */
  get syncFailed() { return !!this._syncFailed; }

  /** Force re-sync bundle with server. */
  async syncWithServer(token) {
    await this._ensureBundleOnServer(token);
  }

  /** Fetch peer's key bundle for X3DH. */
  async fetchBundle(token, username) {
    const res = await fetch(`/api/keys/bundle/${username}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  /** Check if a peer has E2E keys. */
  async hasPeerBundle(token, username) {
    try {
      const res = await fetch(`/api/keys/has-bundle/${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.hasBundle;
    } catch { return false; }
  }

  async _replenishIfNeeded(token) {
    try {
      const res = await fetch('/api/keys/count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { count } = await res.json();
      if (count < 5) await this._replenish(token);
    } catch (e) {
      console.warn('OTK replenish check failed:', e);
    }
  }

  async _replenish(token) {
    const existing = await cryptoStore.getAll('oneTimePreKeys');
    const maxId = existing.reduce((m, k) => Math.max(m, k.id), -1);
    const newKeys = [];
    for (let i = 0; i < NUM_OTK; i++) {
      const keyId = maxId + 1 + i;
      const kp = await generateECDHKeyPair();
      const exported = await exportKeyPair(kp);
      await cryptoStore.saveOneTimePreKey(keyId, { keyPair: exported });
      newKeys.push({ id: keyId, publicKey: exported.publicKey });
    }
    await fetch('/api/keys/replenish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ oneTimePreKeys: newKeys }),
    });
  }

  /** Get our identity public key (base64). */
  async getIdentityPublicKey() {
    if (!this.identityKeyPair) return null;
    return exportPublicKey(this.identityKeyPair.publicKey);
  }

  /** Load a one-time pre-key pair by ID (and delete it — one-time use). */
  async consumeOneTimePreKey(keyId) {
    const stored = await cryptoStore.getOneTimePreKey(keyId);
    if (!stored) return null;
    const kp = await importKeyPair(stored.keyPair);
    await cryptoStore.removeOneTimePreKey(keyId);
    return kp;
  }

  /** Reset all keys (re-generate and re-register). */
  async reset(token) {
    await cryptoStore.clearAll();
    this._initialized = false;
    this.identityKeyPair = null;
    this.signingKeyPair = null;
    this.signedPreKeyPair = null;
    await this.initialize(token);
  }
}

export default new KeyManager();
