/**
 * ConferenceCrypto — STUB (encryption disabled).
 * Original implementation archived in ./_archived/ConferenceCrypto.js
 */

export function supportsInsertableStreams() {
  return false; // Disable media frame encryption
}

export class ConferenceCrypto {
  async generateKey() { return null; }
  getKeyBase64() { return null; }
  async setDecryptKey(_peerId, _key) {}
  removeDecryptKey(_peerId) {}
  setupSenderEncryption(_sender) {}
  setupReceiverDecryption(_peerId, _receiver) {}
  async rotateKey() { return null; }
  destroy() {}
}
