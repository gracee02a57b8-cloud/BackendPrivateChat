/**
 * ConferenceCrypto — E2E media frame encryption for group conference calls.
 *
 * Extends the 1:1 CallCrypto concept to N peers:
 *   - One AES-128-GCM key for encrypting OUR outgoing frames
 *   - Map<peerId, CryptoKey> for decrypting each peer's incoming frames
 *   - Key rotation on participant leave (forward secrecy)
 *
 * Uses Insertable Streams (RTCRtpSender/Receiver.createEncodedStreams).
 */

const IV_LENGTH = 12;

/**
 * Check if the browser supports Insertable Streams for E2E media encryption.
 */
export function supportsInsertableStreams() {
  return typeof window !== 'undefined'
    && typeof RTCRtpSender !== 'undefined'
    && typeof RTCRtpSender.prototype.createEncodedStreams === 'function';
}

export class ConferenceCrypto {
  constructor() {
    this._encryptKey = null;     // CryptoKey for encrypting outgoing frames
    this._decryptKeys = new Map(); // Map<peerId, CryptoKey> for decrypting incoming frames
    this._keyBase64 = null;      // Our key in base64 for sharing with peers
  }

  /**
   * Generate a random AES-128-GCM key for outgoing media frames.
   * @returns {string} base64-encoded key for transmission via signaling
   */
  async generateKey() {
    const raw = crypto.getRandomValues(new Uint8Array(16));
    this._encryptKey = await crypto.subtle.importKey(
      'raw', raw, { name: 'AES-GCM' }, false, ['encrypt']
    );
    this._keyBase64 = btoa(String.fromCharCode(...raw));
    return this._keyBase64;
  }

  /**
   * Get our media key as base64 for sharing with peers.
   */
  getKeyBase64() {
    return this._keyBase64;
  }

  /**
   * Import a peer's key for decrypting their incoming media frames.
   * @param {string} peerId - The peer's username
   * @param {string} base64Key - Peer's media key received via signaling
   */
  async setDecryptKey(peerId, base64Key) {
    if (!base64Key) return;
    const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw', raw, { name: 'AES-GCM' }, false, ['decrypt']
    );
    this._decryptKeys.set(peerId, key);
  }

  /**
   * Remove a peer's decrypt key (on leave).
   */
  removeDecryptKey(peerId) {
    this._decryptKeys.delete(peerId);
  }

  /**
   * Apply encryption transform to an RTCRtpSender's encoded streams.
   */
  setupSenderEncryption(sender) {
    if (!sender.createEncodedStreams) return;
    const { readable, writable } = sender.createEncodedStreams();
    const self = this;
    const transform = new TransformStream({
      async transform(frame, controller) {
        if (!self._encryptKey) { controller.enqueue(frame); return; }
        try {
          const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            self._encryptKey,
            frame.data
          );
          const combined = new ArrayBuffer(IV_LENGTH + encrypted.byteLength);
          new Uint8Array(combined).set(iv, 0);
          new Uint8Array(combined).set(new Uint8Array(encrypted), IV_LENGTH);
          frame.data = combined;
          controller.enqueue(frame);
        } catch {
          controller.enqueue(frame);
        }
      },
    });
    readable.pipeThrough(transform).pipeTo(writable);
  }

  /**
   * Apply decryption transform to an RTCRtpReceiver's encoded streams.
   * Uses the peerId to look up the correct decrypt key.
   */
  setupReceiverDecryption(receiver, peerId) {
    if (!receiver.createEncodedStreams) return;
    const { readable, writable } = receiver.createEncodedStreams();
    const self = this;
    const transform = new TransformStream({
      async transform(frame, controller) {
        const key = self._decryptKeys.get(peerId);
        if (!key) { controller.enqueue(frame); return; }
        try {
          const data = new Uint8Array(frame.data);
          if (data.length <= IV_LENGTH) { controller.enqueue(frame); return; }
          const iv = data.slice(0, IV_LENGTH);
          const ciphertext = data.slice(IV_LENGTH);
          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
          );
          frame.data = decrypted;
          controller.enqueue(frame);
        } catch {
          controller.enqueue(frame);
        }
      },
    });
    readable.pipeThrough(transform).pipeTo(writable);
  }

  /**
   * Destroy all keys.
   */
  destroy() {
    this._encryptKey = null;
    this._decryptKeys.clear();
    this._keyBase64 = null;
  }
}
