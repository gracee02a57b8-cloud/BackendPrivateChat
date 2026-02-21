/**
 * Low-level cryptographic utilities using Web Crypto API.
 * ECDH P-256, ECDSA P-256, HKDF-SHA256, AES-256-GCM, HMAC-SHA256.
 */

// ======================== Key Generation ========================

export async function generateECDHKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
}

export async function generateSigningKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
}

// ======================== Key Export / Import ========================

export async function exportPublicKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

export async function importPublicKey(base64, alg = 'ECDH') {
  const raw = base64ToArrayBuffer(base64);
  const algorithm = alg === 'ECDSA'
    ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'ECDH', namedCurve: 'P-256' };
  const usages = alg === 'ECDSA' ? ['verify'] : [];
  return crypto.subtle.importKey('raw', raw, algorithm, true, usages);
}

export async function exportPrivateKey(key) {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPrivateKey(jwkStr, alg = 'ECDH') {
  const jwk = JSON.parse(jwkStr);
  const algorithm = alg === 'ECDSA'
    ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'ECDH', namedCurve: 'P-256' };
  const usages = alg === 'ECDSA' ? ['sign'] : ['deriveBits'];
  return crypto.subtle.importKey('jwk', jwk, algorithm, true, usages);
}

export async function exportKeyPair(kp) {
  return {
    publicKey: await exportPublicKey(kp.publicKey),
    privateKey: await exportPrivateKey(kp.privateKey),
  };
}

export async function importKeyPair(exported, alg = 'ECDH') {
  const pubAlg = alg === 'ECDSA' ? 'ECDSA' : 'ECDH';
  return {
    publicKey: await importPublicKey(exported.publicKey, pubAlg),
    privateKey: await importPrivateKey(exported.privateKey, alg),
  };
}

// ======================== ECDH ========================

export async function ecdh(privateKey, publicKey) {
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
  return new Uint8Array(bits);
}

// ======================== HKDF ========================

export async function hkdf(ikm, salt, info, length = 32) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt || new Uint8Array(32),
      info: typeof info === 'string' ? new TextEncoder().encode(info) : info,
    },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

/** Derive two 32-byte keys from input material (for ratchet KDF_RK). */
export async function hkdfDouble(ikm, salt, info) {
  const out = await hkdf(ikm, salt, info, 64);
  return [out.slice(0, 32), out.slice(32, 64)];
}

// ======================== AES-256-GCM ========================

export async function aesEncrypt(plaintext, keyBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const data = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : plaintext;
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
  return {
    ciphertext: arrayBufferToBase64(ct),
    iv: arrayBufferToBase64(iv),
  };
}

export async function aesDecrypt(ciphertextB64, ivB64, keyBytes) {
  const ct = base64ToArrayBuffer(ciphertextB64);
  const iv = base64ToArrayBuffer(ivB64);
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ct);
  return new TextDecoder().decode(pt);
}

/** Encrypt raw ArrayBuffer (for file encryption). */
export async function aesEncryptBuffer(buffer, keyBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, buffer);
  return { ciphertext: new Uint8Array(ct), iv };
}

/** Decrypt raw ArrayBuffer. */
export async function aesDecryptBuffer(ciphertext, iv, keyBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ciphertext);
}

// ======================== ECDSA Signing ========================

export async function ecdsaSign(privateKey, data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, bytes);
  return arrayBufferToBase64(sig);
}

export async function ecdsaVerify(publicKey, signatureB64, data) {
  const sig = base64ToArrayBuffer(signatureB64);
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sig, bytes);
}

// ======================== HMAC-SHA256 (ratchet KDF_CK) ========================

export async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(sig);
}

// ======================== SHA-256 ========================

export async function sha256(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

// ======================== Security Code (identity verification) ========================

export async function generateSecurityCode(ikA, ikB) {
  const sorted = [ikA, ikB].sort();
  const hash = await sha256(sorted[0] + '|' + sorted[1]);
  const view = new DataView(hash.buffer);
  const parts = [];
  for (let i = 0; i < 6; i++) {
    parts.push(String(view.getUint16(i * 2) % 10000).padStart(4, '0'));
  }
  return parts.join(' ');
}

// ======================== Buffer Utilities ========================

export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function base64ToUint8(b64) {
  return new Uint8Array(base64ToArrayBuffer(b64));
}

export function concatBytes(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { result.set(a, off); off += a.length; }
  return result;
}
