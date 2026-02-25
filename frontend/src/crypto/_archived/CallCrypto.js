/**
 * CallCrypto — E2E media frame encryption/decryption for WebRTC calls.
 *
 * Uses AES-128-GCM with per-frame random IV via the Insertable Streams API
 * (RTCRtpSender/Receiver.createEncodedStreams).
 *
 * Flow:
 *   1. Each party generates a random AES-128 key per call
 *   2. Keys are exchanged via E2E-encrypted signaling (mediaKey in CALL_OFFER/ANSWER)
 *   3. Outgoing frames are encrypted with own key, incoming with peer's key
 *   4. IV (12 bytes) is prepended to each encrypted frame
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

export class CallCrypto {
  constructor() {
    this._encryptKey = null;   // CryptoKey for encrypting outgoing frames
    this._decryptKey = null;   // CryptoKey for decrypting incoming frames
    this._keyBase64 = null;    // Our key in base64 for sharing with peer
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
   * Import peer's key for decrypting incoming media frames.
   * @param {string} base64Key - Peer's media key received via signaling
   */
  async setDecryptKey(base64Key) {
    if (!base64Key) return;
    const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    this._decryptKey = await crypto.subtle.importKey(
      'raw', raw, { name: 'AES-GCM' }, false, ['decrypt']
    );
  }

  /**
   * Apply encryption transform to an RTCRtpSender's encoded streams.
   * Must be called immediately after addTrack, before frames start flowing.
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
          controller.enqueue(frame); // pass through on error
        }
      },
    });
    readable.pipeThrough(transform).pipeTo(writable);
  }

  /**
   * Apply decryption transform to an RTCRtpReceiver's encoded streams.
   * Typically called from pc.ontrack handler.
   */
  setupReceiverDecryption(receiver) {
    if (!receiver.createEncodedStreams) return;
    const { readable, writable } = receiver.createEncodedStreams();
    const self = this;
    const transform = new TransformStream({
      async transform(frame, controller) {
        if (!self._decryptKey) { controller.enqueue(frame); return; }
        try {
          const data = new Uint8Array(frame.data);
          if (data.byteLength <= IV_LENGTH) { controller.enqueue(frame); return; }
          const iv = data.slice(0, IV_LENGTH);
          const ciphertext = data.slice(IV_LENGTH);
          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            self._decryptKey,
            ciphertext
          );
          frame.data = decrypted;
          controller.enqueue(frame);
        } catch {
          controller.enqueue(frame); // pass through on error (transition period)
        }
      },
    });
    readable.pipeThrough(transform).pipeTo(writable);
  }

  /** Disable encryption (peer doesn't support E2E media) */
  disableEncryption() {
    this._encryptKey = null;
  }

  /** Cleanup */
  destroy() {
    this._encryptKey = null;
    this._decryptKey = null;
    this._keyBase64 = null;
  }
}
