/**
 * Tests for low-level cryptographic utilities (utils.js).
 * Covers: key generation, export/import, ECDH, HKDF, AES-GCM, HMAC, SHA-256, security code.
 */

import { describe, it, expect } from 'vitest';
import {
  generateECDHKeyPair,
  generateSigningKeyPair,
  exportPublicKey,
  importPublicKey,
  exportPrivateKey,
  importPrivateKey,
  exportKeyPair,
  importKeyPair,
  ecdh,
  hkdf,
  hkdfDouble,
  aesEncrypt,
  aesDecrypt,
  ecdsaSign,
  ecdsaVerify,
  hmac,
  sha256,
  generateSecurityCode,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64ToUint8,
  concatBytes,
} from '../utils';

// ======================== Key Generation ========================

describe('Key Generation', () => {
  it('generateECDHKeyPair produces CryptoKeyPair', async () => {
    const kp = await generateECDHKeyPair();
    expect(kp.publicKey).toBeDefined();
    expect(kp.privateKey).toBeDefined();
    expect(kp.publicKey.type).toBe('public');
    expect(kp.privateKey.type).toBe('private');
  });

  it('generateSigningKeyPair produces ECDSA CryptoKeyPair', async () => {
    const kp = await generateSigningKeyPair();
    expect(kp.publicKey.algorithm.name).toBe('ECDSA');
    expect(kp.privateKey.algorithm.name).toBe('ECDSA');
  });

  it('each ECDH key pair is unique', async () => {
    const kp1 = await generateECDHKeyPair();
    const kp2 = await generateECDHKeyPair();
    const pub1 = await exportPublicKey(kp1.publicKey);
    const pub2 = await exportPublicKey(kp2.publicKey);
    expect(pub1).not.toBe(pub2);
  });
});

// ======================== Key Export / Import ========================

describe('Key Export / Import', () => {
  it('public key round-trip export → import → export produces same base64', async () => {
    const kp = await generateECDHKeyPair();
    const exported = await exportPublicKey(kp.publicKey);
    const imported = await importPublicKey(exported);
    const reExported = await exportPublicKey(imported);
    expect(reExported).toBe(exported);
  });

  it('private key round-trip export → import → export preserves key', async () => {
    const kp = await generateECDHKeyPair();
    const exported = await exportPrivateKey(kp.privateKey);
    const imported = await importPrivateKey(exported);
    const reExported = await exportPrivateKey(imported);
    // JWK fields should match (key data)
    const orig = JSON.parse(exported);
    const reimported = JSON.parse(reExported);
    expect(reimported.x).toBe(orig.x);
    expect(reimported.y).toBe(orig.y);
    expect(reimported.d).toBe(orig.d);
  });

  it('exportKeyPair + importKeyPair full round-trip', async () => {
    const kp = await generateECDHKeyPair();
    const exported = await exportKeyPair(kp);
    expect(exported.publicKey).toBeTruthy();
    expect(exported.privateKey).toBeTruthy();

    const imported = await importKeyPair(exported);
    const pubKey = await exportPublicKey(imported.publicKey);
    expect(pubKey).toBe(exported.publicKey);
  });

  it('ECDSA key pair export → import → verify works', async () => {
    const kp = await generateSigningKeyPair();
    const exported = await exportKeyPair(kp);
    const imported = await importKeyPair(exported, 'ECDSA');
    // Should be able to sign and verify
    const sig = await ecdsaSign(imported.privateKey, 'test data');
    const valid = await ecdsaVerify(imported.publicKey, sig, 'test data');
    expect(valid).toBe(true);
  });
});

// ======================== ECDH ========================

describe('ECDH', () => {
  it('two parties derive same shared secret', async () => {
    const alice = await generateECDHKeyPair();
    const bob = await generateECDHKeyPair();

    const secretAlice = await ecdh(alice.privateKey, bob.publicKey);
    const secretBob = await ecdh(bob.privateKey, alice.publicKey);

    expect(arrayBufferToBase64(secretAlice)).toBe(arrayBufferToBase64(secretBob));
  });

  it('shared secret is 32 bytes (256 bits)', async () => {
    const alice = await generateECDHKeyPair();
    const bob = await generateECDHKeyPair();
    const secret = await ecdh(alice.privateKey, bob.publicKey);
    expect(secret.length).toBe(32);
  });

  it('different key pairs produce different secrets', async () => {
    const alice = await generateECDHKeyPair();
    const bob = await generateECDHKeyPair();
    const charlie = await generateECDHKeyPair();

    const secretAB = await ecdh(alice.privateKey, bob.publicKey);
    const secretAC = await ecdh(alice.privateKey, charlie.publicKey);

    expect(arrayBufferToBase64(secretAB)).not.toBe(arrayBufferToBase64(secretAC));
  });
});

// ======================== HKDF ========================

describe('HKDF', () => {
  it('derives key of requested length', async () => {
    const ikm = crypto.getRandomValues(new Uint8Array(32));
    const key = await hkdf(ikm, null, 'test-info', 32);
    expect(key.length).toBe(32);
  });

  it('same inputs produce same output (deterministic)', async () => {
    const ikm = new Uint8Array(32).fill(42);
    const salt = new Uint8Array(32).fill(1);
    const k1 = await hkdf(ikm, salt, 'info');
    const k2 = await hkdf(ikm, salt, 'info');
    expect(arrayBufferToBase64(k1)).toBe(arrayBufferToBase64(k2));
  });

  it('different info produces different key', async () => {
    const ikm = new Uint8Array(32).fill(42);
    const k1 = await hkdf(ikm, null, 'info-A');
    const k2 = await hkdf(ikm, null, 'info-B');
    expect(arrayBufferToBase64(k1)).not.toBe(arrayBufferToBase64(k2));
  });

  it('hkdfDouble produces two 32-byte keys', async () => {
    const ikm = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const [k1, k2] = await hkdfDouble(ikm, salt, 'test');
    expect(k1.length).toBe(32);
    expect(k2.length).toBe(32);
    // Two halves should be different
    expect(arrayBufferToBase64(k1)).not.toBe(arrayBufferToBase64(k2));
  });
});

// ======================== AES-256-GCM ========================

describe('AES-256-GCM', () => {
  it('encrypt → decrypt round-trip produces original plaintext', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const plaintext = 'Hello, BarsikChat!';
    const { ciphertext, iv } = await aesEncrypt(plaintext, key);
    const decrypted = await aesDecrypt(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('ciphertext differs from plaintext', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const { ciphertext } = await aesEncrypt('secret', key);
    // Base64 ciphertext should not equal the plaintext
    expect(ciphertext).not.toBe('secret');
  });

  it('wrong key fails to decrypt', async () => {
    const key1 = crypto.getRandomValues(new Uint8Array(32));
    const key2 = crypto.getRandomValues(new Uint8Array(32));
    const { ciphertext, iv } = await aesEncrypt('secret', key1);
    await expect(aesDecrypt(ciphertext, iv, key2)).rejects.toThrow();
  });

  it('tampered ciphertext fails to decrypt', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const { ciphertext, iv } = await aesEncrypt('secret', key);
    // Flip a character in ciphertext
    const tampered = ciphertext.slice(0, -2) + 'XX';
    await expect(aesDecrypt(tampered, iv, key)).rejects.toThrow();
  });

  it('encrypts unicode text correctly', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const plaintext = 'Привет мир! 🐱 Emoji';
    const { ciphertext, iv } = await aesEncrypt(plaintext, key);
    const decrypted = await aesDecrypt(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypts empty string', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const { ciphertext, iv } = await aesEncrypt('', key);
    const decrypted = await aesDecrypt(ciphertext, iv, key);
    expect(decrypted).toBe('');
  });
});

// ======================== ECDSA ========================

describe('ECDSA', () => {
  it('sign → verify succeeds with correct key', async () => {
    const kp = await generateSigningKeyPair();
    const sig = await ecdsaSign(kp.privateKey, 'test data');
    const valid = await ecdsaVerify(kp.publicKey, sig, 'test data');
    expect(valid).toBe(true);
  });

  it('verify fails with wrong data', async () => {
    const kp = await generateSigningKeyPair();
    const sig = await ecdsaSign(kp.privateKey, 'test data');
    const valid = await ecdsaVerify(kp.publicKey, sig, 'wrong data');
    expect(valid).toBe(false);
  });

  it('verify fails with wrong key', async () => {
    const kp1 = await generateSigningKeyPair();
    const kp2 = await generateSigningKeyPair();
    const sig = await ecdsaSign(kp1.privateKey, 'test');
    const valid = await ecdsaVerify(kp2.publicKey, sig, 'test');
    expect(valid).toBe(false);
  });
});

// ======================== HMAC ========================

describe('HMAC', () => {
  it('produces 32-byte output', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const result = await hmac(key, new Uint8Array([1]));
    expect(result.length).toBe(32);
  });

  it('same inputs produce same output', async () => {
    const key = new Uint8Array(32).fill(42);
    const data = new Uint8Array([1, 2, 3]);
    const h1 = await hmac(key, data);
    const h2 = await hmac(key, data);
    expect(arrayBufferToBase64(h1)).toBe(arrayBufferToBase64(h2));
  });

  it('different keys produce different output', async () => {
    const k1 = new Uint8Array(32).fill(1);
    const k2 = new Uint8Array(32).fill(2);
    const data = new Uint8Array([42]);
    const h1 = await hmac(k1, data);
    const h2 = await hmac(k2, data);
    expect(arrayBufferToBase64(h1)).not.toBe(arrayBufferToBase64(h2));
  });
});

// ======================== SHA-256 ========================

describe('SHA-256', () => {
  it('produces 32-byte hash', async () => {
    const hash = await sha256('test');
    expect(hash.length).toBe(32);
  });

  it('same input produces same hash', async () => {
    const h1 = await sha256('hello');
    const h2 = await sha256('hello');
    expect(arrayBufferToBase64(h1)).toBe(arrayBufferToBase64(h2));
  });

  it('different input produces different hash', async () => {
    const h1 = await sha256('hello');
    const h2 = await sha256('world');
    expect(arrayBufferToBase64(h1)).not.toBe(arrayBufferToBase64(h2));
  });
});

// ======================== Security Code ========================

describe('Security Code', () => {
  it('generates 6 groups of 4 digits', async () => {
    const kp1 = await generateECDHKeyPair();
    const kp2 = await generateECDHKeyPair();
    const ik1 = await exportPublicKey(kp1.publicKey);
    const ik2 = await exportPublicKey(kp2.publicKey);

    const code = await generateSecurityCode(ik1, ik2);
    expect(code).toMatch(/^\d{4} \d{4} \d{4} \d{4} \d{4} \d{4}$/);
  });

  it('is symmetric: same code regardless of argument order', async () => {
    const kp1 = await generateECDHKeyPair();
    const kp2 = await generateECDHKeyPair();
    const ik1 = await exportPublicKey(kp1.publicKey);
    const ik2 = await exportPublicKey(kp2.publicKey);

    const code1 = await generateSecurityCode(ik1, ik2);
    const code2 = await generateSecurityCode(ik2, ik1);
    expect(code1).toBe(code2);
  });

  it('is deterministic: same keys produce same code', async () => {
    const kp1 = await generateECDHKeyPair();
    const kp2 = await generateECDHKeyPair();
    const ik1 = await exportPublicKey(kp1.publicKey);
    const ik2 = await exportPublicKey(kp2.publicKey);

    const code1 = await generateSecurityCode(ik1, ik2);
    const code2 = await generateSecurityCode(ik1, ik2);
    expect(code1).toBe(code2);
  });

  it('different key pairs produce different codes', async () => {
    const kp1 = await generateECDHKeyPair();
    const kp2 = await generateECDHKeyPair();
    const kp3 = await generateECDHKeyPair();
    const ik1 = await exportPublicKey(kp1.publicKey);
    const ik2 = await exportPublicKey(kp2.publicKey);
    const ik3 = await exportPublicKey(kp3.publicKey);

    const code12 = await generateSecurityCode(ik1, ik2);
    const code13 = await generateSecurityCode(ik1, ik3);
    expect(code12).not.toBe(code13);
  });
});

// ======================== Buffer Utilities ========================

describe('Buffer Utilities', () => {
  it('arrayBufferToBase64 → base64ToArrayBuffer round-trip', () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 255]);
    const b64 = arrayBufferToBase64(original);
    const restored = new Uint8Array(base64ToArrayBuffer(b64));
    expect([...restored]).toEqual([...original]);
  });

  it('base64ToUint8 returns Uint8Array', () => {
    const b64 = arrayBufferToBase64(new Uint8Array([42, 43, 44]));
    const result = base64ToUint8(b64);
    expect(result).toBeInstanceOf(Uint8Array);
    expect([...result]).toEqual([42, 43, 44]);
  });

  it('concatBytes concatenates correctly', () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4, 5]);
    const c = new Uint8Array([6]);
    const result = concatBytes(a, b, c);
    expect([...result]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.length).toBe(6);
  });
});
