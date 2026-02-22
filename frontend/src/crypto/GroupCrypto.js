/**
 * GroupCrypto — E2E encryption for group chat rooms.
 *
 * Uses a shared AES-256-GCM key per room, distributed to members
 * via pairwise E2E (Double Ratchet) through GROUP_KEY messages.
 *
 * Flow:
 *   1. Room creator generates a random group key
 *   2. Key is distributed to each member via 1:1 E2E encrypted GROUP_KEY messages
 *   3. All messages in the group are encrypted with the shared key (AES-256-GCM)
 *   4. On member change (join/leave), a new key is generated and re-distributed
 */

import cryptoStore from './CryptoStore';
import e2eManager from './E2EManager';
import { aesEncryptBuffer, aesDecryptBuffer, arrayBufferToBase64, base64ToUint8 } from './utils';

class GroupCrypto {

  /**
   * Generate a new group key for a room and store locally.
   * @returns {string} base64-encoded AES-256 key
   */
  async generateGroupKey(roomId) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const keyB64 = arrayBufferToBase64(raw);
    await cryptoStore.saveGroupKey(roomId, keyB64);
    return keyB64;
  }

  /**
   * Get stored group key for a room.
   * @returns {string|null}
   */
  async getGroupKey(roomId) {
    return cryptoStore.getGroupKey(roomId);
  }

  /**
   * Check if we have a group key for a room.
   */
  async hasGroupKey(roomId) {
    return (await this.getGroupKey(roomId)) != null;
  }

  /**
   * Encrypt a plaintext message for a group room.
   * @returns {{ encrypted, encryptedContent, iv, groupEncrypted }}
   */
  async encrypt(roomId, plaintext) {
    const keyB64 = await this.getGroupKey(roomId);
    if (!keyB64) throw new Error(`No group key for room ${roomId}`);

    const keyBytes = base64ToUint8(keyB64);
    const encoded = new TextEncoder().encode(plaintext || '');
    const { ciphertext, iv } = await aesEncryptBuffer(encoded, keyBytes);

    return {
      encrypted: true,
      groupEncrypted: true,
      encryptedContent: arrayBufferToBase64(new Uint8Array(ciphertext)),
      iv: arrayBufferToBase64(iv),
    };
  }

  /**
   * Decrypt a group-encrypted message.
   * @returns {{ text, fileKey?, thumbnailKey? }}
   */
  async decrypt(roomId, encryptedContent, iv) {
    const keyB64 = await this.getGroupKey(roomId);
    if (!keyB64) throw new Error(`No group key for room ${roomId}`);

    const keyBytes = base64ToUint8(keyB64);
    const encData = base64ToUint8(encryptedContent);
    const ivData = base64ToUint8(iv);
    const plainBuffer = await aesDecryptBuffer(encData, ivData, keyBytes);
    const plaintext = new TextDecoder().decode(plainBuffer);

    // Payload may be JSON with { text, fileKey, thumbnailKey }
    try {
      const parsed = JSON.parse(plaintext);
      if (parsed.text !== undefined) return parsed;
    } catch {
      // Plain text, not JSON
    }
    return { text: plaintext };
  }

  /**
   * Distribute the group key to all members via 1:1 E2E messages.
   * Sends GROUP_KEY signaling message to each member.
   */
  async distributeKey(ws, roomId, members, myUsername, token) {
    const keyB64 = await this.getGroupKey(roomId);
    if (!keyB64 || !ws || ws.readyState !== WebSocket.OPEN) return;

    for (const member of members) {
      if (member === myUsername) continue;
      try {
        const hasE2E = await e2eManager.peerHasE2E(token, member);
        if (!hasE2E) continue;

        // Encrypt group key with pairwise Double Ratchet
        const encrypted = await e2eManager.encrypt(member, keyB64, token);
        ws.send(JSON.stringify({
          type: 'GROUP_KEY',
          extra: { target: member, roomId },
          ...encrypted,
        }));
      } catch (err) {
        console.error(`[GroupE2E] Key distribution to ${member} failed:`, err);
      }
    }
  }

  /**
   * Handle an incoming GROUP_KEY message — decrypt and store the key.
   */
  async receiveKey(senderUsername, roomId, msg) {
    try {
      const result = await e2eManager.decrypt(senderUsername, msg);
      if (result.text) {
        await cryptoStore.saveGroupKey(roomId, result.text);
        console.log(`[GroupE2E] Received key for room ${roomId} from ${senderUsername}`);
        return true;
      }
    } catch (err) {
      console.error(`[GroupE2E] Key decryption failed from ${senderUsername}:`, err);
    }
    return false;
  }
}

export default new GroupCrypto();
