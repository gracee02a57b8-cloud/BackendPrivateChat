/**
 * KeyManager — STUB (encryption disabled).
 * Original implementation archived in ./_archived/KeyManager.js
 */
class KeyManager {
  constructor() {
    this.identityKeyPair = null;
    this.signedPreKeyPair = null;
  }
  async initialize(_token) {}
  async getIdentityPublicKey() { return null; }
  async hasPeerBundle(_token, _peer) { return false; }
  async fetchBundle(_token, _peer) { return null; }
  async consumeOneTimePreKey(_id) { return null; }
  async syncWithServer(_token) {}
  async reset(_token) {}
}
export default new KeyManager();
