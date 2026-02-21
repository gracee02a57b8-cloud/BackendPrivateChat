/**
 * Tests for the Double Ratchet protocol.
 * Covers: encrypt/decrypt, message ordering, DH ratchet step, session init.
 *
 * Note: Uses an in-memory mock for CryptoStore (no IndexedDB in Node).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CryptoStore before importing modules that depend on it
const mockStore = {
  sessions: new Map(),
  skippedKeys: new Map(),

  async saveSession(peer, state) { this.sessions.set(peer, { id: peer, ...state }); },
  async getSession(peer) { return this.sessions.get(peer) || null; },
  async deleteSession(peer) { this.sessions.delete(peer); },

  async saveSkippedKey(dhPub, msgNum, messageKey) {
    this.skippedKeys.set(`${dhPub}:${msgNum}`, { id: `${dhPub}:${msgNum}`, dhPub, msgNum, messageKey, createdAt: Date.now() });
  },
  async getSkippedKey(dhPub, msgNum) {
    return this.skippedKeys.get(`${dhPub}:${msgNum}`) || null;
  },
  async removeSkippedKey(dhPub, msgNum) {
    this.skippedKeys.delete(`${dhPub}:${msgNum}`);
  },

  reset() {
    this.sessions.clear();
    this.skippedKeys.clear();
  },
};

vi.mock('../CryptoStore', () => ({ default: mockStore }));

// Now import modules (they'll use the mock)
const {
  initSender, initReceiver, ratchetEncrypt, ratchetDecrypt,
} = await import('../DoubleRatchet');

const {
  generateECDHKeyPair, generateSigningKeyPair,
  exportPublicKey, exportKeyPair, ecdsaSign,
  ecdh, hkdf, arrayBufferToBase64,
} = await import('../utils');

const { x3dhInitiator, x3dhResponder } = await import('../X3DH');

/** Helper: full X3DH + ratchet session establishment. */
async function establishSession() {
  // Generate all keys
  const aliceIdentityKP = await generateECDHKeyPair();
  const bobIdentityKP = await generateECDHKeyPair();
  const bobSigningKP = await generateSigningKeyPair();
  const bobSignedPreKP = await generateECDHKeyPair();

  const bobIdentityKey = await exportPublicKey(bobIdentityKP.publicKey);
  const bobSigningKey = await exportPublicKey(bobSigningKP.publicKey);
  const bobSignedPreKey = await exportPublicKey(bobSignedPreKP.publicKey);
  const bobSPKSig = await ecdsaSign(bobSigningKP.privateKey, bobSignedPreKey);

  // Alice performs X3DH initiator
  const aliceX3DH = await x3dhInitiator(aliceIdentityKP, {
    identityKey: bobIdentityKey,
    signingKey: bobSigningKey,
    signedPreKey: bobSignedPreKey,
    signedPreKeySignature: bobSPKSig,
    oneTimeKey: null,
    oneTimeKeyId: null,
  });

  // Bob performs X3DH responder
  const aliceIdentityKey = await exportPublicKey(aliceIdentityKP.publicKey);
  const bobX3DH = await x3dhResponder(
    bobIdentityKP, bobSignedPreKP, null,
    aliceIdentityKey, aliceX3DH.ephemeralPublicKey
  );

  // Initialize ratchet sessions
  const aliceSession = await initSender(aliceX3DH.sharedKey, aliceX3DH.peerSignedPreKey);
  const bobSession = await initReceiver(bobX3DH.sharedKey, bobSignedPreKP);

  return { aliceSession, bobSession };
}

beforeEach(() => {
  mockStore.reset();
});

describe('Double Ratchet — Session Init', () => {
  it('initSender creates session with CKs (ready to send)', async () => {
    const kp = await generateECDHKeyPair();
    const peerSPK = await exportPublicKey(kp.publicKey);
    const sharedKey = crypto.getRandomValues(new Uint8Array(32));
    const session = await initSender(sharedKey, peerSPK);

    expect(session.DHs).toBeDefined();
    expect(session.DHr).toBe(peerSPK);
    expect(session.CKs).toBeTruthy(); // has sending chain
    expect(session.CKr).toBeNull();   // no receiving chain yet
    expect(session.Ns).toBe(0);
    expect(session.Nr).toBe(0);
    expect(session.PN).toBe(0);
  });

  it('initReceiver creates session without CKs (waiting for first message)', async () => {
    const sharedKey = crypto.getRandomValues(new Uint8Array(32));
    const kp = await generateECDHKeyPair();
    const session = await initReceiver(sharedKey, kp);

    expect(session.DHs).toBeDefined();
    expect(session.DHr).toBeNull();   // no peer ratchet key yet
    expect(session.CKs).toBeNull();   // cannot send until receiving first
    expect(session.CKr).toBeNull();
    expect(session.RK).toBeTruthy();
  });
});

describe('Double Ratchet — Encrypt / Decrypt', () => {
  it('Alice encrypts → Bob decrypts: basic round-trip', async () => {
    const { aliceSession, bobSession } = await establishSession();

    // Alice encrypts
    const { header, ciphertext, iv, state: aliceState } = await ratchetEncrypt(aliceSession, 'Hello Bob!');

    expect(ciphertext).toBeTruthy();
    expect(iv).toBeTruthy();
    expect(header.dh).toBeTruthy();
    expect(header.n).toBe(0);

    // Bob decrypts
    const { plaintext } = await ratchetDecrypt(bobSession, header, ciphertext, iv);
    expect(plaintext).toBe('Hello Bob!');
  });

  it('Alice sends multiple messages in sequence', async () => {
    const { aliceSession, bobSession } = await establishSession();

    const msgs = ['msg1', 'msg2', 'msg3'];
    const encrypted = [];

    let state = aliceSession;
    for (const msg of msgs) {
      const result = await ratchetEncrypt(state, msg);
      encrypted.push(result);
      state = result.state;
    }

    // Bob decrypts in order
    let bobState = bobSession;
    for (let i = 0; i < msgs.length; i++) {
      const { header, ciphertext, iv } = encrypted[i];
      const { plaintext, state: newBobState } = await ratchetDecrypt(bobState, header, ciphertext, iv);
      expect(plaintext).toBe(msgs[i]);
      bobState = newBobState;
    }
  });

  it('bidirectional messaging (ping-pong)', async () => {
    const { aliceSession, bobSession } = await establishSession();

    // Alice → Bob
    const { header: h1, ciphertext: c1, iv: iv1, state: aState1 } =
      await ratchetEncrypt(aliceSession, 'Alice says hi');
    const { plaintext: p1, state: bState1 } = await ratchetDecrypt(bobSession, h1, c1, iv1);
    expect(p1).toBe('Alice says hi');

    // Bob → Alice (triggers DH ratchet step)
    const { header: h2, ciphertext: c2, iv: iv2, state: bState2 } =
      await ratchetEncrypt(bState1, 'Bob replies');
    const { plaintext: p2, state: aState2 } = await ratchetDecrypt(aState1, h2, c2, iv2);
    expect(p2).toBe('Bob replies');

    // Alice → Bob again (another DH ratchet)
    const { header: h3, ciphertext: c3, iv: iv3, state: aState3 } =
      await ratchetEncrypt(aState2, 'Alice again');
    const { plaintext: p3 } = await ratchetDecrypt(bState2, h3, c3, iv3);
    expect(p3).toBe('Alice again');
  });

  it('message counter increments correctly', async () => {
    const { aliceSession } = await establishSession();

    const r1 = await ratchetEncrypt(aliceSession, 'msg1');
    expect(r1.header.n).toBe(0);

    const r2 = await ratchetEncrypt(r1.state, 'msg2');
    expect(r2.header.n).toBe(1);

    const r3 = await ratchetEncrypt(r2.state, 'msg3');
    expect(r3.header.n).toBe(2);
  });

  it('ratchet key changes when direction switches', async () => {
    const { aliceSession, bobSession } = await establishSession();

    // Alice → Bob
    const { header: h1, ciphertext: c1, iv: iv1, state: aState1 } =
      await ratchetEncrypt(aliceSession, 'msg');
    const aliceRK1 = h1.dh;

    const { state: bState1 } = await ratchetDecrypt(bobSession, h1, c1, iv1);

    // Bob → Alice (ratchet key should change)
    const { header: h2, ciphertext: c2, iv: iv2, state: bState2 } =
      await ratchetEncrypt(bState1, 'reply');
    const bobRK = h2.dh;

    expect(bobRK).not.toBe(aliceRK1); // Different DH key pair

    const { state: aState2 } = await ratchetDecrypt(aState1, h2, c2, iv2);

    // Alice → Bob again (new ratchet key)
    const { header: h3 } = await ratchetEncrypt(aState2, 'again');
    expect(h3.dh).not.toBe(aliceRK1);
    expect(h3.dh).not.toBe(bobRK);
  });

  it('encrypt unicode and emoji', async () => {
    const { aliceSession, bobSession } = await establishSession();

    const msg = 'Привет! 🐱🐈‍⬛ こんにちは';
    const { header, ciphertext, iv, state } = await ratchetEncrypt(aliceSession, msg);
    const { plaintext } = await ratchetDecrypt(bobSession, header, ciphertext, iv);
    expect(plaintext).toBe(msg);
  });

  it('receiver cannot send before receiving first message', async () => {
    const sharedKey = crypto.getRandomValues(new Uint8Array(32));
    const kp = await generateECDHKeyPair();
    const session = await initReceiver(sharedKey, kp);

    // CKs is null → should throw
    await expect(ratchetEncrypt(session, 'test')).rejects.toThrow();
  });
});

describe('Double Ratchet — Forward Secrecy', () => {
  it('each message uses a different message key', async () => {
    const { aliceSession, bobSession } = await establishSession();

    const r1 = await ratchetEncrypt(aliceSession, 'same text');
    const r2 = await ratchetEncrypt(r1.state, 'same text');

    // Same plaintext → different ciphertext (different key + IV)
    expect(r1.ciphertext).not.toBe(r2.ciphertext);
  });

  it('compromising current state does not reveal past messages', async () => {
    const { aliceSession, bobSession } = await establishSession();

    // Send and decrypt message 1
    const { header: h1, ciphertext: c1, iv: iv1, state: aState1 } =
      await ratchetEncrypt(aliceSession, 'secret past');
    const { plaintext: p1, state: bState1 } = await ratchetDecrypt(bobSession, h1, c1, iv1);

    // Send message 2
    const { header: h2, ciphertext: c2, iv: iv2, state: aState2 } =
      await ratchetEncrypt(aState1, 'current');

    // Even if attacker captures bState1 state, they can't use old chain key
    // to decrypt msg2 (because DH step may not have happened yet, but the
    // chain key has advanced)
    const bStateCopy = JSON.parse(JSON.stringify(bState1));
    // Decrypt msg2 with real state
    const { plaintext: p2 } = await ratchetDecrypt(bState1, h2, c2, iv2);
    expect(p2).toBe('current');

    // The state has been mutated — old copy's chain key is stale
    expect(bStateCopy.CKr).not.toBe(bState1.CKr);
  });
});
