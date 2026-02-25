/**
 * CryptoStore — STUB (encryption disabled).
 * Original implementation archived in ./_archived/CryptoStore.js
 */

class CryptoStore {
  async getDecryptedContent(_id) { return null; }
  async saveDecryptedContent(_id, _content, _fk, _tk) {}
  async getSentContent(_id) { return null; }
  async saveSentContent(_id, _content, _fk, _tk) {}
  async getAll(_store) { return []; }
  async delete(_store, _id) {}
  async cleanExpiredSkippedKeys() {}
  async saveTrustedKey(_peer, _key) {}
  async getTrustedKey(_peer) { return null; }
  async saveGroupKey(_roomId, _key) {}
  async getGroupKey(_roomId) { return null; }
}

export default new CryptoStore();
