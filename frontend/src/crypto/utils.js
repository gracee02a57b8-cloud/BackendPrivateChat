/**
 * crypto/utils — STUB (encryption disabled).
 * Original implementation archived in ./_archived/utils.js
 */

export function exportPublicKey() { return null; }
export function generateSecurityCode() { return null; }
export async function aesEncryptBuffer() { return { ciphertext: new Uint8Array(), iv: new Uint8Array(12) }; }
export async function aesDecryptBuffer() { return new ArrayBuffer(0); }
export function arrayBufferToBase64(_buf) { return ''; }
export function base64ToUint8(_str) { return new Uint8Array(); }
