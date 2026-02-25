/**
 * E2E Security Code Integration Tests.
 *
 * Simulates: Alice writes to Bob via X3DH + Double Ratchet,
 * then both sides generate security codes and verify they match.
 *
 * Also tests: code symmetry after session establishment,
 * code persistence across multiple messages, and code changes
 * when identity keys differ.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory CryptoStore mock (no IndexedDB in Node)
const mockStore = {
  sessions: new Map(),
  skippedKeys: new Map(),
  trustedKeys: new Map(),

  async saveSession(peer, state) { this.sessions.set(peer, { id: peer, ...state }); },
  async getSession(peer) { return this.sessions.get(peer) || null; },
  async deleteSession(peer) { this.sessions.delete(peer); },

  async saveSkippedKey(dhPub, msgNum, messageKey) {
    this.skippedKeys.set(`${dhPub}:${msgNum}`, { id: `${dhPub}:${msgNum}`, dhPub, msgNum, messageKey, createdAt: Date.now() });
  },
  async getSkippedKey(dhPub, msgNum) { return this.skippedKeys.get(`${dhPub}:${msgNum}`) || null; },
  async removeSkippedKey(dhPub, msgNum) { this.skippedKeys.delete(`${dhPub}:${msgNum}`); },

  async saveTrustedKey(peer, identityKey) { this.trustedKeys.set(peer, { peer, identityKey }); },
  async getTrustedKey(peer) { return this.trustedKeys.get(peer) || null; },

  reset() {
    this.sessions.clear();
    this.skippedKeys.clear();
    this.trustedKeys.clear();
  },
};

vi.mock('../CryptoStore', () => ({ default: mockStore }));

// Import modules (they'll use the mock)
const {
  initSender, initReceiver, ratchetEncrypt, ratchetDecrypt,
} = await import('../DoubleRatchet');

const {
  generateECDHKeyPair, generateSigningKeyPair,
  exportPublicKey, ecdsaSign, generateSecurityCode,
  arrayBufferToBase64,
} = await import('../utils');

const { x3dhInitiator, x3dhResponder } = await import('../X3DH');

// ======================== Helpers ========================

/** Create a full key bundle for a user (identity + signing + signedPre + optional OTK). */
async function createUserKeys(withOTK = false) {
  const identityKP = await generateECDHKeyPair();
  const signingKP = await generateSigningKeyPair();
  const signedPreKP = await generateECDHKeyPair();

  const identityKey = await exportPublicKey(identityKP.publicKey);
  const signingKey = await exportPublicKey(signingKP.publicKey);
  const signedPreKey = await exportPublicKey(signedPreKP.publicKey);
  const signedPreKeySignature = await ecdsaSign(signingKP.privateKey, signedPreKey);

  let oneTimeKP = null, oneTimeKey = null, oneTimeKeyId = null;
  if (withOTK) {
    oneTimeKP = await generateECDHKeyPair();
    oneTimeKey = await exportPublicKey(oneTimeKP.publicKey);
    oneTimeKeyId = 0;
  }

  return {
    identityKP,
    signingKP,
    signedPreKP,
    oneTimeKP,
    identityKey,       // exported base64
    bundle: {
      identityKey,
      signingKey,
      signedPreKey,
      signedPreKeySignature,
      oneTimeKey,
      oneTimeKeyId,
    },
  };
}

/** Full X3DH session + ratchet establishment between Alice and Bob. */
async function establishE2ESession(alice, bob) {
  // Alice (initiator) performs X3DH with Bob's bundle
  const aliceX3DH = await x3dhInitiator(alice.identityKP, bob.bundle);

  // Bob (responder) performs X3DH
  const bobX3DH = await x3dhResponder(
    bob.identityKP, bob.signedPreKP, bob.oneTimeKP,
    alice.identityKey, aliceX3DH.ephemeralPublicKey,
  );

  // Shared keys must match
  expect(arrayBufferToBase64(aliceX3DH.sharedKey))
    .toBe(arrayBufferToBase64(bobX3DH.sharedKey));

  // Init ratchet sessions
  const aliceSession = await initSender(aliceX3DH.sharedKey, aliceX3DH.peerSignedPreKey);
  const bobSession = await initReceiver(bobX3DH.sharedKey, bob.signedPreKP);

  return { aliceSession, bobSession };
}

beforeEach(() => {
  mockStore.reset();
});

// ======================== Tests ========================

describe('E2E Security Code — Full Integration', () => {
  it('Alice and Bob get IDENTICAL security codes (same identity keys)', async () => {
    const alice = await createUserKeys();
    const bob = await createUserKeys();

    // Both generate security code using their own IK + peer IK
    const codeAliceSees = await generateSecurityCode(alice.identityKey, bob.identityKey);
    const codeBobSees = await generateSecurityCode(bob.identityKey, alice.identityKey);

    expect(codeAliceSees).toBe(codeBobSees);
    expect(codeAliceSees).toMatch(/^\d{4} \d{4} \d{4} \d{4} \d{4} \d{4}$/);
  });

  it('security codes match AFTER X3DH session is established', async () => {
    const alice = await createUserKeys();
    const bob = await createUserKeys();

    // Establish session (X3DH + ratchet)
    await establishE2ESession(alice, bob);

    // After session: codes should still match (identity keys unchanged)
    const codeAlice = await generateSecurityCode(alice.identityKey, bob.identityKey);
    const codeBob = await generateSecurityCode(bob.identityKey, alice.identityKey);
    expect(codeAlice).toBe(codeBob);
  });

  it('security codes match AFTER exchanging encrypted messages', async () => {
    const alice = await createUserKeys();
    const bob = await createUserKeys();
    const { aliceSession, bobSession } = await establishE2ESession(alice, bob);

    // Alice sends encrypted message to Bob
    const { header, ciphertext, iv, state: aliceState } =
      await ratchetEncrypt(aliceSession, 'Привет, Боб! 🐱');

    // Bob decrypts
    const { plaintext, state: bobState } =
      await ratchetDecrypt(bobSession, header, ciphertext, iv);
    expect(plaintext).toBe('Привет, Боб! 🐱');

    // Bob replies
    const { header: h2, ciphertext: c2, iv: iv2, state: bobState2 } =
      await ratchetEncrypt(bobState, 'Привет, Алиса!');
    const { plaintext: p2 } = await ratchetDecrypt(aliceState, h2, c2, iv2);
    expect(p2).toBe('Привет, Алиса!');

    // After message exchange — security codes still identical
    const codeAlice = await generateSecurityCode(alice.identityKey, bob.identityKey);
    const codeBob = await generateSecurityCode(bob.identityKey, alice.identityKey);
    expect(codeAlice).toBe(codeBob);
  });

  it('security codes remain stable across multiple messages', async () => {
    const alice = await createUserKeys();
    const bob = await createUserKeys();
    const { aliceSession, bobSession } = await establishE2ESession(alice, bob);

    const codeBefore = await generateSecurityCode(alice.identityKey, bob.identityKey);

    // Exchange 5 ping-pong messages
    let aState = aliceSession;
    let bState = bobSession;
    for (let i = 0; i < 5; i++) {
      const { header, ciphertext, iv, state } = await ratchetEncrypt(aState, `Alice msg ${i}`);
      const { plaintext, state: bNew } = await ratchetDecrypt(bState, header, ciphertext, iv);
      expect(plaintext).toBe(`Alice msg ${i}`);
      aState = state;
      bState = bNew;

      // Bob replies
      const { header: h, ciphertext: c, iv: v, state: bState2 } = await ratchetEncrypt(bState, `Bob reply ${i}`);
      const { plaintext: p, state: aNew } = await ratchetDecrypt(aState, h, c, v);
      expect(p).toBe(`Bob reply ${i}`);
      aState = aNew;
      bState = bState2;
    }

    const codeAfter = await generateSecurityCode(alice.identityKey, bob.identityKey);

    // Security code must NOT change — it depends only on identity keys
    expect(codeBefore).toBe(codeAfter);
  });

  it('MITM attack: different identity key → different security code', async () => {
    const alice = await createUserKeys();
    const bob = await createUserKeys();
    const mallory = await createUserKeys(); // attacker

    const realCode = await generateSecurityCode(alice.identityKey, bob.identityKey);

    // If Mallory intercepts and uses her own IK instead of Bob's
    const mitmCode = await generateSecurityCode(alice.identityKey, mallory.identityKey);

    expect(realCode).not.toBe(mitmCode);
  });

  it('three-user scenario: each pair has unique security code', async () => {
    const alice = await createUserKeys();
    const bob = await createUserKeys();
    const charlie = await createUserKeys();

    const codeAB = await generateSecurityCode(alice.identityKey, bob.identityKey);
    const codeAC = await generateSecurityCode(alice.identityKey, charlie.identityKey);
    const codeBC = await generateSecurityCode(bob.identityKey, charlie.identityKey);

    // All pairwise codes must be different
    expect(codeAB).not.toBe(codeAC);
    expect(codeAB).not.toBe(codeBC);
    expect(codeAC).not.toBe(codeBC);
  });

  it('session with OTK: security codes still match', async () => {
    const alice = await createUserKeys();
    const bob = await createUserKeys(true); // with one-time key
    const { aliceSession, bobSession } = await establishE2ESession(alice, bob);

    // Exchange a message
    const { header, ciphertext, iv, state: aState } =
      await ratchetEncrypt(aliceSession, 'Secret msg with OTK');
    const { plaintext } = await ratchetDecrypt(bobSession, header, ciphertext, iv);
    expect(plaintext).toBe('Secret msg with OTK');

    // Codes match regardless of OTK usage
    const codeAlice = await generateSecurityCode(alice.identityKey, bob.identityKey);
    const codeBob = await generateSecurityCode(bob.identityKey, alice.identityKey);
    expect(codeAlice).toBe(codeBob);
  });

  it('re-establishing session preserves security code', async () => {
    const alice = await createUserKeys();
    const bob = await createUserKeys();

    // First session
    const { aliceSession: s1a } = await establishE2ESession(alice, bob);
    const codeSession1 = await generateSecurityCode(alice.identityKey, bob.identityKey);

    mockStore.reset();

    // Second session (simulate re-key)
    const { aliceSession: s2a } = await establishE2ESession(alice, bob);
    const codeSession2 = await generateSecurityCode(alice.identityKey, bob.identityKey);

    // Same identity keys → same code even after re-keying
    expect(codeSession1).toBe(codeSession2);
  });

  it('identity key change → code changes (key rotation detection)', async () => {
    const alice = await createUserKeys();
    const bob1 = await createUserKeys();

    const codeBefore = await generateSecurityCode(alice.identityKey, bob1.identityKey);

    // Bob generates new identity key (e.g., re-installed app)
    const bob2 = await createUserKeys();
    const codeAfter = await generateSecurityCode(alice.identityKey, bob2.identityKey);

    // Different identity key → different code → user should be warned
    expect(codeBefore).not.toBe(codeAfter);
  });
});
