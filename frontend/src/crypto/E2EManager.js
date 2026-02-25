/**
 * E2EManager — STUB (encryption disabled).
 * Original implementation archived in ./_archived/E2EManager.js
 *
 * All methods are no-ops that return safe defaults.
 * Messages, calls, and conferences work in plaintext mode.
 */

class E2EManager {
  constructor() {
    this._initialized = false;
  }

  async initialize(_token) {
    this._initialized = true;
    console.log('[E2E] Encryption module disabled (stub)');
  }

  isReady() {
    return false; // Always report not ready — disables all encrypt/decrypt paths
  }

  async peerHasE2E(_token, _peer) {
    return false;
  }

  async encrypt(_peer, plaintext, _token, _fileData) {
    // No-op: return plaintext as-is (never called when isReady() === false)
    return { encrypted: false, content: plaintext };
  }

  async decrypt(_peer, msg) {
    return { text: msg.content || '' };
  }

  async encryptFile(file) {
    return { encryptedBlob: file, fileKey: null };
  }

  async decryptFile(buffer, _key, mimeType) {
    return new Blob([buffer], { type: mimeType || 'application/octet-stream' });
  }

  async getSecurityCode(_peer, _token) {
    return null;
  }

  async verifyIdentity(_peer, _key) {
    return false;
  }

  async hasSession(_peer) {
    return false;
  }

  async resetSession(_peer) {}
  async resetAll(_token) {}
}

export default new E2EManager();
