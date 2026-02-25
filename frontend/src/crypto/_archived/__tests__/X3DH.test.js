/**
 * Tests for X3DH (Extended Triple Diffie-Hellman) key agreement protocol.
 * Verifies: initiator + responder derive same shared key, signature verification,
 * with/without one-time pre-keys.
 */

import { describe, it, expect } from 'vitest';
import { x3dhInitiator, x3dhResponder } from '../X3DH';
import {
  generateECDHKeyPair,
  generateSigningKeyPair,
  exportPublicKey,
  exportKeyPair,
  ecdsaSign,
  arrayBufferToBase64,
} from '../utils';

/** Helper: create a full key bundle for a user (like server-side bundle). */
async function createBundle(withOTK = true) {
  const identityKP = await generateECDHKeyPair();
  const signingKP = await generateSigningKeyPair();
  const signedPreKP = await generateECDHKeyPair();

  const identityKey = await exportPublicKey(identityKP.publicKey);
  const signingKey = await exportPublicKey(signingKP.publicKey);
  const signedPreKey = await exportPublicKey(signedPreKP.publicKey);
  const signedPreKeySignature = await ecdsaSign(signingKP.privateKey, signedPreKey);

  let oneTimeKey = null;
  let oneTimeKeyId = null;
  let oneTimeKP = null;

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

describe('X3DH Protocol', () => {
  it('initiator and responder derive the same shared key (with OTK)', async () => {
    // Alice (initiator) and Bob (responder)
    const aliceIdentityKP = await generateECDHKeyPair();
    const bob = await createBundle(true);

    // Alice performs X3DH initiator
    const aliceResult = await x3dhInitiator(aliceIdentityKP, bob.bundle);

    expect(aliceResult.sharedKey).toBeDefined();
    expect(aliceResult.sharedKey.length).toBe(32);
    expect(aliceResult.ephemeralPublicKey).toBeTruthy();
    expect(aliceResult.usedOneTimeKeyId).toBe(0);

    // Bob performs X3DH responder
    const senderIdentityKey = await exportPublicKey(aliceIdentityKP.publicKey);
    const bobResult = await x3dhResponder(
      bob.identityKP,
      bob.signedPreKP,
      bob.oneTimeKP,
      senderIdentityKey,
      aliceResult.ephemeralPublicKey
    );

    expect(bobResult.sharedKey).toBeDefined();
    expect(bobResult.sharedKey.length).toBe(32);

    // Both should derive the SAME shared key
    expect(arrayBufferToBase64(aliceResult.sharedKey))
      .toBe(arrayBufferToBase64(bobResult.sharedKey));
  });

  it('initiator and responder derive the same shared key (without OTK)', async () => {
    const aliceIdentityKP = await generateECDHKeyPair();
    const bob = await createBundle(false);

    const aliceResult = await x3dhInitiator(aliceIdentityKP, bob.bundle);

    expect(aliceResult.usedOneTimeKeyId).toBeNull();

    const senderIdentityKey = await exportPublicKey(aliceIdentityKP.publicKey);
    const bobResult = await x3dhResponder(
      bob.identityKP,
      bob.signedPreKP,
      null, // no OTK
      senderIdentityKey,
      aliceResult.ephemeralPublicKey
    );

    expect(arrayBufferToBase64(aliceResult.sharedKey))
      .toBe(arrayBufferToBase64(bobResult.sharedKey));
  });

  it('shared key differs with different identity keys', async () => {
    const alice1 = await generateECDHKeyPair();
    const alice2 = await generateECDHKeyPair();
    const bob = await createBundle(true);

    const result1 = await x3dhInitiator(alice1, bob.bundle);
    const result2 = await x3dhInitiator(alice2, bob.bundle);

    // Different identity keys → different shared secrets
    expect(arrayBufferToBase64(result1.sharedKey))
      .not.toBe(arrayBufferToBase64(result2.sharedKey));
  });

  it('rejects invalid signed pre-key signature (MITM prevention)', async () => {
    const aliceIdentityKP = await generateECDHKeyPair();
    const bob = await createBundle(true);

    // Tamper with the signature
    bob.bundle.signedPreKeySignature = bob.bundle.signedPreKeySignature
      .replace(/^./, 'X'); // corrupt first char

    await expect(x3dhInitiator(aliceIdentityKP, bob.bundle))
      .rejects.toThrow(/signature|MITM/i);
  });

  it('associated data is consistent between parties', async () => {
    const aliceIdentityKP = await generateECDHKeyPair();
    const bob = await createBundle(true);

    const aliceResult = await x3dhInitiator(aliceIdentityKP, bob.bundle);

    const senderIdentityKey = await exportPublicKey(aliceIdentityKP.publicKey);
    const bobResult = await x3dhResponder(
      bob.identityKP,
      bob.signedPreKP,
      bob.oneTimeKP,
      senderIdentityKey,
      aliceResult.ephemeralPublicKey
    );

    expect(aliceResult.associatedData).toBe(bobResult.associatedData);
  });

  it('each session produces unique ephemeral key', async () => {
    const aliceIdentityKP = await generateECDHKeyPair();
    const bob = await createBundle(true);

    const result1 = await x3dhInitiator(aliceIdentityKP, bob.bundle);
    const result2 = await x3dhInitiator(aliceIdentityKP, bob.bundle);

    expect(result1.ephemeralPublicKey).not.toBe(result2.ephemeralPublicKey);
  });
});
