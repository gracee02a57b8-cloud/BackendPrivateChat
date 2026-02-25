/**
 * GroupCrypto — STUB (encryption disabled).
 * Original implementation archived in ./_archived/GroupCrypto.js
 */

class GroupCrypto {
  async generateGroupKey(_roomId) { return null; }
  async getGroupKey(_roomId) { return null; }
  async hasGroupKey(_roomId) { return false; }
  async encrypt(_roomId, plaintext) {
    return { encrypted: false, content: plaintext };
  }
  async decrypt(_roomId, _encContent, _iv) {
    return { text: '' };
  }
  async receiveKey(_sender, _roomId, _msg) {}
  async distributeKey(_ws, _roomId, _members, _username, _token) {}
}

export default new GroupCrypto();
