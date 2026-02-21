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
   */
  async _ensureBundleOnServer(token) {
    try {
      if (!this.identityKeyPair || !this.signingKeyPair || !this.signedPreKeyPair) return;

      const ikPub = await exportPublicKey(this.identityKeyPair.publicKey);
      const sigPub = await exportPublicKey(this.signingKeyPair.publicKey);
      const spkPub = await exportPublicKey(this.signedPreKeyPair.publicKey);
      const spk = await cryptoStore.getSignedPreKey();
      const spkSig = spk?.signature || await ecdsaSign(this.signingKeyPair.privateKey, spkPub);

      // Gather existing OTKs from IndexedDB
      const existingOTKs = await cryptoStore.getAll('oneTimePreKeys');
      const otks = existingOTKs.map(k => ({ id: k.id, publicKey: k.keyPair.publicKey }));

      await this._uploadBundle(token, {
        identityKey: ikPub,
        signingKey: sigPub,
        signedPreKey: spkPub,
        signedPreKeySignature: spkSig,
        oneTimePreKeys: otks,
      });
      console.log('[KeyManager] Bundle synced with server');
    } catch (e) {
      console.warn('[KeyManager] Bundle sync failed (will retry on next init):', e);
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
