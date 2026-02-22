/**
 * @vitest-environment jsdom
 *
 * Tests for CryptoStore v3 — new sentMessages + groupKeys stores.
 * Covers: sentMessages CRUD + TTL cleanup, groupKeys CRUD,
 * clearAll includes new stores.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import cryptoStore from '../CryptoStore';

beforeAll(async () => {
  await cryptoStore.open();
});

beforeEach(async () => {
  await cryptoStore.clearAll();
});

// ======================== sentMessages ========================

describe('CryptoStore — sentMessages', () => {
  it('saveSentContent + getSentContent round-trip', async () => {
    await cryptoStore.saveSentContent('msg-1', 'Hello, world!', 'fk-1', 'tk-1');
    const result = await cryptoStore.getSentContent('msg-1');

    expect(result).not.toBeNull();
    expect(result.id).toBe('msg-1');
    expect(result.content).toBe('Hello, world!');
    expect(result.fileKey).toBe('fk-1');
    expect(result.thumbnailKey).toBe('tk-1');
    expect(typeof result.savedAt).toBe('number');
  });

  it('getSentContent returns null for unknown msgId', async () => {
    const result = await cryptoStore.getSentContent('nonexistent');
    expect(result).toBeNull();
  });

  it('saveSentContent overwrites existing entry', async () => {
    await cryptoStore.saveSentContent('msg-2', 'original', null, null);
    await cryptoStore.saveSentContent('msg-2', 'updated', 'fk-new', null);
    const result = await cryptoStore.getSentContent('msg-2');
    expect(result.content).toBe('updated');
    expect(result.fileKey).toBe('fk-new');
  });

  it('saveSentContent without file keys', async () => {
    await cryptoStore.saveSentContent('msg-3', 'text only', null, null);
    const result = await cryptoStore.getSentContent('msg-3');
    expect(result.content).toBe('text only');
    expect(result.fileKey).toBeNull();
    expect(result.thumbnailKey).toBeNull();
  });

  it('cleanOldSentMessages removes entries older than 30 days', async () => {
    const oldTime = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await cryptoStore.put('sentMessages', {
      id: 'old-msg',
      content: 'old',
      fileKey: null,
      thumbnailKey: null,
      savedAt: oldTime,
    });

    await cryptoStore.saveSentContent('new-msg', 'new', null, null);

    await cryptoStore.cleanOldSentMessages();

    expect(await cryptoStore.getSentContent('old-msg')).toBeNull();
    expect(await cryptoStore.getSentContent('new-msg')).not.toBeNull();
  });

  it('cleanOldSentMessages keeps messages under 30 days', async () => {
    const recentTime = Date.now() - 29 * 24 * 60 * 60 * 1000;
    await cryptoStore.put('sentMessages', {
      id: 'recent-msg',
      content: 'recent',
      savedAt: recentTime,
    });

    await cryptoStore.cleanOldSentMessages();
    expect(await cryptoStore.getSentContent('recent-msg')).not.toBeNull();
  });
});

// ======================== groupKeys ========================

describe('CryptoStore — groupKeys', () => {
  it('saveGroupKey + getGroupKey round-trip', async () => {
    await cryptoStore.saveGroupKey('room-1', 'base64-aes-key');
    const key = await cryptoStore.getGroupKey('room-1');
    expect(key).toBe('base64-aes-key');
  });

  it('getGroupKey returns null for unknown room', async () => {
    const key = await cryptoStore.getGroupKey('unknown-room');
    expect(key).toBeNull();
  });

  it('saveGroupKey overwrites existing key', async () => {
    await cryptoStore.saveGroupKey('room-2', 'key-v1');
    await cryptoStore.saveGroupKey('room-2', 'key-v2');
    const key = await cryptoStore.getGroupKey('room-2');
    expect(key).toBe('key-v2');
  });

  it('deleteGroupKey removes the key', async () => {
    await cryptoStore.saveGroupKey('room-3', 'temp-key');
    await cryptoStore.deleteGroupKey('room-3');
    const key = await cryptoStore.getGroupKey('room-3');
    expect(key).toBeNull();
  });

  it('deleteGroupKey on unknown room does not throw', async () => {
    await expect(cryptoStore.deleteGroupKey('no-such-room')).resolves.toBeUndefined();
  });

  it('stores updatedAt timestamp', async () => {
    const before = Date.now();
    await cryptoStore.saveGroupKey('room-ts', 'some-key');
    const record = await cryptoStore.get('groupKeys', 'room-ts');
    expect(record.updatedAt).toBeGreaterThanOrEqual(before);
    expect(record.updatedAt).toBeLessThanOrEqual(Date.now());
  });

  it('multiple rooms stored independently', async () => {
    await cryptoStore.saveGroupKey('room-A', 'key-A');
    await cryptoStore.saveGroupKey('room-B', 'key-B');
    expect(await cryptoStore.getGroupKey('room-A')).toBe('key-A');
    expect(await cryptoStore.getGroupKey('room-B')).toBe('key-B');
  });
});

// ======================== clearAll ========================

describe('CryptoStore — clearAll with new stores', () => {
  it('clears sentMessages and groupKeys', async () => {
    await cryptoStore.saveSentContent('msg-x', 'data', null, null);
    await cryptoStore.saveGroupKey('room-x', 'key-x');

    await cryptoStore.clearAll();

    expect(await cryptoStore.getSentContent('msg-x')).toBeNull();
    expect(await cryptoStore.getGroupKey('room-x')).toBeNull();
  });

  it('clears all 8 stores without error', async () => {
    await cryptoStore.put('identityKeys', { id: 'local', data: 'test' });
    await cryptoStore.put('sessions', { id: 'peer1', data: 'sess' });
    await cryptoStore.saveSentContent('m1', 'c', null, null);
    await cryptoStore.saveGroupKey('r1', 'k1');

    await expect(cryptoStore.clearAll()).resolves.toBeUndefined();

    expect(await cryptoStore.get('identityKeys', 'local')).toBeNull();
    expect(await cryptoStore.get('sessions', 'peer1')).toBeNull();
    expect(await cryptoStore.getSentContent('m1')).toBeNull();
    expect(await cryptoStore.getGroupKey('r1')).toBeNull();
  });
});
