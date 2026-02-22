/**
 * @vitest-environment jsdom
 *
 * Tests for CryptoStore v4 — decryptedMessages plaintext cache.
 * Covers: saveDecryptedContent/getDecryptedContent CRUD,
 * clearAll includes decryptedMessages store.
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

// ======================== decryptedMessages ========================

describe('CryptoStore — decryptedMessages', () => {
  it('saveDecryptedContent + getDecryptedContent round-trip', async () => {
    await cryptoStore.saveDecryptedContent('msg-1', 'Hello, world!', 'fk-1', 'tk-1');
    const result = await cryptoStore.getDecryptedContent('msg-1');

    expect(result).not.toBeNull();
    expect(result.id).toBe('msg-1');
    expect(result.content).toBe('Hello, world!');
    expect(result.fileKey).toBe('fk-1');
    expect(result.thumbnailKey).toBe('tk-1');
    expect(typeof result.savedAt).toBe('number');
  });

  it('getDecryptedContent returns null for unknown msgId', async () => {
    const result = await cryptoStore.getDecryptedContent('nonexistent');
    expect(result).toBeNull();
  });

  it('saveDecryptedContent overwrites existing entry', async () => {
    await cryptoStore.saveDecryptedContent('msg-2', 'original', null, null);
    await cryptoStore.saveDecryptedContent('msg-2', 'updated', 'fk-new', null);
    const result = await cryptoStore.getDecryptedContent('msg-2');
    expect(result.content).toBe('updated');
    expect(result.fileKey).toBe('fk-new');
  });

  it('saveDecryptedContent without file keys', async () => {
    await cryptoStore.saveDecryptedContent('msg-3', 'text only', null, null);
    const result = await cryptoStore.getDecryptedContent('msg-3');
    expect(result.content).toBe('text only');
    expect(result.fileKey).toBeNull();
    expect(result.thumbnailKey).toBeNull();
  });

  it('stores messages from different senders independently', async () => {
    await cryptoStore.saveDecryptedContent('msg-a', 'from alice', null, null);
    await cryptoStore.saveDecryptedContent('msg-b', 'from bob', null, null);

    const a = await cryptoStore.getDecryptedContent('msg-a');
    const b = await cryptoStore.getDecryptedContent('msg-b');

    expect(a.content).toBe('from alice');
    expect(b.content).toBe('from bob');
  });

  it('preserves savedAt timestamp', async () => {
    const before = Date.now();
    await cryptoStore.saveDecryptedContent('msg-ts', 'timed', null, null);
    const result = await cryptoStore.getDecryptedContent('msg-ts');
    expect(result.savedAt).toBeGreaterThanOrEqual(before);
    expect(result.savedAt).toBeLessThanOrEqual(Date.now());
  });

  it('handles empty content', async () => {
    await cryptoStore.saveDecryptedContent('msg-empty', '', null, null);
    const result = await cryptoStore.getDecryptedContent('msg-empty');
    expect(result.content).toBe('');
  });

  it('handles unicode and emoji content', async () => {
    const text = '🐱 Привет мир! 🎉';
    await cryptoStore.saveDecryptedContent('msg-emoji', text, null, null);
    const result = await cryptoStore.getDecryptedContent('msg-emoji');
    expect(result.content).toBe(text);
  });
});

// ======================== clearAll includes decryptedMessages ========================

describe('CryptoStore — clearAll with decryptedMessages', () => {
  it('clears decryptedMessages along with other stores', async () => {
    await cryptoStore.saveDecryptedContent('msg-d', 'decrypted data', null, null);
    await cryptoStore.saveSentContent('msg-s', 'sent data', null, null);
    await cryptoStore.saveGroupKey('room-g', 'key-g');

    await cryptoStore.clearAll();

    expect(await cryptoStore.getDecryptedContent('msg-d')).toBeNull();
    expect(await cryptoStore.getSentContent('msg-s')).toBeNull();
    expect(await cryptoStore.getGroupKey('room-g')).toBeNull();
  });

  it('clears all 9 stores without error', async () => {
    await cryptoStore.put('identityKeys', { id: 'local', data: 'test' });
    await cryptoStore.put('sessions', { id: 'peer1', data: 'sess' });
    await cryptoStore.saveSentContent('m1', 'c', null, null);
    await cryptoStore.saveGroupKey('r1', 'k1');
    await cryptoStore.saveDecryptedContent('d1', 'plain', null, null);

    await expect(cryptoStore.clearAll()).resolves.toBeUndefined();

    expect(await cryptoStore.get('identityKeys', 'local')).toBeNull();
    expect(await cryptoStore.get('sessions', 'peer1')).toBeNull();
    expect(await cryptoStore.getSentContent('m1')).toBeNull();
    expect(await cryptoStore.getGroupKey('r1')).toBeNull();
    expect(await cryptoStore.getDecryptedContent('d1')).toBeNull();
  });
});
