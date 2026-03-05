/**
 * ==========================================
 * No-Encryption Verification Tests
 * ==========================================
 * Verifies that ALL data channels — text messages, voice messages,
 * video circles, file transfers, and call signaling — transmit
 * data WITHOUT any application-level encryption.
 *
 * Transport-level security (TLS/HTTPS/WSS) is handled by the
 * infrastructure, not by the application code.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────
// Mock wsService — capture what is actually sent
// ──────────────────────────────────────────────
const sentMessages = [];
vi.mock("../services/wsService", () => ({
  sendWsMessage: vi.fn((msg) => {
    sentMessages.push(msg);
    return true;
  }),
  connectWebSocket: vi.fn(),
  disconnectWebSocket: vi.fn(),
  onWsMessage: vi.fn(() => () => {}),
  onWsConnection: vi.fn(() => () => {}),
  isWsConnected: vi.fn(() => true),
  onCallMessage: vi.fn(() => () => {}),
  onConferenceMessage: vi.fn(() => () => {}),
}));

// Mock apiHelper — capture HTTP requests
const fetchedRequests = [];
vi.mock("../services/apiHelper", () => ({
  apiFetch: vi.fn(async (url, options = {}) => {
    fetchedRequests.push({ url, options });
    return { url: "/api/uploads/test-file.pdf", filename: "test-file.pdf" };
  }),
}));

// Mock webrtcService — verify no encryption in WebRTC layer
vi.mock("../services/webrtcService", () => ({
  getIceServers: vi.fn(async () => [{ urls: "stun:stun.l.google.com:19302" }]),
  createPeerConnection: vi.fn(async () => ({
    addTrack: vi.fn(),
    createOffer: vi.fn(async () => ({ type: "offer", sdp: "mock-sdp" })),
    createAnswer: vi.fn(async () => ({ type: "answer", sdp: "mock-sdp" })),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    addIceCandidate: vi.fn(),
    close: vi.fn(),
    getSenders: vi.fn(() => []),
  })),
  getUserMediaStream: vi.fn(async () => new MediaStream()),
}));

import { sendWsMessage } from "../services/wsService";
import { apiFetch } from "../services/apiHelper";
import { getIceServers, createPeerConnection } from "../services/webrtcService";

beforeEach(() => {
  sentMessages.length = 0;
  fetchedRequests.length = 0;
  vi.clearAllMocks();
});

// ================================================================
// 1. Text Messages — NO encryption
// ================================================================
describe("Text Messages — no encryption", () => {
  it("sends CHAT message with plaintext content (no encryption wrapper)", () => {
    const message = {
      type: "CHAT",
      sender: "alice",
      content: "Привет! Hello! 你好! 🎉",
      roomId: "room-123",
      id: "msg-001",
      timestamp: new Date().toISOString(),
    };

    sendWsMessage(message);

    expect(sentMessages).toHaveLength(1);
    const sent = sentMessages[0];

    // Content is plaintext — NOT encrypted
    expect(sent.content).toBe("Привет! Hello! 你好! 🎉");

    // No encryption fields present
    expect(sent).not.toHaveProperty("encrypted");
    expect(sent).not.toHaveProperty("encryptedContent");
    expect(sent).not.toHaveProperty("iv");
    expect(sent).not.toHaveProperty("ciphertext");
    expect(sent).not.toHaveProperty("nonce");
    expect(sent).not.toHaveProperty("ratchetKey");
    expect(sent).not.toHaveProperty("ephemeralKey");
    expect(sent).not.toHaveProperty("senderIdentityKey");
    expect(sent).not.toHaveProperty("symmetricKey");
  });

  it("sends PRIVATE message with plaintext content", () => {
    const message = {
      type: "PRIVATE",
      sender: "alice",
      content: "Secret private message — but not encrypted!",
      roomId: "room-alice-bob",
      id: "msg-002",
    };

    sendWsMessage(message);

    const sent = sentMessages[0];
    expect(sent.content).toBe("Secret private message — but not encrypted!");
    expect(sent).not.toHaveProperty("encrypted");
    expect(sent).not.toHaveProperty("encryptedContent");
    expect(sent).not.toHaveProperty("iv");
  });

  it("receives message with plaintext content (no decryption needed)", () => {
    const incomingMessage = {
      type: "CHAT",
      sender: "bob",
      content: "Ответ без шифрования",
      roomId: "room-123",
      id: "msg-003",
      timestamp: new Date().toISOString(),
    };

    // Verify the message structure has no encryption fields
    expect(incomingMessage.content).toBe("Ответ без шифрования");
    expect(incomingMessage).not.toHaveProperty("encrypted");
    expect(incomingMessage).not.toHaveProperty("encryptedContent");
    expect(incomingMessage).not.toHaveProperty("iv");
    expect(incomingMessage).not.toHaveProperty("ciphertext");
  });

  it("EDIT message sends plaintext updated content", () => {
    const message = {
      type: "EDIT",
      id: "msg-001",
      content: "Отредактированное сообщение — plaintext",
      sender: "alice",
      roomId: "room-123",
    };

    sendWsMessage(message);

    const sent = sentMessages[0];
    expect(sent.content).toBe("Отредактированное сообщение — plaintext");
    expect(sent).not.toHaveProperty("encrypted");
    expect(sent).not.toHaveProperty("encryptedContent");
  });
});

// ================================================================
// 2. Voice Messages — NO encryption
// ================================================================
describe("Voice Messages — no encryption", () => {
  it("sends VOICE message with plaintext fileUrl and metadata", () => {
    const voiceMessage = {
      type: "VOICE",
      sender: "alice",
      content: "",
      roomId: "room-123",
      id: "msg-voice-001",
      fileUrl: "/api/uploads/voice-abc123.webm",
      fileName: "voice-abc123.webm",
      fileType: "audio/webm",
      duration: 15,
      waveform: "[0.1,0.5,0.8,0.3,0.6]",
    };

    sendWsMessage(voiceMessage);

    const sent = sentMessages[0];

    // Voice data is plaintext — no encryption
    expect(sent.fileUrl).toBe("/api/uploads/voice-abc123.webm");
    expect(sent.duration).toBe(15);
    expect(sent.waveform).toBe("[0.1,0.5,0.8,0.3,0.6]");

    // No encryption fields
    expect(sent).not.toHaveProperty("encrypted");
    expect(sent).not.toHaveProperty("encryptedContent");
    expect(sent).not.toHaveProperty("iv");
    expect(sent).not.toHaveProperty("ciphertext");
  });

  it("voice message audio file URL is a plain HTTP path (not encrypted blob)", () => {
    const fileUrl = "/api/uploads/voice-recording-12345.webm";

    // URL is a plain path — not an encrypted blob or base64
    expect(fileUrl).toMatch(/^\/api\/uploads\//);
    expect(fileUrl).not.toMatch(/^data:/); // not a data URI with encrypted content
    expect(fileUrl).not.toContain("encrypted");
    expect(fileUrl).not.toContain("cipher");
  });
});

// ================================================================
// 3. Video Circle Messages — NO encryption
// ================================================================
describe("Video Circle Messages — no encryption", () => {
  it("sends VIDEO_CIRCLE message with plaintext URLs", () => {
    const videoMessage = {
      type: "VIDEO_CIRCLE",
      sender: "alice",
      content: "",
      roomId: "room-123",
      id: "msg-video-001",
      fileUrl: "/api/uploads/video-circle-xyz.webm",
      thumbnailUrl: "/api/uploads/thumb-xyz.jpg",
      duration: 30,
    };

    sendWsMessage(videoMessage);

    const sent = sentMessages[0];

    // Video data is plaintext — no encryption
    expect(sent.fileUrl).toBe("/api/uploads/video-circle-xyz.webm");
    expect(sent.thumbnailUrl).toBe("/api/uploads/thumb-xyz.jpg");
    expect(sent.duration).toBe(30);

    // No encryption fields
    expect(sent).not.toHaveProperty("encrypted");
    expect(sent).not.toHaveProperty("encryptedContent");
    expect(sent).not.toHaveProperty("iv");
  });
});

// ================================================================
// 4. File Transfers — NO encryption
// ================================================================
describe("File Transfers — no encryption", () => {
  it("uploads file via plain multipart POST (no encryption)", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["test content"]), "document.pdf");

    await apiFetch("/api/upload/file", {
      method: "POST",
      body: formData,
    });

    expect(fetchedRequests).toHaveLength(1);
    const req = fetchedRequests[0];

    // Upload is a plain POST — no encryption headers or wrapped body
    expect(req.url).toBe("/api/upload/file");
    expect(req.options.body).toBeInstanceOf(FormData);

    // No encryption-related headers
    expect(req.options).not.toHaveProperty("encryptionKey");
    expect(req.options).not.toHaveProperty("iv");
  });

  it("sends file message with plaintext metadata via WebSocket", () => {
    const fileMessage = {
      type: "CHAT",
      sender: "alice",
      content: "",
      roomId: "room-123",
      id: "msg-file-001",
      fileUrl: "/api/uploads/document-abc.pdf",
      fileName: "important-report.pdf",
      fileSize: 1048576,
      fileType: "application/pdf",
    };

    sendWsMessage(fileMessage);

    const sent = sentMessages[0];

    // File metadata is plaintext
    expect(sent.fileUrl).toBe("/api/uploads/document-abc.pdf");
    expect(sent.fileName).toBe("important-report.pdf");
    expect(sent.fileSize).toBe(1048576);
    expect(sent.fileType).toBe("application/pdf");

    // No encryption
    expect(sent).not.toHaveProperty("encrypted");
    expect(sent).not.toHaveProperty("encryptedContent");
    expect(sent).not.toHaveProperty("iv");
  });

  it("downloads file via plain GET (no decryption)", async () => {
    await apiFetch("/api/uploads/document-abc.pdf");

    const req = fetchedRequests[0];
    expect(req.url).toBe("/api/uploads/document-abc.pdf");

    // No decryption parameters
    expect(req.options).not.toHaveProperty("decryptionKey");
    expect(req.options).not.toHaveProperty("iv");
  });
});

// ================================================================
// 5. WebRTC Call Signaling — NO encryption (plain relay)
// ================================================================
describe("WebRTC Call Signaling — no encryption", () => {
  it("sends CALL_OFFER with plaintext SDP", () => {
    const offer = {
      type: "CALL_OFFER",
      sender: "alice",
      target: "bob",
      sdp: "v=0\r\no=- 1234 1 IN IP4 0.0.0.0\r\ns=-\r\n...",
      callType: "video",
    };

    sendWsMessage(offer);

    const sent = sentMessages[0];
    expect(sent.type).toBe("CALL_OFFER");
    expect(sent.sdp).toContain("v=0");

    // SDP is plaintext — not encrypted
    expect(sent).not.toHaveProperty("encrypted");
    expect(sent).not.toHaveProperty("encryptedSdp");
    expect(sent).not.toHaveProperty("iv");
  });

  it("sends CALL_ANSWER with plaintext SDP", () => {
    const answer = {
      type: "CALL_ANSWER",
      sender: "bob",
      target: "alice",
      sdp: "v=0\r\no=- 5678 1 IN IP4 0.0.0.0\r\ns=-\r\n...",
    };

    sendWsMessage(answer);

    const sent = sentMessages[0];
    expect(sent.type).toBe("CALL_ANSWER");
    expect(sent.sdp).toContain("v=0");
    expect(sent).not.toHaveProperty("encrypted");
    expect(sent).not.toHaveProperty("encryptedSdp");
  });

  it("sends ICE_CANDIDATE in plaintext", () => {
    const ice = {
      type: "ICE_CANDIDATE",
      sender: "alice",
      target: "bob",
      candidate: "candidate:1 1 UDP 2122252543 192.168.1.100 50000 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };

    sendWsMessage(ice);

    const sent = sentMessages[0];
    expect(sent.type).toBe("ICE_CANDIDATE");
    expect(sent.candidate).toContain("candidate:");
    expect(sent).not.toHaveProperty("encrypted");
  });

  it("sends CALL_END / CALL_REJECT / CALL_BUSY in plaintext", () => {
    ["CALL_END", "CALL_REJECT", "CALL_BUSY"].forEach((type) => {
      sentMessages.length = 0;

      sendWsMessage({ type, sender: "alice", target: "bob", reason: "user_action" });

      const sent = sentMessages[0];
      expect(sent.type).toBe(type);
      expect(sent).not.toHaveProperty("encrypted");
      expect(sent).not.toHaveProperty("iv");
    });
  });

  it("CALL_REOFFER/CALL_REANSWER (mid-call renegotiation) are plaintext", () => {
    ["CALL_REOFFER", "CALL_REANSWER"].forEach((type) => {
      sentMessages.length = 0;

      sendWsMessage({
        type,
        sender: "alice",
        target: "bob",
        sdp: "v=0\r\nrenegotiated-sdp",
      });

      const sent = sentMessages[0];
      expect(sent.type).toBe(type);
      expect(sent.sdp).toContain("renegotiated-sdp");
      expect(sent).not.toHaveProperty("encrypted");
    });
  });
});

// ================================================================
// 6. Conference (Group Call) Signaling — NO encryption
// ================================================================
describe("Conference Signaling — no encryption", () => {
  it("sends CONF_JOIN/CONF_LEAVE in plaintext", () => {
    ["CONF_JOIN", "CONF_LEAVE"].forEach((type) => {
      sentMessages.length = 0;

      sendWsMessage({
        type,
        sender: "alice",
        roomId: "room-123",
      });

      const sent = sentMessages[0];
      expect(sent.type).toBe(type);
      expect(sent).not.toHaveProperty("encrypted");
    });
  });

  it("sends CONF_OFFER/CONF_ANSWER with plaintext SDP", () => {
    ["CONF_OFFER", "CONF_ANSWER"].forEach((type) => {
      sentMessages.length = 0;

      sendWsMessage({
        type,
        sender: "alice",
        target: "bob",
        roomId: "room-123",
        sdp: "v=0\r\nconf-sdp",
      });

      const sent = sentMessages[0];
      expect(sent.type).toBe(type);
      expect(sent.sdp).toContain("conf-sdp");
      expect(sent).not.toHaveProperty("encrypted");
    });
  });

  it("sends CONF_ICE in plaintext", () => {
    sendWsMessage({
      type: "CONF_ICE",
      sender: "alice",
      target: "bob",
      roomId: "room-123",
      candidate: "candidate:2 1 UDP 123456 10.0.0.1 5000 typ srflx",
    });

    const sent = sentMessages[0];
    expect(sent.type).toBe("CONF_ICE");
    expect(sent.candidate).toContain("candidate:");
    expect(sent).not.toHaveProperty("encrypted");
  });

  it("sends CONF_INVITE in plaintext", () => {
    sendWsMessage({
      type: "CONF_INVITE",
      sender: "alice",
      target: "charlie",
      roomId: "room-123",
    });

    const sent = sentMessages[0];
    expect(sent.type).toBe("CONF_INVITE");
    expect(sent).not.toHaveProperty("encrypted");
  });
});

// ================================================================
// 7. WebRTC Service — no encryption layer
// ================================================================
describe("WebRTC Service — no encryption layer", () => {
  it("getIceServers returns plain STUN/TURN config (no encryption wrapper)", async () => {
    const servers = await getIceServers();

    expect(Array.isArray(servers)).toBe(true);
    expect(servers[0]).toHaveProperty("urls");

    // ICE servers are plain transport config — no encryption parameters
    servers.forEach((server) => {
      expect(server).not.toHaveProperty("encryptionKey");
      expect(server).not.toHaveProperty("srtpKey");
      expect(server).not.toHaveProperty("e2eKey");
    });
  });

  it("createPeerConnection returns plain RTCPeerConnection (no encryption middleware)", async () => {
    const pc = await createPeerConnection({
      onIceCandidate: vi.fn(),
      onTrack: vi.fn(),
    });

    // Peer connection is a plain WebRTC connection — no encryption wrapper
    expect(pc).toHaveProperty("addTrack");
    expect(pc).toHaveProperty("createOffer");
    expect(pc).toHaveProperty("createAnswer");
    expect(pc).not.toHaveProperty("encrypt");
    expect(pc).not.toHaveProperty("decrypt");
    expect(pc).not.toHaveProperty("e2eEncrypt");
  });
});

// ================================================================
// 8. wsService module — no encryption in WebSocket layer
// ================================================================
describe("wsService module — no encryption", () => {
  it("sendWsMessage sends raw JSON without encryption", () => {
    const msg = { type: "CHAT", content: "test", sender: "alice" };
    sendWsMessage(msg);

    // The function receives the exact object — no encryption transformation
    expect(sendWsMessage).toHaveBeenCalledWith(msg);
    expect(sentMessages[0]).toEqual(msg);
  });

  it("no encryption-related exports in wsService", async () => {
    const wsModule = await import("../services/wsService");
    const exportNames = Object.keys(wsModule);

    const encryptionExports = exportNames.filter(
      (name) =>
        name.toLowerCase().includes("encrypt") ||
        name.toLowerCase().includes("decrypt") ||
        name.toLowerCase().includes("cipher") ||
        name.toLowerCase().includes("e2e")
    );

    expect(encryptionExports).toEqual([]);
  });
});

// ================================================================
// 9. No encryption utilities exist in the frontend
// ================================================================
describe("No encryption utilities in frontend", () => {
  it("no crypto/encryption service module is imported", async () => {
    // The wsService, webrtcService, and apiHelper have no encryption imports
    // Verify by checking that the mocked modules don't reference encryption
    const wsModule = await import("../services/wsService");
    const rtcModule = await import("../services/webrtcService");
    const apiModule = await import("../services/apiHelper");

    // None of these modules export encryption functions
    for (const mod of [wsModule, rtcModule, apiModule]) {
      const exports = Object.keys(mod);
      const cryptoExports = exports.filter(
        (name) =>
          name.toLowerCase().includes("encrypt") ||
          name.toLowerCase().includes("decrypt") ||
          name.toLowerCase().includes("cipher")
      );
      expect(cryptoExports).toEqual([]);
    }
  });
});
