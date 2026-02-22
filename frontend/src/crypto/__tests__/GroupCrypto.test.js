/**
 * @vitest-environment jsdom
 *
 * Tests for GroupCrypto — AES-256-GCM shared key encryption for group chats.
 * Covers: key generation, storage, encrypt/decrypt round-trip,
 * JSON payloads (fileKey, thumbnailKey), error paths, distributeKey, receiveKey.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock CryptoStore
const mockStore = {};
vi.mock('../CryptoStore', () => ({
  default: {
    saveGroupKey: vi.fn(async (roomId, key) => { mockStore[roomId] = key; }),
    getGroupKey: vi.fn(async (roomId) => mockStore[roomId] || null),
    deleteGroupKey: vi.fn(async (roomId) => { delete mockStore[roomId]; }),
  },
}));

// Mock E2EManager
vi.mock('../E2EManager', () => ({
  default: {
    peerHasE2E: vi.fn(async () => true),
    encrypt: vi.fn(async (peer, plaintext) => ({
      encryptedContent: `enc:${plaintext}`,
      iv: 'mock-iv',
      ratchetKey: 'mock-rk',
      messageNumber: 1,
    })),
    decrypt: vi.fn(async (sender, msg) => ({ text: msg.encryptedContent.replace('enc:', '') })),
  },
}));

// We need the real utils for crypto operations
const { arrayBufferToBase64, base64ToUint8 } = await import('../utils');

// Import after mocks are set up
const { default: groupCrypto } = await import('../GroupCrypto');
const { default: e2eManager } = await import('../E2EManager');
const { default: cryptoStore } = await import('../CryptoStore');

// ======================== Test Suite ========================

beforeEach(() => {
  // Clear mock store
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  vi.clearAllMocks();
});

// ======================== generateGroupKey ========================

describe('GroupCrypto — generateGroupKey', () => {
  it('returns a base64 string of 32 bytes', async () => {
    const key = await groupCrypto.generateGroupKey('room-1');
    expect(typeof key).toBe('string');
    // 32 bytes → 44 chars in base64
    const decoded = base64ToUint8(key);
    expect(decoded.length).toBe(32);
  });

  it('stores the key in CryptoStore', async () => {
    const key = await groupCrypto.generateGroupKey('room-2');
    expect(cryptoStore.saveGroupKey).toHaveBeenCalledWith('room-2', key);
    expect(mockStore['room-2']).toBe(key);
  });

  it('generates unique keys per call', async () => {
    const k1 = await groupCrypto.generateGroupKey('room-a');
    const k2 = await groupCrypto.generateGroupKey('room-b');
    expect(k1).not.toBe(k2);
  });
});

// ======================== getGroupKey / hasGroupKey ========================

describe('GroupCrypto — getGroupKey / hasGroupKey', () => {
  it('returns null for unknown room', async () => {
    const key = await groupCrypto.getGroupKey('nonexistent');
    expect(key).toBeNull();
  });

  it('returns key after generation', async () => {
    const original = await groupCrypto.generateGroupKey('room-x');
    const retrieved = await groupCrypto.getGroupKey('room-x');
    expect(retrieved).toBe(original);
  });

  it('hasGroupKey returns false for unknown room', async () => {
    expect(await groupCrypto.hasGroupKey('no-such-room')).toBe(false);
  });

  it('hasGroupKey returns true after key generation', async () => {
    await groupCrypto.generateGroupKey('room-y');
    expect(await groupCrypto.hasGroupKey('room-y')).toBe(true);
  });
});

// ======================== encrypt / decrypt round-trip ========================

describe('GroupCrypto — encrypt / decrypt', () => {
  it('plain text round-trip', async () => {
    const roomId = 'room-e2e-1';
    await groupCrypto.generateGroupKey(roomId);

    const payload = 'Привет, группа!';
    const encrypted = await groupCrypto.encrypt(roomId, payload);

    expect(encrypted.encrypted).toBe(true);
    expect(encrypted.groupEncrypted).toBe(true);
    expect(typeof encrypted.encryptedContent).toBe('string');
    expect(typeof encrypted.iv).toBe('string');

    const decrypted = await groupCrypto.decrypt(roomId, encrypted.encryptedContent, encrypted.iv);
    expect(decrypted.text).toBe(payload);
  });

  it('JSON payload with fileKey survives round-trip', async () => {
    const roomId = 'room-e2e-2';
    await groupCrypto.generateGroupKey(roomId);

    const payload = JSON.stringify({ text: 'file.pdf', fileKey: 'abc123' });
    const encrypted = await groupCrypto.encrypt(roomId, payload);
    const decrypted = await groupCrypto.decrypt(roomId, encrypted.encryptedContent, encrypted.iv);
    expect(decrypted.text).toBe('file.pdf');
    expect(decrypted.fileKey).toBe('abc123');
  });

  it('JSON payload with fileKey + thumbnailKey survives round-trip', async () => {
    const roomId = 'room-e2e-3';
    await groupCrypto.generateGroupKey(roomId);

    const payload = JSON.stringify({ text: 'photo.jpg', fileKey: 'fk1', thumbnailKey: 'tk1' });
    const encrypted = await groupCrypto.encrypt(roomId, payload);
    const decrypted = await groupCrypto.decrypt(roomId, encrypted.encryptedContent, encrypted.iv);
    expect(decrypted.text).toBe('photo.jpg');
    expect(decrypted.fileKey).toBe('fk1');
    expect(decrypted.thumbnailKey).toBe('tk1');
  });

  it('encrypt throws when no group key exists', async () => {
    await expect(groupCrypto.encrypt('no-key-room', 'hello')).rejects.toThrow('No group key');
  });

  it('decrypt throws when no group key exists', async () => {
    await expect(groupCrypto.decrypt('no-key-room', 'abc', 'def')).rejects.toThrow('No group key');
  });

  it('empty string round-trip', async () => {
    const roomId = 'room-empty';
    await groupCrypto.generateGroupKey(roomId);

    const encrypted = await groupCrypto.encrypt(roomId, '');
    const decrypted = await groupCrypto.decrypt(roomId, encrypted.encryptedContent, encrypted.iv);
    expect(decrypted.text).toBe('');
  });

  it('unicode / emoji round-trip', async () => {
    const roomId = 'room-emoji';
    await groupCrypto.generateGroupKey(roomId);

    const payload = '🔐 Зашифрованное сообщение 🇷🇺';
    const encrypted = await groupCrypto.encrypt(roomId, payload);
    const decrypted = await groupCrypto.decrypt(roomId, encrypted.encryptedContent, encrypted.iv);
    expect(decrypted.text).toBe(payload);
  });

  it('different rooms have independent keys', async () => {
    await groupCrypto.generateGroupKey('room-A');
    await groupCrypto.generateGroupKey('room-B');

    const encrypted = await groupCrypto.encrypt('room-A', 'secret A');

    // Decrypting with room-B's key should fail
    await expect(
      groupCrypto.decrypt('room-B', encrypted.encryptedContent, encrypted.iv),
    ).rejects.toThrow();
  });
});

// ======================== distributeKey ========================

describe('GroupCrypto — distributeKey', () => {
  it('sends GROUP_KEY to each member except self', async () => {
    const roomId = 'room-dist';
    await groupCrypto.generateGroupKey(roomId);

    const messages = [];
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: vi.fn((data) => messages.push(JSON.parse(data))),
    };

    await groupCrypto.distributeKey(mockWs, roomId, ['alice', 'bob', 'carol'], 'alice', 'token');

    // Should send to bob and carol, not alice
    expect(mockWs.send).toHaveBeenCalledTimes(2);
    expect(messages[0].type).toBe('GROUP_KEY');
    expect(messages[0].extra.target).toBe('bob');
    expect(messages[0].extra.roomId).toBe(roomId);
    expect(messages[1].extra.target).toBe('carol');
  });

  it('skips distribution when WebSocket is closed', async () => {
    const roomId = 'room-closed';
    await groupCrypto.generateGroupKey(roomId);

    const mockWs = { readyState: WebSocket.CLOSED, send: vi.fn() };
    await groupCrypto.distributeKey(mockWs, roomId, ['alice', 'bob'], 'alice', 'token');
    expect(mockWs.send).not.toHaveBeenCalled();
  });

  it('skips distribution when no group key', async () => {
    const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
    await groupCrypto.distributeKey(mockWs, 'no-key', ['alice', 'bob'], 'alice', 'token');
    expect(mockWs.send).not.toHaveBeenCalled();
  });

  it('skips members without E2E', async () => {
    const roomId = 'room-partial';
    await groupCrypto.generateGroupKey(roomId);

    e2eManager.peerHasE2E.mockImplementation(async (token, peer) => peer === 'bob');

    const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
    await groupCrypto.distributeKey(mockWs, roomId, ['alice', 'bob', 'carol'], 'alice', 'token');

    // Only bob has E2E
    expect(mockWs.send).toHaveBeenCalledTimes(1);
  });
});

// ======================== receiveKey ========================

describe('GroupCrypto — receiveKey', () => {
  it('decrypts and stores received group key', async () => {
    const msg = { encryptedContent: 'enc:group-key-data', iv: 'mock-iv' };
    const result = await groupCrypto.receiveKey('bob', 'room-rx', msg);
    expect(result).toBe(true);
    expect(cryptoStore.saveGroupKey).toHaveBeenCalledWith('room-rx', 'group-key-data');
  });

  it('returns false when decryption fails', async () => {
    e2eManager.decrypt.mockRejectedValueOnce(new Error('decrypt failed'));
    const result = await groupCrypto.receiveKey('evil', 'room-bad', { encryptedContent: 'xxx' });
    expect(result).toBe(false);
  });

  it('returns false when decrypted text is empty', async () => {
    e2eManager.decrypt.mockResolvedValueOnce({ text: '' });
    const result = await groupCrypto.receiveKey('peer', 'room-empty', { encryptedContent: 'enc:' });
    expect(result).toBe(false);
  });
});
