/**
 * @vitest-environment jsdom
 *
 * Tests for CallCrypto — AES-128-GCM per-frame media encryption for WebRTC.
 * Covers: key generation, key import, encrypt/decrypt round-trip,
 * supportsInsertableStreams detection, disable, destroy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallCrypto, supportsInsertableStreams } from '../CallCrypto';

// ======================== supportsInsertableStreams ========================

describe('supportsInsertableStreams', () => {
  it('returns false when RTCRtpSender is missing', () => {
    const orig = globalThis.RTCRtpSender;
    delete globalThis.RTCRtpSender;
    expect(supportsInsertableStreams()).toBe(false);
    if (orig) globalThis.RTCRtpSender = orig;
  });

  it('returns false when createEncodedStreams is missing', () => {
    globalThis.RTCRtpSender = class {};
    expect(supportsInsertableStreams()).toBe(false);
    delete globalThis.RTCRtpSender;
  });

  it('returns true when createEncodedStreams exists', () => {
    globalThis.RTCRtpSender = class {};
    globalThis.RTCRtpSender.prototype.createEncodedStreams = function () {};
    expect(supportsInsertableStreams()).toBe(true);
    delete globalThis.RTCRtpSender;
  });
});

// ======================== Key Generation ========================

describe('CallCrypto — Key Generation', () => {
  let cc;
  beforeEach(() => { cc = new CallCrypto(); });

  it('generateKey returns a base64 string', async () => {
    const key = await cc.generateKey();
    expect(typeof key).toBe('string');
    // base64 of 16 bytes → 24 chars
    expect(key.length).toBe(24);
  });

  it('generateKey sets internal _keyBase64', async () => {
    const key = await cc.generateKey();
    expect(cc._keyBase64).toBe(key);
  });

  it('each call produces a unique key', async () => {
    const cc2 = new CallCrypto();
    const k1 = await cc.generateKey();
    const k2 = await cc2.generateKey();
    expect(k1).not.toBe(k2);
  });

  it('generateKey initialises encrypt key internally', async () => {
    await cc.generateKey();
    expect(cc._encryptKey).not.toBeNull();
  });
});

// ======================== setDecryptKey ========================

describe('CallCrypto — setDecryptKey', () => {
  let cc;
  beforeEach(() => { cc = new CallCrypto(); });

  it('imports a valid base64 key without throwing', async () => {
    const sender = new CallCrypto();
    const key = await sender.generateKey();
    await expect(cc.setDecryptKey(key)).resolves.toBeUndefined();
    expect(cc._decryptKey).not.toBeNull();
  });

  it('does nothing when key is null/undefined', async () => {
    await cc.setDecryptKey(null);
    expect(cc._decryptKey).toBeNull();
    await cc.setDecryptKey(undefined);
    expect(cc._decryptKey).toBeNull();
  });

  it('does nothing when key is empty string', async () => {
    await cc.setDecryptKey('');
    expect(cc._decryptKey).toBeNull();
  });
});

// ======================== Encrypt / Decrypt Round-Trip ========================

describe('CallCrypto — Encrypt / Decrypt round-trip', () => {
  it('frame survives encrypt → decrypt cycle', async () => {
    const sender = new CallCrypto();
    const receiver = new CallCrypto();

    // Exchange keys
    const senderKey = await sender.generateKey();
    await receiver.setDecryptKey(senderKey);

    // Simulate frame data
    const originalData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Encrypt: call the low-level AES-GCM path directly
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sender._encryptKey,
      originalData.buffer,
    );

    // Build combined IV+ciphertext (same as setupSenderEncryption does)
    const combined = new Uint8Array(12 + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), 12);

    // Decrypt
    const data = combined;
    const extractedIv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: extractedIv },
      receiver._decryptKey,
      ciphertext,
    );

    expect(new Uint8Array(decrypted)).toEqual(originalData);
  });

  it('different keys cannot decrypt each other', async () => {
    const sender = new CallCrypto();
    const wrongReceiver = new CallCrypto();

    await sender.generateKey();
    // Receiver has its OWN key instead of sender's
    const wrongKey = await wrongReceiver.generateKey();
    await wrongReceiver.setDecryptKey(wrongKey); // wrong key!

    const original = new Uint8Array([42, 43, 44]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sender._encryptKey,
      original.buffer,
    );

    const combined = new Uint8Array(12 + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), 12);

    // Decrypting with wrong key should throw
    await expect(
      crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: combined.slice(0, 12) },
        wrongReceiver._decryptKey,
        combined.slice(12),
      ),
    ).rejects.toThrow();
  });

  it('handles empty frame (zero bytes)', async () => {
    const sender = new CallCrypto();
    const receiver = new CallCrypto();

    const key = await sender.generateKey();
    await receiver.setDecryptKey(key);

    const empty = new Uint8Array(0);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sender._encryptKey,
      empty.buffer,
    );

    const combined = new Uint8Array(12 + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), 12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) },
      receiver._decryptKey,
      combined.slice(12),
    );
    expect(new Uint8Array(decrypted).length).toBe(0);
  });
});

// ======================== TransformStream integration ========================

describe('CallCrypto — setupSenderEncryption / setupReceiverDecryption', () => {
  it('skips sender if createEncodedStreams is missing', () => {
    const cc = new CallCrypto();
    const fakeSender = {}; // no createEncodedStreams
    // Should not throw
    cc.setupSenderEncryption(fakeSender);
  });

  it('skips receiver if createEncodedStreams is missing', () => {
    const cc = new CallCrypto();
    const fakeReceiver = {};
    cc.setupReceiverDecryption(fakeReceiver);
  });

  it('sets up encryption pipeline when createEncodedStreams exists', async () => {
    const cc = new CallCrypto();
    await cc.generateKey();

    // Mock a minimal RTCRtpSender.createEncodedStreams()
    const passthrough = new TransformStream();
    const fakeSender = {
      createEncodedStreams: () => ({
        readable: passthrough.readable,
        writable: passthrough.writable,
      }),
    };

    // Should not throw
    cc.setupSenderEncryption(fakeSender);
  });

  it('sets up decryption pipeline when createEncodedStreams exists', async () => {
    const cc = new CallCrypto();
    const sender = new CallCrypto();
    const key = await sender.generateKey();
    await cc.setDecryptKey(key);

    const passthrough = new TransformStream();
    const fakeReceiver = {
      createEncodedStreams: () => ({
        readable: passthrough.readable,
        writable: passthrough.writable,
      }),
    };

    cc.setupReceiverDecryption(fakeReceiver);
  });
});

// ======================== disableEncryption ========================

describe('CallCrypto — disableEncryption', () => {
  it('nullifies encrypt key', async () => {
    const cc = new CallCrypto();
    await cc.generateKey();
    expect(cc._encryptKey).not.toBeNull();

    cc.disableEncryption();
    expect(cc._encryptKey).toBeNull();
    // decrypt key and keyBase64 remain untouched
    expect(cc._keyBase64).not.toBeNull();
  });
});

// ======================== destroy ========================

describe('CallCrypto — destroy', () => {
  it('clears all internal state', async () => {
    const cc = new CallCrypto();
    await cc.generateKey();
    const sender2 = new CallCrypto();
    const peerKey = await sender2.generateKey();
    await cc.setDecryptKey(peerKey);

    cc.destroy();

    expect(cc._encryptKey).toBeNull();
    expect(cc._decryptKey).toBeNull();
    expect(cc._keyBase64).toBeNull();
  });

  it('can be called multiple times safely', () => {
    const cc = new CallCrypto();
    cc.destroy();
    cc.destroy();
    // No error
  });
});
