/**
 * DoubleRatchet — Signal Protocol Double Ratchet implementation.
 *
 * Combines:
 *   1. DH Ratchet — new ECDH key pair per direction change → new root key
 *   2. Symmetric Ratchet — KDF chain for message keys (forward secrecy per message)
 *
 * State: { DHs, DHr, RK, CKs, CKr, Ns, Nr, PN }
 */

import {
  generateECDHKeyPair, exportPublicKey, importPublicKey, exportKeyPair, importKeyPair,
  ecdh, hkdfDouble, hmac, aesEncrypt, aesDecrypt,
  arrayBufferToBase64, base64ToUint8,
} from './utils';
import cryptoStore from './CryptoStore';

const MAX_SKIP = 100;
const CHAIN_MSG_KEY = new Uint8Array([0x01]);
const CHAIN_NEXT_KEY = new Uint8Array([0x02]);

// ======================== KDF Functions ========================

/** KDF_RK: Root key + DH output → new root key + chain key. */
async function kdfRK(rootKey, dhOutput) {
  return hkdfDouble(dhOutput, rootKey, 'BarsikRatchet');
}

/** KDF_CK: Chain key → next chain key + message key. */
async function kdfCK(chainKey) {
  const messageKey = await hmac(chainKey, CHAIN_MSG_KEY);
  const nextChainKey = await hmac(chainKey, CHAIN_NEXT_KEY);
  return [nextChainKey, messageKey];
}

// ======================== Session Initialization ========================

/**
 * Initialize ratchet as SENDER (Alice — X3DH initiator).
 * Alice has: sharedKey from X3DH, Bob's SPK as initial DHr.
 */
export async function initSender(sharedKey, peerSignedPreKeyB64) {
  const DHs = await generateECDHKeyPair();
  const DHr = await importPublicKey(peerSignedPreKeyB64);
  const dhOut = await ecdh(DHs.privateKey, DHr);
  const [RK, CKs] = await kdfRK(sharedKey, dhOut);

  return {
    DHs: await exportKeyPair(DHs),
    DHr: peerSignedPreKeyB64,
    RK: arrayBufferToBase64(RK),
    CKs: arrayBufferToBase64(CKs),
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
  };
}

/**
 * Initialize ratchet as RECEIVER (Bob — X3DH responder).
 * Bob has: sharedKey from X3DH, his SPK as initial DHs.
 */
export async function initReceiver(sharedKey, signedPreKeyPair) {
  return {
    DHs: await exportKeyPair(signedPreKeyPair),
    DHr: null,
    RK: arrayBufferToBase64(sharedKey),
    CKs: null,
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
  };
}

// ======================== Encrypt / Decrypt ========================

/**
 * Encrypt a message using the ratchet.
 * @param {Object} state - Mutable session state (will be modified in-place).
 * @param {string} plaintext - Message to encrypt.
 * @returns {{ header, ciphertext, iv, state }}
 */
export async function ratchetEncrypt(state, plaintext) {
  if (!state.CKs) throw new Error('Sending chain not initialized (waiting for first incoming message)');

  const ckBytes = base64ToUint8(state.CKs);
  const [nextCK, mk] = await kdfCK(ckBytes);

  const header = {
    dh: state.DHs.publicKey,
    pn: state.PN,
    n: state.Ns,
  };

  state.CKs = arrayBufferToBase64(nextCK);
  state.Ns += 1;

  const { ciphertext, iv } = await aesEncrypt(plaintext, mk);

  return { header, ciphertext, iv, state };
}

/**
 * Decrypt a message using the ratchet.
 * @param {Object} state - Mutable session state.
 * @param {{ dh, pn, n }} header - Message header.
 * @param {string} ciphertext - Base64 ciphertext.
 * @param {string} iv - Base64 IV.
 * @returns {{ plaintext, state }}
 */
export async function ratchetDecrypt(state, header, ciphertext, iv) {
  // Try skipped message keys first
  const skipped = await trySkippedKeys(header, ciphertext, iv);
  if (skipped !== null) return { plaintext: skipped, state };

  // DH ratchet step if peer's ratchet key changed
  if (header.dh !== state.DHr) {
    await skipMessageKeys(state, header.pn);
    await dhRatchetStep(state, header);
  }

  // Advance receiving chain
  await skipMessageKeys(state, header.n);
  const ckBytes = base64ToUint8(state.CKr);
  const [nextCK, mk] = await kdfCK(ckBytes);
  state.CKr = arrayBufferToBase64(nextCK);
  state.Nr += 1;

  const plaintext = await aesDecrypt(ciphertext, iv, mk);
  return { plaintext, state };
}

// ======================== DH Ratchet Step ========================

async function dhRatchetStep(state, header) {
  state.PN = state.Ns;
  state.Ns = 0;
  state.Nr = 0;
  state.DHr = header.dh;

  // Derive receiving chain key
  const DHsKP = await importKeyPair(state.DHs);
  const DHr = await importPublicKey(state.DHr);
  const dhOut1 = await ecdh(DHsKP.privateKey, DHr);
  const rk1 = base64ToUint8(state.RK);
  const [newRK1, CKr] = await kdfRK(rk1, dhOut1);
  state.RK = arrayBufferToBase64(newRK1);
  state.CKr = arrayBufferToBase64(CKr);

  // Generate new DH sending key pair
  const newDHs = await generateECDHKeyPair();
  state.DHs = await exportKeyPair(newDHs);

  // Derive sending chain key
  const dhOut2 = await ecdh(newDHs.privateKey, DHr);
  const rk2 = base64ToUint8(state.RK);
  const [newRK2, CKs] = await kdfRK(rk2, dhOut2);
  state.RK = arrayBufferToBase64(newRK2);
  state.CKs = arrayBufferToBase64(CKs);
}

// ======================== Skip Handling (out-of-order) ========================

async function skipMessageKeys(state, until) {
  if (!state.CKr) return;
  if (state.Nr >= until) return;
  if (until - state.Nr > MAX_SKIP) {
    throw new Error('Too many skipped messages');
  }
  let ck = base64ToUint8(state.CKr);
  while (state.Nr < until) {
    const [nextCK, mk] = await kdfCK(ck);
    await cryptoStore.saveSkippedKey(
      state.DHr,
      state.Nr,
      arrayBufferToBase64(mk)
    );
    ck = nextCK;
    state.Nr += 1;
  }
  state.CKr = arrayBufferToBase64(ck);
}

async function trySkippedKeys(header, ciphertext, iv) {
  const entry = await cryptoStore.getSkippedKey(header.dh, header.n);
  if (!entry) return null;
  await cryptoStore.removeSkippedKey(header.dh, header.n);
  const mk = base64ToUint8(entry.messageKey);
  return aesDecrypt(ciphertext, iv, mk);
}

// ======================== Session Serialization ========================

export async function saveSession(peerUsername, state) {
  await cryptoStore.saveSession(peerUsername, state);
}

export async function loadSession(peerUsername) {
  const stored = await cryptoStore.getSession(peerUsername);
  if (!stored) return null;
  const { id, ...state } = stored;
  return state;
}

export async function deleteSession(peerUsername) {
  await cryptoStore.deleteSession(peerUsername);
}
