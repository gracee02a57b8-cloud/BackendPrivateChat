/**
 * E2EManager — High-level E2E encryption manager.
 * Orchestrates KeyManager, X3DH, and Double Ratchet for seamless
 * message encryption/decryption in private chats.
 *
 * Usage:
 *   await e2eManager.initialize(token);
 *   const encrypted = await e2eManager.encrypt(peerUsername, plaintext, token);
 *   const plaintext = await e2eManager.decrypt(peerUsername, encryptedMsg);
 */

import keyManager from './KeyManager';
import { x3dhInitiator, x3dhResponder } from './X3DH';
import {
  initSender, initReceiver,
  ratchetEncrypt, ratchetDecrypt,
  saveSession, loadSession, deleteSession,
} from './DoubleRatchet';
import cryptoStore from './CryptoStore';
import { exportPublicKey, generateSecurityCode, aesEncryptBuffer, aesDecryptBuffer, arrayBufferToBase64, base64ToUint8 } from './utils';

class E2EManager {
  constructor() {
    this._initialized = false;
    this._sessionLocks = new Map(); // Prevent concurrent session modifications
    this._initPromise = null; // Track ongoing initialization
    this._processedInitials = new Set(); // Track processed X3DH ephemeral keys (prevent re-processing)
  }

  /** Initialize E2E — generate/load keys, register with server. */
  async initialize(token) {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInitialize(token);
    return this._initPromise;
  }

  async _doInitialize(token) {
    try {
      await keyManager.initialize(token);
      this._initialized = true;
      // Clean old skipped keys
      await cryptoStore.cleanExpiredSkippedKeys();
      console.log('[E2E] Initialized successfully');
    } catch (e) {
      console.error('[E2E] Initialization failed:', e);
    } finally {
      this._initPromise = null;
    }
  }

  /**
   * Wait for E2E initialization to complete (with timeout).
   * Used by decrypt() to avoid failing on messages that arrive before init finishes.
   */
  async _waitForInit(timeoutMs = 10000) {
    // If initialization is in progress, wait for it
    if (this._initPromise) {
      try { await this._initPromise; } catch { /* handled in _doInitialize */ }
    }
    if (this._initialized) return;
    // Fallback: poll-wait in case init was triggered elsewhere
    const start = Date.now();
    while (!this._initialized && Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  /** Check if E2E is available (keys generated). */
  isReady() {
    return this._initialized && keyManager.identityKeyPair != null;
  }

  /** Check if peer supports E2E. */
  async peerHasE2E(token, peerUsername) {
    return keyManager.hasPeerBundle(token, peerUsername);
  }

  // ======================== Encrypt ========================

  /**
   * Encrypt a message for a peer.
   * Establishes X3DH session if needed, then uses Double Ratchet.
   *
   * @param {string} peerUsername
   * @param {string} plaintext - Message content
   * @param {string} token - JWT token
   * @param {Object} [fileData] - Optional: { fileKey, ... } for file encryption
   * @returns {Object} Encrypted message fields to merge into MessageDto
   */
  async encrypt(peerUsername, plaintext, token, fileData) {
    if (!this.isReady()) throw new Error('E2E not initialized');

    await this._acquireLock(peerUsername);
    try {
      let session = await loadSession(peerUsername);
      let initialMessage = false;
      let ephemeralKey = null;
      let senderIdentityKey = null;
      let oneTimeKeyId = null;

      // Establish session if none exists
      if (!session) {
        const bundle = await keyManager.fetchBundle(token, peerUsername);
        if (!bundle) throw new Error(`No E2E bundle for ${peerUsername}`);

        const x3dhResult = await x3dhInitiator(keyManager.identityKeyPair, bundle);

        // Save peer's identity key as trusted
        await cryptoStore.saveTrustedKey(peerUsername, bundle.identityKey);

        session = await initSender(x3dhResult.sharedKey, x3dhResult.peerSignedPreKey);
        initialMessage = true;
        ephemeralKey = x3dhResult.ephemeralPublicKey;
        senderIdentityKey = await keyManager.getIdentityPublicKey();
        oneTimeKeyId = x3dhResult.usedOneTimeKeyId;
      }

      // Encrypt payload
      const payload = fileData
        ? JSON.stringify({ text: plaintext || '', ...fileData })
        : plaintext || '';

      const { header, ciphertext, iv, state } = await ratchetEncrypt(session, payload);
      await saveSession(peerUsername, state);

      const result = {
        encrypted: true,
        encryptedContent: ciphertext,
        iv: iv,
        ratchetKey: header.dh,
        messageNumber: header.n,
        previousChainLength: header.pn,
      };

      // Include X3DH info in initial message
      if (initialMessage) {
        result.ephemeralKey = ephemeralKey;
        result.senderIdentityKey = senderIdentityKey;
        result.oneTimeKeyId = oneTimeKeyId;
      }

      return result;
    } finally {
      this._releaseLock(peerUsername);
    }
  }

  // ======================== Decrypt ========================

  /**
   * Decrypt a received encrypted message.
   * Performs X3DH responder if this is an initial message.
   *
   * @param {string} peerUsername - Sender's username
   * @param {Object} msg - Message with encryption fields
   * @returns {Object} { text, fileKey? } decrypted payload
   */
  async decrypt(peerUsername, msg) {
    // Wait for initialization if it's still in progress (fixes race condition
    // where encrypted messages arrive via WebSocket before E2E init completes)
    if (!this.isReady()) {
      await this._waitForInit();
    }
    if (!this.isReady()) throw new Error('E2E not initialized');
    if (!msg.encrypted) return { text: msg.content };

    // FIX #1: Check plaintext cache first — prevents session corruption when
    // the same message is processed twice (history reload, WS reconnect, etc.)
    if (msg.id) {
      try {
        const cached = await cryptoStore.getDecryptedContent(msg.id);
        if (cached) {
          const result = { text: cached.content };
          if (cached.fileKey) result.fileKey = cached.fileKey;
          if (cached.thumbnailKey) result.thumbnailKey = cached.thumbnailKey;
          return result;
        }
      } catch { /* cache miss — proceed to decrypt */ }
    }

    await this._acquireLock(peerUsername);
    try {
      let session = await loadSession(peerUsername);

      // X3DH responder side — initial message from peer (or session reset)
      if (msg.ephemeralKey && msg.senderIdentityKey) {
        const ephFingerprint = msg.ephemeralKey;

        // FIX #1b: Check if we already processed THIS exact initial message
        // (prevents session corruption from duplicate X3DH processing —
        // the OTK is consumed on first use, so re-processing would compute
        // a different shared secret and permanently break the session)
        const alreadyProcessed =
          this._processedInitials.has(ephFingerprint) ||
          (session && session._lastEphemeralKey === ephFingerprint);

        if (alreadyProcessed && session) {
          console.log(`[E2E] Skipping duplicate X3DH initial from ${peerUsername}`);
        } else {
          // Genuinely new initial message — reset session and run X3DH
          if (session) {
            console.warn(`[E2E] New initial message from ${peerUsername} — resetting session`);
            await deleteSession(peerUsername);
          }
          session = await this._handleInitialMessage(peerUsername, msg);
          // Track this initial message to prevent future re-processing
          session._lastEphemeralKey = ephFingerprint;
          this._processedInitials.add(ephFingerprint);
        }
      }

      if (!session) {
        throw new Error(`No E2E session with ${peerUsername} and not an initial message`);
      }

      const header = {
        dh: msg.ratchetKey,
        pn: msg.previousChainLength || 0,
        n: msg.messageNumber || 0,
      };

      const { plaintext, state } = await ratchetDecrypt(session, header, msg.encryptedContent, msg.iv);
      // Preserve tracking data across ratchet state updates
      if (session._lastEphemeralKey) state._lastEphemeralKey = session._lastEphemeralKey;
      await saveSession(peerUsername, state);

      // Parse payload (may contain fileKey for file encryption)
      try {
        const parsed = JSON.parse(plaintext);
        if (parsed.text !== undefined) return parsed;
      } catch {
        // Plain text, not JSON
      }
      return { text: plaintext };
    } catch (e) {
      console.error(`[E2E] Decrypt failed for ${peerUsername}:`, e);
      return { text: null, error: e.message };
    } finally {
      this._releaseLock(peerUsername);
    }
  }

  /** Handle initial X3DH message as responder. */
  async _handleInitialMessage(peerUsername, msg) {
    const identityKP = keyManager.identityKeyPair;
    const signedPreKP = keyManager.signedPreKeyPair;
    if (!identityKP || !signedPreKP) throw new Error('Missing local keys');

    let otkPair = null;
    if (msg.oneTimeKeyId != null) {
      otkPair = await keyManager.consumeOneTimePreKey(msg.oneTimeKeyId);
    }

    const { sharedKey } = await x3dhResponder(
      identityKP, signedPreKP, otkPair,
      msg.senderIdentityKey, msg.ephemeralKey
    );

    // Save peer's identity key as trusted
    await cryptoStore.saveTrustedKey(peerUsername, msg.senderIdentityKey);

    return initReceiver(sharedKey, signedPreKP);
  }

  // ======================== File Encryption ========================

  /**
   * Encrypt a file before upload.
   * @returns {{ encryptedBlob, fileKey }} fileKey is base64, include in message payload.
   */
  async encryptFile(file) {
    const buffer = await file.arrayBuffer();
    const fileKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const { ciphertext, iv } = await aesEncryptBuffer(buffer, fileKeyBytes);

    // Prepend IV (12 bytes) to ciphertext for self-contained decryption
    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);

    const encryptedBlob = new Blob([combined], { type: 'application/octet-stream' });
    const fileKey = arrayBufferToBase64(fileKeyBytes);
    return { encryptedBlob, fileKey };
  }

  /**
   * Decrypt a downloaded file.
   * @param {ArrayBuffer} encryptedBuffer - Downloaded file (IV prepended).
   * @param {string} fileKeyB64 - File encryption key from decrypted message.
   * @param {string} mimeType - Original MIME type.
   * @returns {Blob}
   */
  async decryptFile(encryptedBuffer, fileKeyB64, mimeType) {
    const data = new Uint8Array(encryptedBuffer);
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    const keyBytes = base64ToUint8(fileKeyB64);
    const plainBuffer = await aesDecryptBuffer(ciphertext, iv, keyBytes);
    return new Blob([plainBuffer], { type: mimeType || 'application/octet-stream' });
  }

  // ======================== Security Code ========================

  /**
   * Generate safety number for identity verification between two users.
   *
   * Fixes applied:
   *   - Verifies OUR identity key matches server (detects multi-device conflict)
   *   - Re-syncs our key if mismatch detected
   *   - Warns when using stale cached peer key (server unreachable)
   */
  async getSecurityCode(peerUsername, token) {
    const myIK = await keyManager.getIdentityPublicKey();
    if (!myIK) return null;

    // FIX: Verify OUR key matches what server has (detect multi-device overwrite)
    try {
      const myRes = await fetch('/api/keys/identity/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (myRes.ok) {
        const myData = await myRes.json();
        if (myData.identityKey && myData.identityKey !== myIK) {
          console.warn('[E2E] ⚠ My identity key on server differs from local!',
            'Attempting re-sync before generating security code...');
          try { await keyManager.syncWithServer(token); } catch { /* best effort */ }
        }
      }
    } catch { /* server unreachable — proceed with local key */ }

    // Always fetch peer's CURRENT identity key from server for accurate code
    let peerIK = null;
    let peerIKFromServer = false;
    try {
      const res = await fetch(`/api/keys/identity/${encodeURIComponent(peerUsername)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        peerIK = data.identityKey;
        peerIKFromServer = true;
        // Update trusted key store if changed
        if (peerIK) {
          const trusted = await cryptoStore.getTrustedKey(peerUsername);
          if (!trusted || trusted.identityKey !== peerIK) {
            await cryptoStore.saveTrustedKey(peerUsername, peerIK);
          }
        }
      }
    } catch {
      // Will try fallback to cached key below
    }

    if (!peerIK) {
      const trusted = await cryptoStore.getTrustedKey(peerUsername);
      if (!trusted) return null;
      peerIK = trusted.identityKey;
      // FIX: Warn that we're using potentially stale cached key
      console.warn('[E2E] ⚠ Using CACHED identity key for', peerUsername,
        '(server unreachable). Security code may be inaccurate.');
    }

    return generateSecurityCode(myIK, peerIK);
  }

  /** Check if peer's identity key has changed (possible MITM). */
  async verifyIdentity(peerUsername, expectedIdentityKey) {
    const trusted = await cryptoStore.getTrustedKey(peerUsername);
    if (!trusted) return false;
    return trusted.identityKey === expectedIdentityKey;
  }

  // ======================== Session Management ========================

  async hasSession(peerUsername) {
    return (await loadSession(peerUsername)) != null;
  }

  async resetSession(peerUsername) {
    await deleteSession(peerUsername);
  }

  async resetAll(token) {
    await keyManager.reset(token);
  }

  // ======================== Lock Management ========================

  async _acquireLock(peer) {
    while (this._sessionLocks.get(peer)) {
      await new Promise((r) => setTimeout(r, 10));
    }
    this._sessionLocks.set(peer, true);
  }

  _releaseLock(peer) {
    this._sessionLocks.delete(peer);
  }
}

export default new E2EManager();
