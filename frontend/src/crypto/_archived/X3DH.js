/**
 * X3DH — Extended Triple Diffie-Hellman key agreement protocol.
 * Establishes a shared secret between two parties for Double Ratchet initialization.
 *
 * Alice (initiator) → Bob (responder):
 *   DH1 = ECDH(IK_A, SPK_B)
 *   DH2 = ECDH(EK_A, IK_B)
 *   DH3 = ECDH(EK_A, SPK_B)
 *   DH4 = ECDH(EK_A, OPK_B)  [if OPK available]
 *   SK  = HKDF(DH1 || DH2 || DH3 [|| DH4])
 */

import {
  generateECDHKeyPair, exportPublicKey, importPublicKey,
  ecdh, hkdf, ecdsaVerify, concatBytes,
} from './utils';

const INFO = 'BarsikChat_X3DH';

/**
 * Initiator side (Alice): perform X3DH with Bob's key bundle.
 * @returns {{ sharedKey, ephemeralPublicKey, usedOneTimeKeyId, associatedData }}
 */
export async function x3dhInitiator(identityKeyPair, peerBundle) {
  // Import Bob's public keys
  const ikB = await importPublicKey(peerBundle.identityKey);
  const spkB = await importPublicKey(peerBundle.signedPreKey);

  // Verify SPK signature
  const signingKeyB = await importPublicKey(peerBundle.signingKey, 'ECDSA');
  const sigValid = await ecdsaVerify(signingKeyB, peerBundle.signedPreKeySignature, peerBundle.signedPreKey);
  if (!sigValid) throw new Error('Invalid signed pre-key signature — possible MITM');

  // Generate ephemeral key
  const ephemeralKP = await generateECDHKeyPair();

  // Compute DH values
  const dh1 = await ecdh(identityKeyPair.privateKey, spkB);  // IK_A × SPK_B
  const dh2 = await ecdh(ephemeralKP.privateKey, ikB);        // EK_A × IK_B
  const dh3 = await ecdh(ephemeralKP.privateKey, spkB);       // EK_A × SPK_B

  let dhConcat = concatBytes(dh1, dh2, dh3);
  let usedOneTimeKeyId = null;

  // DH4 with one-time pre-key if available
  if (peerBundle.oneTimeKey) {
    const opkB = await importPublicKey(peerBundle.oneTimeKey);
    const dh4 = await ecdh(ephemeralKP.privateKey, opkB);
    dhConcat = concatBytes(dhConcat, dh4);
    usedOneTimeKeyId = peerBundle.oneTimeKeyId;
  }

  // Derive shared key
  const sharedKey = await hkdf(dhConcat, null, INFO, 32);
  const ephemeralPublicKey = await exportPublicKey(ephemeralKP.publicKey);
  const ikAPub = await exportPublicKey(identityKeyPair.publicKey);

  // Associated data: IK_A || IK_B
  const ad = ikAPub + '|' + peerBundle.identityKey;

  return {
    sharedKey,
    ephemeralPublicKey,
    usedOneTimeKeyId,
    associatedData: ad,
    peerIdentityKey: peerBundle.identityKey,
    peerSignedPreKey: peerBundle.signedPreKey,
  };
}

/**
 * Responder side (Bob): complete X3DH using the initial message info.
 * @param {Object} identityKeyPair - Bob's ECDH identity key pair
 * @param {Object} signedPreKeyPair - Bob's signed pre-key pair
 * @param {Object|null} oneTimeKeyPair - Bob's consumed OTK pair (or null)
 * @param {string} senderIdentityKeyB64 - Alice's identity public key (base64)
 * @param {string} ephemeralKeyB64 - Alice's ephemeral public key (base64)
 * @returns {{ sharedKey, associatedData }}
 */
export async function x3dhResponder(identityKeyPair, signedPreKeyPair, oneTimeKeyPair,
                                     senderIdentityKeyB64, ephemeralKeyB64) {
  const ikA = await importPublicKey(senderIdentityKeyB64);
  const ekA = await importPublicKey(ephemeralKeyB64);

  // Compute DH values (mirrored)
  const dh1 = await ecdh(signedPreKeyPair.privateKey, ikA);  // SPK_B × IK_A
  const dh2 = await ecdh(identityKeyPair.privateKey, ekA);   // IK_B × EK_A
  const dh3 = await ecdh(signedPreKeyPair.privateKey, ekA);  // SPK_B × EK_A

  let dhConcat = concatBytes(dh1, dh2, dh3);

  if (oneTimeKeyPair) {
    const dh4 = await ecdh(oneTimeKeyPair.privateKey, ekA);  // OPK_B × EK_A
    dhConcat = concatBytes(dhConcat, dh4);
  }

  const sharedKey = await hkdf(dhConcat, null, INFO, 32);
  const ikBPub = await exportPublicKey(identityKeyPair.publicKey);

  // AD must match initiator: IK_A || IK_B
  const ad = senderIdentityKeyB64 + '|' + ikBPub;

  return { sharedKey, associatedData: ad };
}
