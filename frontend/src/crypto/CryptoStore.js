/**
 * CryptoStore — IndexedDB wrapper for E2E encryption key storage.
 * Stores identity keys, pre-keys, ratchet sessions, trusted keys.
 */

const DB_NAME = 'barsik-e2e';
const DB_VERSION = 3;

class CryptoStore {
  constructor() {
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('identityKeys')) {
          db.createObjectStore('identityKeys', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('signedPreKeys')) {
          db.createObjectStore('signedPreKeys', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('oneTimePreKeys')) {
          db.createObjectStore('oneTimePreKeys', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('trustedKeys')) {
          db.createObjectStore('trustedKeys', { keyPath: 'username' });
        }
        if (!db.objectStoreNames.contains('skippedKeys')) {
          const store = db.createObjectStore('skippedKeys', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
        // V2: local cache of own sent encrypted message content + fileKeys
        if (!db.objectStoreNames.contains('sentMessages')) {
          db.createObjectStore('sentMessages', { keyPath: 'id' });
        }
        // V3: group room E2E encryption keys
        if (!db.objectStoreNames.contains('groupKeys')) {
          db.createObjectStore('groupKeys', { keyPath: 'roomId' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async _tx(storeName, mode = 'readonly') {
    const db = await this.open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  async get(storeName, key) {
    const store = await this._tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    const store = await this._tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    const store = await this._tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    const store = await this._tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    const store = await this._tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // === Convenience methods ===

  getIdentityKeyPair()       { return this.get('identityKeys', 'local'); }
  saveIdentityKeyPair(data)  { return this.put('identityKeys', { id: 'local', ...data }); }

  getSignedPreKey()          { return this.get('signedPreKeys', 'current'); }
  saveSignedPreKey(data)     { return this.put('signedPreKeys', { id: 'current', ...data }); }

  getOneTimePreKey(keyId)    { return this.get('oneTimePreKeys', keyId); }
  saveOneTimePreKey(keyId, data) { return this.put('oneTimePreKeys', { id: keyId, ...data }); }
  removeOneTimePreKey(keyId) { return this.delete('oneTimePreKeys', keyId); }

  getSession(peer)           { return this.get('sessions', peer); }
  saveSession(peer, state)   { return this.put('sessions', { id: peer, ...state }); }
  deleteSession(peer)        { return this.delete('sessions', peer); }

  getTrustedKey(username)    { return this.get('trustedKeys', username); }
  saveTrustedKey(username, identityKey) {
    return this.put('trustedKeys', { username, identityKey, trustedAt: Date.now() });
  }

  saveSkippedKey(dhPub, msgNum, messageKey) {
    const id = `${dhPub}:${msgNum}`;
    return this.put('skippedKeys', { id, dhPub, msgNum, messageKey, createdAt: Date.now() });
  }

  getSkippedKey(dhPub, msgNum) {
    return this.get('skippedKeys', `${dhPub}:${msgNum}`);
  }

  removeSkippedKey(dhPub, msgNum) {
    return this.delete('skippedKeys', `${dhPub}:${msgNum}`);
  }

  async cleanExpiredSkippedKeys() {
    const all = await this.getAll('skippedKeys');
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const key of all) {
      if (key.createdAt < cutoff) {
        await this.delete('skippedKeys', key.id);
      }
    }
  }

  // === Sent Messages local cache (for own encrypted messages) ===
  saveSentContent(msgId, content, fileKey, thumbnailKey) {
    return this.put('sentMessages', { id: msgId, content, fileKey, thumbnailKey, savedAt: Date.now() });
  }

  getSentContent(msgId) {
    return this.get('sentMessages', msgId);
  }

  async cleanOldSentMessages() {
    const all = await this.getAll('sentMessages');
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
    for (const m of all) {
      if (m.savedAt < cutoff) await this.delete('sentMessages', m.id);
    }
  }

  // === Group E2E keys ===
  async saveGroupKey(roomId, key) {
    return this.put('groupKeys', { roomId, key, updatedAt: Date.now() });
  }

  async getGroupKey(roomId) {
    const record = await this.get('groupKeys', roomId);
    return record ? record.key : null;
  }

  async deleteGroupKey(roomId) {
    return this.delete('groupKeys', roomId);
  }

  async clearAll() {
    for (const store of ['identityKeys', 'signedPreKeys', 'oneTimePreKeys', 'sessions', 'trustedKeys', 'skippedKeys', 'sentMessages', 'groupKeys']) {
      await this.clear(store);
    }
  }
}

export default new CryptoStore();
