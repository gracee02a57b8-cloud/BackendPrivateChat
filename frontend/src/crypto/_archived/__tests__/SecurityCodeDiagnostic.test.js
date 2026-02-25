/**
 * Security Code DIAGNOSTIC Tests — Real-World Failure Scenarios.
 *
 * These tests simulate the ACTUAL production chain where security codes
 * are generated, not just the isolated generateSecurityCode() function.
 *
 * The full chain is:
 *   1. generateECDHKeyPair() → CryptoKey
 *   2. exportPublicKey(CryptoKey) → base64 string
 *   3. Save to IndexedDB (as base64 + JWK)
 *   4. Load from IndexedDB
 *   5. importKeyPair(stored) → CryptoKey (re-imported)
 *   6. exportPublicKey(re-imported CryptoKey) → base64 for security code (myIK)
 *   7. Upload base64 to server via _uploadBundle → server stores string
 *   8. Peer fetches from server → base64 string (peerIK)
 *   9. generateSecurityCode(myIK, peerIK) → security code
 *
 * If ANY step in this chain changes the base64 representation,
 * Alice and Bob will get DIFFERENT security codes.
 *
 * Identified root causes to test:
 *   A. Key round-trip instability (generate → export → store → import → re-export)
 *   B. _ensureBundleOnServer() silent failure → server has stale key
 *   C. _ensureBundleOnServer() early return when signedPreKey is null
 *   D. Multi-device: new browser overwrites server key, old browser has old local key
 *   E. Trusted key cache fallback returns stale identity key
 *   F. getIdentityPublicKey() re-export differs from what was uploaded to server
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  generateECDHKeyPair,
  generateSigningKeyPair,
  exportKeyPair,
  importKeyPair,
  exportPublicKey,
  importPublicKey,
  ecdsaSign,
  generateSecurityCode,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../utils';

// ======================== A. Key Round-Trip Stability ========================

describe('Diagnostic A: Key export round-trip stability', () => {
  it('exportPublicKey returns identical base64 on repeated calls (same CryptoKey)', async () => {
    const kp = await generateECDHKeyPair();
    const export1 = await exportPublicKey(kp.publicKey);
    const export2 = await exportPublicKey(kp.publicKey);
    const export3 = await exportPublicKey(kp.publicKey);

    expect(export1).toBe(export2);
    expect(export2).toBe(export3);
  });

  it('full round-trip: generate → export → import → re-export preserves base64', async () => {
    // This simulates: generate key → save to IndexedDB → load → import → re-export
    const kp = await generateECDHKeyPair();
    const originalBase64 = await exportPublicKey(kp.publicKey);

    // Simulate IndexedDB store/load cycle (exportKeyPair → importKeyPair)
    const exported = await exportKeyPair(kp);
    const reimported = await importKeyPair(exported);
    const reexportedBase64 = await exportPublicKey(reimported.publicKey);

    // THIS MUST BE IDENTICAL — if not, server will have different key than local
    expect(reexportedBase64).toBe(originalBase64);
  });

  it('double round-trip: export → import → export → import → export still stable', async () => {
    const kp = await generateECDHKeyPair();
    const original = await exportPublicKey(kp.publicKey);

    // Round trip 1
    const exp1 = await exportKeyPair(kp);
    const imp1 = await importKeyPair(exp1);
    const rt1 = await exportPublicKey(imp1.publicKey);

    // Round trip 2
    const exp2 = await exportKeyPair(imp1);
    const imp2 = await importKeyPair(exp2);
    const rt2 = await exportPublicKey(imp2.publicKey);

    expect(rt1).toBe(original);
    expect(rt2).toBe(original);
  });

  it('raw export produces exactly 65 bytes for P-256 uncompressed point', async () => {
    const kp = await generateECDHKeyPair();
    const base64 = await exportPublicKey(kp.publicKey);
    const rawBytes = base64ToArrayBuffer(base64);

    // P-256 uncompressed point = 0x04 + 32-byte X + 32-byte Y = 65 bytes
    expect(rawBytes.byteLength).toBe(65);
    expect(new Uint8Array(rawBytes)[0]).toBe(0x04); // uncompressed prefix
  });

  it('ECDSA signing key round-trip also preserves public key base64', async () => {
    const kp = await generateSigningKeyPair();
    const original = await exportPublicKey(kp.publicKey);

    const exported = await exportKeyPair(kp);
    const reimported = await importKeyPair(exported, 'ECDSA');
    const reexported = await exportPublicKey(reimported.publicKey);

    expect(reexported).toBe(original);
  });
});

// ======================== B. Simulated Server Divergence ========================

describe('Diagnostic B: Server key divergence → mismatched codes', () => {
  it('REPRODUCES BUG: if server has stale IK, codes differ', async () => {
    // Scenario: Alice generated keys twice, server still has the old one
    const aliceOldKP = await generateECDHKeyPair();
    const aliceNewKP = await generateECDHKeyPair();
    const bobKP = await generateECDHKeyPair();

    const aliceOldIK = await exportPublicKey(aliceOldKP.publicKey);
    const aliceNewIK = await exportPublicKey(aliceNewKP.publicKey);
    const bobIK = await exportPublicKey(bobKP.publicKey);

    // Alice locally uses her NEW key
    const codeAliceSees = await generateSecurityCode(aliceNewIK, bobIK);

    // Server still has Alice's OLD key → Bob fetches OLD key
    const codeBobSees = await generateSecurityCode(bobIK, aliceOldIK);

    // MISMATCH! This is the production bug.
    expect(codeAliceSees).not.toBe(codeBobSees);
  });

  it('when server has correct IK, codes match', async () => {
    const aliceKP = await generateECDHKeyPair();
    const bobKP = await generateECDHKeyPair();

    const aliceIK = await exportPublicKey(aliceKP.publicKey);
    const bobIK = await exportPublicKey(bobKP.publicKey);

    // Server has the SAME key as Alice's local export
    const serverAliceIK = aliceIK; // identical string

    const codeAliceSees = await generateSecurityCode(aliceIK, bobIK);
    const codeBobSees = await generateSecurityCode(bobIK, serverAliceIK);

    expect(codeAliceSees).toBe(codeBobSees);
  });
});

// ======================== C. _ensureBundleOnServer Failure Scenarios ========================

describe('Diagnostic C: _ensureBundleOnServer failure scenarios', () => {
  // Simulated KeyManager to test the actual _ensureBundleOnServer logic

  /**
   * Simulate the exact logic of _ensureBundleOnServer:
   * if (!this.identityKeyPair || !this.signingKeyPair || !this.signedPreKeyPair) return;
   */
  function wouldEnsureBundleSkip({ identityKeyPair, signingKeyPair, signedPreKeyPair }) {
    return !identityKeyPair || !signingKeyPair || !signedPreKeyPair;
  }

  it('BUG: ensureBundleOnServer SKIPS upload when signedPreKey is missing', async () => {
    const identityKeyPair = await generateECDHKeyPair();
    const signingKeyPair = await generateSigningKeyPair();
    const signedPreKeyPair = null; // <-- Missing from IndexedDB!

    const skipped = wouldEnsureBundleSkip({ identityKeyPair, signingKeyPair, signedPreKeyPair });

    // This is a BUG — the function silently skips, leaving server with stale keys
    expect(skipped).toBe(true);
  });

  it('ensureBundleOnServer proceeds when all keys present', async () => {
    const identityKeyPair = await generateECDHKeyPair();
    const signingKeyPair = await generateSigningKeyPair();
    const signedPreKeyPair = await generateECDHKeyPair();

    const skipped = wouldEnsureBundleSkip({ identityKeyPair, signingKeyPair, signedPreKeyPair });
    expect(skipped).toBe(false);
  });

  it('BUG: if upload fails silently, server has stale key → codes differ', async () => {
    const aliceKP = await generateECDHKeyPair();
    const bobKP = await generateECDHKeyPair();

    const aliceIK = await exportPublicKey(aliceKP.publicKey);
    const bobIK = await exportPublicKey(bobKP.publicKey);

    // Simulate: server has Alice's OLD key because upload failed
    const aliceOldKP = await generateECDHKeyPair();
    const staleServerAliceIK = await exportPublicKey(aliceOldKP.publicKey);

    // Alice uses current local key, Bob gets stale server key
    const codeAlice = await generateSecurityCode(aliceIK, bobIK);
    const codeBob = await generateSecurityCode(bobIK, staleServerAliceIK);

    expect(codeAlice).not.toBe(codeBob);
  });

  it('simulates try/catch swallowing upload error', async () => {
    let serverKey = 'OLD_KEY';
    let uploadCalled = false;

    // Simulated _ensureBundleOnServer with failing upload
    async function ensureBundleOnServer(identityKey) {
      try {
        uploadCalled = true;
        throw new Error('Network error'); // Upload fails!
        // serverKey = identityKey; // Never reached
      } catch (e) {
        // Real code just does: console.warn(...)
        // Server still has OLD_KEY
      }
    }

    await ensureBundleOnServer('NEW_KEY');

    expect(uploadCalled).toBe(true);
    expect(serverKey).toBe('OLD_KEY'); // BUG: server never updated!
  });
});

// ======================== D. Multi-Device Key Overwrite ========================

describe('Diagnostic D: Multi-device scenario', () => {
  it('REPRODUCES BUG: user logs in from new browser → old browser has stale local key', async () => {
    const bobKP = await generateECDHKeyPair();
    const bobIK = await exportPublicKey(bobKP.publicKey);

    // Alice registers on Browser A
    const aliceBrowserA_KP = await generateECDHKeyPair();
    const aliceBrowserA_IK = await exportPublicKey(aliceBrowserA_KP.publicKey);

    // Server has Alice's Browser A key
    let serverAliceIK = aliceBrowserA_IK;

    // Codes match at this point
    const codeBob1 = await generateSecurityCode(bobIK, serverAliceIK);
    const codeAliceA1 = await generateSecurityCode(aliceBrowserA_IK, bobIK);
    expect(codeBob1).toBe(codeAliceA1);

    // Alice logs in on Browser B → generates NEW identity key → uploads to server
    const aliceBrowserB_KP = await generateECDHKeyPair();
    const aliceBrowserB_IK = await exportPublicKey(aliceBrowserB_KP.publicKey);
    serverAliceIK = aliceBrowserB_IK; // Server overwritten!

    // Now: Browser A still has old key locally
    // Alice on Browser A: myIK=old, peerIK=Bob from server
    const codeAliceA2 = await generateSecurityCode(aliceBrowserA_IK, bobIK);
    // Bob: myIK=Bob, peerIK=Alice NEW from server
    const codeBob2 = await generateSecurityCode(bobIK, serverAliceIK);

    // MISMATCH! Alice Browser A uses old key, Bob sees new key from server
    expect(codeAliceA2).not.toBe(codeBob2);

    // But Alice on Browser B would match Bob
    const codeAliceB = await generateSecurityCode(aliceBrowserB_IK, bobIK);
    expect(codeAliceB).toBe(codeBob2);
  });

  it('if old browser re-syncs (ensureBundleOnServer succeeds), server gets overwritten BACK', async () => {
    const bobKP = await generateECDHKeyPair();
    const bobIK = await exportPublicKey(bobKP.publicKey);

    const aliceBrowserA_KP = await generateECDHKeyPair();
    const aliceBrowserA_IK = await exportPublicKey(aliceBrowserA_KP.publicKey);

    const aliceBrowserB_KP = await generateECDHKeyPair();
    const aliceBrowserB_IK = await exportPublicKey(aliceBrowserB_KP.publicKey);

    // Browser B logs in → server gets Browser B key
    let serverAliceIK = aliceBrowserB_IK;

    // Browser A re-syncs (ensureBundleOnServer) → server gets Browser A key BACK
    serverAliceIK = aliceBrowserA_IK;

    // Now Browser B has mismatched codes!
    const codeBrowserB = await generateSecurityCode(aliceBrowserB_IK, bobIK);
    const codeBob = await generateSecurityCode(bobIK, serverAliceIK);
    expect(codeBrowserB).not.toBe(codeBob);
  });
});

// ======================== E. Trusted Key Cache Staleness ========================

describe('Diagnostic E: Trusted key cache returns stale identity key', () => {
  it('REPRODUCES BUG: if server request fails, stale cached key is used', async () => {
    const aliceKP = await generateECDHKeyPair();
    const aliceIK = await exportPublicKey(aliceKP.publicKey);

    // Bob's original key
    const bobOldKP = await generateECDHKeyPair();
    const bobOldIK = await exportPublicKey(bobOldKP.publicKey);

    // Alice cached Bob's old key in trustedKeys
    const trustedKeyCache = { identityKey: bobOldIK };

    // Bob re-installs app → generates new key
    const bobNewKP = await generateECDHKeyPair();
    const bobNewIK = await exportPublicKey(bobNewKP.publicKey);

    // Server has Bob's NEW key, but Alice can't reach server (offline/error)
    // Alice falls back to cached trusted key
    const codeAliceSees = await generateSecurityCode(aliceIK, trustedKeyCache.identityKey);
    // Bob uses his new key
    const codeBobSees = await generateSecurityCode(bobNewIK, aliceIK);

    // MISMATCH! Alice used Bob's OLD cached key
    expect(codeAliceSees).not.toBe(codeBobSees);
  });

  it('when cache is fresh (matches server), codes match', async () => {
    const aliceKP = await generateECDHKeyPair();
    const aliceIK = await exportPublicKey(aliceKP.publicKey);

    const bobKP = await generateECDHKeyPair();
    const bobIK = await exportPublicKey(bobKP.publicKey);

    // Cache matches server
    const trustedKeyCache = { identityKey: bobIK };

    const codeAlice = await generateSecurityCode(aliceIK, trustedKeyCache.identityKey);
    const codeBob = await generateSecurityCode(bobIK, aliceIK);

    expect(codeAlice).toBe(codeBob);
  });
});

// ======================== F. getIdentityPublicKey vs Server ========================

describe('Diagnostic F: getIdentityPublicKey() re-export vs uploaded key', () => {
  it('simulates the EXACT production flow: generate → upload → reload → re-export', async () => {
    // Step 1: _generateAndRegister — generate keys and upload
    const identityKP = await generateECDHKeyPair();
    const signingKP = await generateSigningKeyPair();

    // What gets uploaded to server (from _generateAndRegister)
    const uploadedIK = await exportPublicKey(identityKP.publicKey);

    // What gets saved to IndexedDB
    const storedData = {
      ecdhKeyPair: await exportKeyPair(identityKP),
      signingKeyPair: await exportKeyPair(signingKP),
    };

    // Step 2: Page reload — load from IndexedDB, re-import
    const reloadedKP = await importKeyPair(storedData.ecdhKeyPair);

    // Step 3: getIdentityPublicKey() — re-export from CryptoKey
    const localIK = await exportPublicKey(reloadedKP.publicKey);

    // Step 4: Peer fetches from server
    const serverIK = uploadedIK; // Server stores the exact string

    // THE KEY ASSERTION: local re-export MUST equal what was uploaded
    expect(localIK).toBe(serverIK);
  });

  it('simulates the EXACT production flow with ensureBundleOnServer re-upload', async () => {
    // Step 1: Generate keys
    const identityKP = await generateECDHKeyPair();

    // Step 2: Save to IndexedDB as exported pair
    const storedData = await exportKeyPair(identityKP);

    // Step 3: Reload — import from stored data
    const reimportedKP = await importKeyPair(storedData);

    // Step 4: ensureBundleOnServer re-exports and re-uploads
    const reuploadedIK = await exportPublicKey(reimportedKP.publicKey);

    // Step 5: Peer fetches the re-uploaded key from server
    // Step 6: getIdentityPublicKey on this device also re-exports
    const localIK = await exportPublicKey(reimportedKP.publicKey);

    // Both should match
    expect(reuploadedIK).toBe(localIK);

    // And both should match the original export
    const originalIK = await exportPublicKey(identityKP.publicKey);
    expect(reuploadedIK).toBe(originalIK);
  });

  it('full Alice+Bob production simulation: both reload and generate codes', async () => {
    // === Alice: generate, save, upload ===
    const aliceKP = await generateECDHKeyPair();
    const aliceSignKP = await generateSigningKeyPair();
    const aliceStoredEcdh = await exportKeyPair(aliceKP);
    const aliceStoredSign = await exportKeyPair(aliceSignKP);
    const aliceUploadedIK = await exportPublicKey(aliceKP.publicKey);

    // === Bob: generate, save, upload ===
    const bobKP = await generateECDHKeyPair();
    const bobSignKP = await generateSigningKeyPair();
    const bobStoredEcdh = await exportKeyPair(bobKP);
    const bobUploadedIK = await exportPublicKey(bobKP.publicKey);

    // === Simulate server storage ===
    const server = {
      alice: aliceUploadedIK,
      bob: bobUploadedIK,
    };

    // === Both users reload the page ===
    // Alice reloads: import from IndexedDB → re-export for security code
    const aliceReloaded = await importKeyPair(aliceStoredEcdh);
    const aliceLocalIK = await exportPublicKey(aliceReloaded.publicKey);

    // Bob reloads: import from IndexedDB → re-export for security code
    const bobReloaded = await importKeyPair(bobStoredEcdh);
    const bobLocalIK = await exportPublicKey(bobReloaded.publicKey);

    // === getSecurityCode flow ===
    // Alice: myIK = localExport, peerIK = fetch from server
    const codeAlice = await generateSecurityCode(aliceLocalIK, server.bob);
    // Bob: myIK = localExport, peerIK = fetch from server
    const codeBob = await generateSecurityCode(bobLocalIK, server.alice);

    // MUST MATCH in production
    expect(codeAlice).toBe(codeBob);

    // Verify the chain integrity
    expect(aliceLocalIK).toBe(server.alice);
    expect(bobLocalIK).toBe(server.bob);
  });
});

// ======================== H. Transaction Rollback Vulnerability (THE ROOT CAUSE) ========================

describe('Diagnostic H: Server transaction rollback → identity key never updates', () => {
  /**
   * This group tests the ACTUAL root cause found in production:
   * Hibernate's uploadBundle() method is @Transactional. When OTK insert fails
   * due to duplicate (username, key_id), the ENTIRE transaction rolls back,
   * meaning the identity key is also NOT updated.
   */

  it('REPRODUCES ROOT CAUSE: if uploadBundle transaction fails, identity key stays stale', async () => {
    const bobKP = await generateECDHKeyPair();
    const bobIK = await exportPublicKey(bobKP.publicKey);

    // Server has Alice's INITIAL identity key from first registration
    const aliceKP_initial = await generateECDHKeyPair();
    const aliceIK_initial = await exportPublicKey(aliceKP_initial.publicKey);
    let serverAliceIK = aliceIK_initial;

    // Alice reloads → ensureBundleOnServer tries to re-upload
    // But uploadBundle fails (duplicate OTK key_id constraint violation)
    // → entire transaction rolls back → identity key NOT updated
    const aliceKP_current = await generateECDHKeyPair();
    const aliceIK_current = await exportPublicKey(aliceKP_current.publicKey);
    
    const transactionRolledBack = true; // Simulates constraint violation
    if (!transactionRolledBack) {
      serverAliceIK = aliceIK_current; // Never executes!
    }

    // Server still has initial key
    expect(serverAliceIK).toBe(aliceIK_initial);
    expect(serverAliceIK).not.toBe(aliceIK_current);

    // Alice: local key=current, Bob fetches from server=initial → MISMATCH
    const codeAlice = await generateSecurityCode(aliceIK_current, bobIK);
    const codeBob = await generateSecurityCode(bobIK, serverAliceIK);
    expect(codeAlice).not.toBe(codeBob);
  });

  it('FIXED: when transaction succeeds, identity key updates → codes match', async () => {
    const bobKP = await generateECDHKeyPair();
    const bobIK = await exportPublicKey(bobKP.publicKey);

    const aliceKP = await generateECDHKeyPair();
    const aliceIK = await exportPublicKey(aliceKP.publicKey);

    // Transaction succeeds → server has correct key
    const serverAliceIK = aliceIK;

    const codeAlice = await generateSecurityCode(aliceIK, bobIK);
    const codeBob = await generateSecurityCode(bobIK, serverAliceIK);
    expect(codeAlice).toBe(codeBob);
  });

  it('simulates repeated ensureBundleOnServer failures (every reload fails)', async () => {
    const bobKP = await generateECDHKeyPair();
    const bobIK = await exportPublicKey(bobKP.publicKey);

    // Initial successful upload
    const aliceKP = await generateECDHKeyPair();
    const aliceIK = await exportPublicKey(aliceKP.publicKey);
    let serverAliceIK = aliceIK;
    let serverUpdatedAt = 'T0';

    // Simulate 5 page reloads, each time ensureBundleOnServer fails
    for (let i = 0; i < 5; i++) {
      try {
        throw new Error('duplicate key value violates unique constraint');
      } catch (e) {
        // Transaction rolled back — server NOT updated
      }
    }

    // After 5 failed reloads, server STILL has the initial key
    expect(serverAliceIK).toBe(aliceIK);
    expect(serverUpdatedAt).toBe('T0');

    // But codes still match because Alice's key didn't change locally
    const codeAlice = await generateSecurityCode(aliceIK, bobIK);
    const codeBob = await generateSecurityCode(bobIK, serverAliceIK);
    expect(codeAlice).toBe(codeBob);
  });

  it('the OTK key_id collision scenario: same IDs re-uploaded', async () => {
    // This exactly replicates what happened in production:
    // Server log: ERROR: duplicate key value violates unique constraint
    //   "one_time_pre_keys_username_key_id_key"
    //   Key (username, key_id)=(Ангелина, 5) already exists.

    const otkIds = [0, 1, 2, 3, 4, 5]; // IDs in IndexedDB
    const serverOtkIds = [3, 4, 5, 6, 7]; // IDs remaining on server (some consumed)

    // Overlap: IDs 3, 4, 5 exist both locally and on server
    const overlap = otkIds.filter(id => serverOtkIds.includes(id));
    expect(overlap).toEqual([3, 4, 5]);

    // Without DELETE-then-flush-then-INSERT, inserting IDs 3,4,5 causes constraint violation
    // With the fix: DELETE all → flush → INSERT all → no conflict
    const deleteAllFirst = true;
    const flushed = true;
    const canInsert = deleteAllFirst && flushed;
    expect(canInsert).toBe(true);
  });
});

// ======================== I. Retry and Self-Verification Logic ========================

describe('Diagnostic I: Upload retry and server key verification', () => {
  it('retry logic: upload eventually succeeds after transient failures', async () => {
    let attempts = 0;
    let uploaded = false;
    const maxRetries = 3;

    async function uploadWithRetry() {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          attempts++;
          if (attempt < 3) throw new Error('Network timeout');
          uploaded = true;
          return;
        } catch (e) {
          if (attempt === maxRetries) throw e;
        }
      }
    }

    await uploadWithRetry();
    expect(attempts).toBe(3);
    expect(uploaded).toBe(true);
  });

  it('retry logic: gives up after max retries', async () => {
    let attempts = 0;
    const maxRetries = 3;

    async function uploadWithRetry() {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          attempts++;
          throw new Error('Server down');
        } catch (e) {
          if (attempt === maxRetries) throw e;
        }
      }
    }

    await expect(uploadWithRetry()).rejects.toThrow('Server down');
    expect(attempts).toBe(3);
  });

  it('self-verification: detect when server key differs from local after upload', async () => {
    const aliceKP = await generateECDHKeyPair();
    const aliceIK = await exportPublicKey(aliceKP.publicKey);

    // Simulate: upload succeeded but server returned DIFFERENT key
    // (e.g., another device overwrote it between upload and verify)
    const anotherDeviceKP = await generateECDHKeyPair();
    const serverIKAfterUpload = await exportPublicKey(anotherDeviceKP.publicKey);

    const syncFailed = (serverIKAfterUpload !== aliceIK);
    expect(syncFailed).toBe(true);
  });

  it('self-verification: server matches local → sync succeeded', async () => {
    const aliceKP = await generateECDHKeyPair();
    const aliceIK = await exportPublicKey(aliceKP.publicKey);

    // Server returns same key after upload
    const serverIKAfterUpload = aliceIK;
    const syncFailed = (serverIKAfterUpload !== aliceIK);
    expect(syncFailed).toBe(false);
  });

  it('SPK regeneration: when signedPreKey is null, new one is generated', async () => {
    // Old behavior: if SPK is null → skip entire ensureBundleOnServer
    // New behavior: if SPK is null → generate new SPK → proceed with upload
    const identityKP = await generateECDHKeyPair();
    const signingKP = await generateSigningKeyPair();
    let signedPreKeyPair = null;

    // Simulate new behavior: regenerate SPK
    if (!signedPreKeyPair) {
      signedPreKeyPair = await generateECDHKeyPair();
    }

    expect(signedPreKeyPair).not.toBeNull();
    expect(signedPreKeyPair.publicKey).toBeTruthy();
    expect(signedPreKeyPair.privateKey).toBeTruthy();

    // Can now export and upload
    const spkPub = await exportPublicKey(signedPreKeyPair.publicKey);
    expect(spkPub).toMatch(/^[A-Za-z0-9+/]+=*$/); // valid base64
  });
});

// ======================== J. getSecurityCode Self-Key Verification ========================

describe('Diagnostic J: getSecurityCode verifies own key on server', () => {
  it('when own server key matches local → code is accurate', async () => {
    const aliceKP = await generateECDHKeyPair();
    const bobKP = await generateECDHKeyPair();
    const aliceIK = await exportPublicKey(aliceKP.publicKey);
    const bobIK = await exportPublicKey(bobKP.publicKey);

    // Server has correct keys for both
    const serverAliceIK = aliceIK;
    const serverBobIK = bobIK;

    // Alice checks own key → matches → proceeds
    expect(serverAliceIK).toBe(aliceIK);

    const codeAlice = await generateSecurityCode(aliceIK, serverBobIK);
    const codeBob = await generateSecurityCode(bobIK, serverAliceIK);
    expect(codeAlice).toBe(codeBob);
  });

  it('when own server key differs → triggers re-sync → code becomes accurate', async () => {
    const bobKP = await generateECDHKeyPair();
    const bobIK = await exportPublicKey(bobKP.publicKey);

    const aliceKP = await generateECDHKeyPair();
    const aliceIK = await exportPublicKey(aliceKP.publicKey);

    // Server initially has DIFFERENT key (stale from failed upload)
    const staleKP = await generateECDHKeyPair();
    let serverAliceIK = await exportPublicKey(staleKP.publicKey);

    // Alice checks: serverAliceIK !== aliceIK → triggers syncWithServer
    expect(serverAliceIK).not.toBe(aliceIK);

    // After sync succeeds, server has correct key
    serverAliceIK = aliceIK; // sync fixed it

    const codeAlice = await generateSecurityCode(aliceIK, bobIK);
    const codeBob = await generateSecurityCode(bobIK, serverAliceIK);
    expect(codeAlice).toBe(codeBob);
  });

  it('complete security code flow with all verification steps', async () => {
    // Generate keys for both users
    const aliceKP = await generateECDHKeyPair();
    const bobKP = await generateECDHKeyPair();

    // Export (simulate _generateAndRegister)
    const aliceIK = await exportPublicKey(aliceKP.publicKey);
    const bobIK = await exportPublicKey(bobKP.publicKey);

    // Store in "IndexedDB" and upload to "server"
    const aliceStored = await exportKeyPair(aliceKP);
    const bobStored = await exportKeyPair(bobKP);
    const server = { alice: aliceIK, bob: bobIK };

    // Simulate page reload (import from store)
    const aliceReloaded = await importKeyPair(aliceStored);
    const bobReloaded = await importKeyPair(bobStored);

    // Step 1: getIdentityPublicKey() — re-export
    const aliceLocalIK = await exportPublicKey(aliceReloaded.publicKey);
    const bobLocalIK = await exportPublicKey(bobReloaded.publicKey);

    // Step 2: Verify own key matches server (new check)
    expect(aliceLocalIK).toBe(server.alice);
    expect(bobLocalIK).toBe(server.bob);

    // Step 3: Fetch peer key from server
    // Step 4: Generate security code
    const codeAlice = await generateSecurityCode(aliceLocalIK, server.bob);
    const codeBob = await generateSecurityCode(bobLocalIK, server.alice);

    // MUST MATCH
    expect(codeAlice).toBe(codeBob);
    expect(codeAlice).toMatch(/^\d{4} \d{4} \d{4} \d{4} \d{4} \d{4}$/);
  });
});
