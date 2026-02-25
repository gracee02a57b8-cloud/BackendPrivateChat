/**
 * CallCrypto — STUB (encryption disabled).
 * Original implementation archived in ./_archived/CallCrypto.js
 */

export function supportsInsertableStreams() {
  return false; // Disable media frame encryption
}

export class CallCrypto {
  async generateKey() { return null; }
  async setDecryptKey(_key) {}
  setupSenderEncryption(_sender) {}
  setupReceiverDecryption(_receiver) {}
  disableEncryption() {}
  destroy() {}
}
