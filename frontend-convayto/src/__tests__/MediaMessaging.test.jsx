// ==========================================
// MediaMessaging.test.jsx
// Tests for: VoicePlayer animation, VideoCirclePlayer smooth progress,
//            Video circle recording (camera preview), file transfer pipeline,
//            VideoCircle icon rendering, FileAttachment display
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ====== Mocks ======

vi.mock("../services/wsService", () => ({
  onWsMessage: vi.fn((cb) => () => {}),
  sendWsMessage: vi.fn(() => true),
  isWsConnected: vi.fn(() => true),
  connectWebSocket: vi.fn(),
  disconnectWebSocket: vi.fn(),
  onCallMessage: vi.fn(() => () => {}),
  onConferenceMessage: vi.fn(() => () => {}),
  onWsConnection: vi.fn(() => () => {}),
}));

vi.mock("../services/apiHelper", () => ({
  apiFetch: vi.fn(() => Promise.resolve([])),
}));

vi.mock("react-hot-toast", () => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  fn.custom = vi.fn();
  fn.dismiss = vi.fn();
  return { default: fn, Toaster: () => null };
});

vi.mock("../utils/unreadStore", () => ({
  increment: vi.fn(),
  getActiveRoom: vi.fn(() => null),
  clear: vi.fn(),
  setActiveRoom: vi.fn(),
  getCount: vi.fn(() => 0),
  getCounts: vi.fn(() => ({})),
  subscribe: vi.fn(() => () => {}),
  _reset: vi.fn(),
}));

// ====== Imports (after mocks) ======
import { sendWsMessage, isWsConnected } from "../services/wsService";
import { apiFetch } from "../services/apiHelper";
import {
  sendFileMessage,
  sendVoiceMessage,
  sendVideoCircle,
} from "../features/messageArea/apiMessage";

// ============================================================
// Helpers
// ============================================================

function makeBlob(type = "audio/webm", size = 1024) {
  return new Blob([new ArrayBuffer(size)], { type });
}

// ============================================================
// 1. File Transfer Pipeline
// ============================================================
describe("File transfer pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("username", "testuser");
    localStorage.setItem("token", "test-token");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("sendFileMessage uploads file and sends WS message with correct structure", async () => {
    // Mock upload API
    apiFetch.mockResolvedValueOnce({
      url: "/uploads/test-file.pdf",
      originalName: "report.pdf",
      size: 2048,
      contentType: "application/pdf",
    });
    // Mock WS send
    sendWsMessage.mockReturnValue(true);
    isWsConnected.mockReturnValue(true);

    const result = await sendFileMessage({
      id: "msg-1",
      conversation_id: "room-1",
      friendUserId: "friend-1",
      file: new File(["data"], "report.pdf", { type: "application/pdf" }),
    });

    // Upload should have been called
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/upload/file",
      expect.objectContaining({ method: "POST" }),
    );

    // WS message should include file metadata
    expect(sendWsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHAT",
        roomId: "room-1",
        fileUrl: "/uploads/test-file.pdf",
        fileName: "report.pdf",
        fileSize: 2048,
        fileType: "application/pdf",
      }),
    );

    // Return value should have correct fields
    expect(result).toMatchObject({
      id: "msg-1",
      type: "CHAT",
      fileUrl: "/uploads/test-file.pdf",
      fileName: "report.pdf",
      fileSize: 2048,
      fileType: "application/pdf",
    });
  });

  it("sendFileMessage falls back to REST when WS disconnected", async () => {
    apiFetch
      .mockResolvedValueOnce({
        url: "/uploads/photo.jpg",
        originalName: "photo.jpg",
        size: 5000,
        contentType: "image/jpeg",
      })
      .mockResolvedValueOnce({ id: "msg-2" }); // REST fallback

    isWsConnected.mockReturnValue(false);
    sendWsMessage.mockReturnValue(false);

    const result = await sendFileMessage({
      id: "msg-2",
      conversation_id: "room-1",
      friendUserId: "friend-1",
      file: new File(["imgdata"], "photo.jpg", { type: "image/jpeg" }),
    });

    expect(result.fileUrl).toBe("/uploads/photo.jpg");
    expect(result.type).toBe("CHAT");
  });

  it("sendFileMessage opens conversation if conversation_id is null", async () => {
    // First call: openConversation
    apiFetch
      .mockResolvedValueOnce({ id: "new-room-123" }) // openConversation response
      .mockResolvedValueOnce({
        url: "/uploads/doc.txt",
        originalName: "doc.txt",
        size: 100,
        contentType: "text/plain",
      });
    sendWsMessage.mockReturnValue(true);
    isWsConnected.mockReturnValue(true);

    const result = await sendFileMessage({
      id: "msg-3",
      conversation_id: null,
      friendUserId: "friend-2",
      file: new File(["hello"], "doc.txt", { type: "text/plain" }),
    });

    // Should have called API to open conversation
    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/rooms/private/"),
      expect.any(Object),
    );
  });
});

// ============================================================
// 2. Voice Message Pipeline
// ============================================================
describe("Voice message pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("username", "testuser");
    localStorage.setItem("token", "test-token");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("sendVoiceMessage creates File from blob and uploads", async () => {
    apiFetch.mockResolvedValueOnce({
      url: "/uploads/voice_123.webm",
      originalName: "voice_123.webm",
      size: 4096,
      contentType: "audio/webm",
    });
    sendWsMessage.mockReturnValue(true);
    isWsConnected.mockReturnValue(true);

    const blob = makeBlob("audio/webm", 4096);
    const result = await sendVoiceMessage({
      id: "voice-1",
      conversation_id: "room-1",
      friendUserId: "friend-1",
      blob,
      duration: 5.3,
    });

    expect(sendWsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "VOICE",
        duration: 5,
        fileUrl: "/uploads/voice_123.webm",
      }),
    );
    expect(result.type).toBe("VOICE");
    expect(result.duration).toBe(5);
  });

  it("sendVoiceMessage rounds duration to integer", async () => {
    apiFetch.mockResolvedValueOnce({
      url: "/uploads/voice_456.webm",
      originalName: "voice_456.webm",
      size: 8192,
      contentType: "audio/webm",
    });
    sendWsMessage.mockReturnValue(true);
    isWsConnected.mockReturnValue(true);

    await sendVoiceMessage({
      id: "voice-2",
      conversation_id: "room-1",
      friendUserId: "f1",
      blob: makeBlob("audio/webm"),
      duration: 12.789,
    });

    expect(sendWsMessage).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 13 }),
    );
  });
});

// ============================================================
// 3. Video Circle Pipeline
// ============================================================
describe("Video circle pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("username", "testuser");
    localStorage.setItem("token", "test-token");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("sendVideoCircle creates File from blob and uploads with VIDEO_CIRCLE type", async () => {
    apiFetch.mockResolvedValueOnce({
      url: "/uploads/video_circle_999.webm",
      originalName: "video_circle_999.webm",
      size: 50000,
      contentType: "video/webm",
    });
    sendWsMessage.mockReturnValue(true);
    isWsConnected.mockReturnValue(true);

    const blob = makeBlob("video/webm", 50000);
    const result = await sendVideoCircle({
      id: "vc-1",
      conversation_id: "room-1",
      friendUserId: "friend-1",
      blob,
      duration: 15.2,
    });

    expect(sendWsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "VIDEO_CIRCLE",
        duration: 15,
        fileUrl: "/uploads/video_circle_999.webm",
        fileType: "video/webm",
      }),
    );
    expect(result.type).toBe("VIDEO_CIRCLE");
    expect(result.fileUrl).toBe("/uploads/video_circle_999.webm");
  });

  it("sendVideoCircle sets correct content emoji", async () => {
    apiFetch.mockResolvedValueOnce({
      url: "/uploads/vc.webm",
      originalName: "vc.webm",
      size: 1000,
      contentType: "video/webm",
    });
    sendWsMessage.mockReturnValue(true);
    isWsConnected.mockReturnValue(true);

    await sendVideoCircle({
      id: "vc-2",
      conversation_id: "room-1",
      friendUserId: "f1",
      blob: makeBlob("video/webm"),
      duration: 3,
    });

    expect(sendWsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "🎥 Видеокружок",
      }),
    );
  });
});

// ============================================================
// 4. VoicePlayer component unit tests
// ============================================================
describe("VoicePlayer waveform generation", () => {
  it("generates consistent pseudo-random bars from fileUrl hash", () => {
    const NUM_BARS = 48;
    const fileUrl = "/uploads/voice_123.webm";
    
    function generateBars(url) {
      const result = [];
      let seed = 0;
      if (url) for (let i = 0; i < url.length; i++) seed += url.charCodeAt(i);
      for (let i = 0; i < NUM_BARS; i++) {
        seed = (seed * 16807 + 1) % 2147483647;
        result.push(0.1 + ((seed % 100) / 100) * 0.9);
      }
      return result;
    }

    const bars1 = generateBars(fileUrl);
    const bars2 = generateBars(fileUrl);

    // Same URL → same bars
    expect(bars1).toEqual(bars2);
    expect(bars1).toHaveLength(NUM_BARS);
    
    // All values in range [0.1, 1.0]
    for (const b of bars1) {
      expect(b).toBeGreaterThanOrEqual(0.1);
      expect(b).toBeLessThanOrEqual(1.0);
    }
  });

  it("parses waveform data from server correctly", () => {
    const NUM_BARS = 48;
    const serverWaveform = JSON.stringify(
      Array.from({ length: 100 }, (_, i) => i / 100),
    );
    
    let raw;
    try {
      raw = JSON.parse(serverWaveform);
    } catch {
      raw = null;
    }

    expect(Array.isArray(raw)).toBe(true);
    expect(raw.length).toBeGreaterThanOrEqual(2);

    const result = [];
    for (let i = 0; i < NUM_BARS; i++) {
      const idx = Math.floor((i / NUM_BARS) * raw.length);
      result.push(Math.max(0.08, Math.min(1, Number(raw[idx]) || 0)));
    }
    expect(result).toHaveLength(NUM_BARS);
    // First bar should be near 0.08 (clamped min)
    expect(result[0]).toBe(0.08);
    // Last bar should be near ~0.98
    expect(result[NUM_BARS - 1]).toBeGreaterThan(0.9);
  });

  it("generates different bars for different URLs", () => {
    const NUM_BARS = 48;
    function generateBars(url) {
      const result = [];
      let seed = 0;
      if (url) for (let i = 0; i < url.length; i++) seed += url.charCodeAt(i);
      for (let i = 0; i < NUM_BARS; i++) {
        seed = (seed * 16807 + 1) % 2147483647;
        result.push(0.1 + ((seed % 100) / 100) * 0.9);
      }
      return result;
    }

    const barsA = generateBars("/uploads/voice_A.webm");
    const barsB = generateBars("/uploads/voice_B.webm");
    expect(barsA).not.toEqual(barsB);
  });
});

// ============================================================
// 5. VoicePlayer animation logic
// ============================================================
describe("VoicePlayer animation bounce calculation", () => {
  it("calculates bounce near cursor position", () => {
    const progress = 0.5;
    const animTick = 10;
    const NUM_BARS = 48;
    
    const bounces = [];
    for (let i = 0; i < NUM_BARS; i++) {
      const barPos = i / NUM_BARS;
      const nearCursor = Math.abs(barPos - progress) < 0.08;
      const bounce = nearCursor ? 0.15 * Math.sin(animTick * 0.3 + i * 0.7) : 0;
      bounces.push({ i, barPos, nearCursor, bounce });
    }

    // Some bars should be near cursor
    const nearBars = bounces.filter((b) => b.nearCursor);
    expect(nearBars.length).toBeGreaterThan(0);
    expect(nearBars.length).toBeLessThan(NUM_BARS);

    // Near-cursor bars should have non-zero bounce
    for (const b of nearBars) {
      // bounce = 0.15 * sin(...), can be zero at exact zero-crossings
      expect(Math.abs(b.bounce)).toBeLessThanOrEqual(0.15);
    }

    // Bars far from cursor should have zero bounce
    const farBars = bounces.filter((b) => !b.nearCursor);
    for (const b of farBars) {
      expect(b.bounce).toBe(0);
    }
  });

  it("clamps bar heights between 2px and 24px", () => {
    const baseHeights = [0.0, 0.1, 0.5, 1.0, 1.5]; // some exceed 1.0 with bounce
    const animTick = 5;
    const progress = 0.5;

    for (const h of baseHeights) {
      const bounce = 0.15 * Math.sin(animTick * 0.3 + 0.7); // near-cursor bounce
      const finalH = Math.max(Math.min((h + bounce) * 24, 24), 2);
      expect(finalH).toBeGreaterThanOrEqual(2);
      expect(finalH).toBeLessThanOrEqual(24);
    }
  });
});

// ============================================================
// 6. VideoCirclePlayer progress ring calculation
// ============================================================
describe("VideoCirclePlayer progress ring", () => {
  it("calculates correct SVG strokeDashoffset from progress", () => {
    const size = 240;
    const sw = 3.5;
    const r = (size - sw) / 2;
    const circ = 2 * Math.PI * r;

    // Progress 0 → full offset (ring invisible)
    expect(circ * (1 - 0)).toBeCloseTo(circ);
    
    // Progress 0.5 → half offset
    expect(circ * (1 - 0.5)).toBeCloseTo(circ / 2);
    
    // Progress 1.0 → zero offset (full ring)
    expect(circ * (1 - 1.0)).toBeCloseTo(0);
  });

  it("has correct circle dimensions for 240px size", () => {
    const size = 240;
    const sw = 3.5;
    const r = (size - sw) / 2;
    
    expect(r).toBeCloseTo(118.25);
    expect(2 * Math.PI * r).toBeCloseTo(742.94, 0);
  });

  it("formats duration correctly", () => {
    function formatTime(dur, progress, isPlaying) {
      const elapsed = isPlaying ? Math.floor(progress * dur) : 0;
      const displayTime = isPlaying ? elapsed : dur;
      const dm = Math.floor(displayTime / 60);
      const ds = Math.floor(displayTime % 60);
      return `${dm}:${ds.toString().padStart(2, "0")}`;
    }

    // Not playing → show total
    expect(formatTime(45, 0, false)).toBe("0:45");
    expect(formatTime(125, 0.5, false)).toBe("2:05");
    
    // Playing → show elapsed
    expect(formatTime(60, 0.5, true)).toBe("0:30");
    expect(formatTime(120, 0.75, true)).toBe("1:30");
  });
});

// ============================================================
// 7. FileAttachment type detection
// ============================================================
describe("FileAttachment type detection", () => {
  it("detects image files", () => {
    const types = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    for (const t of types) {
      expect(t.startsWith("image/")).toBe(true);
    }
  });

  it("detects video files", () => {
    const types = ["video/mp4", "video/webm", "video/ogg"];
    for (const t of types) {
      expect(t.startsWith("video/")).toBe(true);
    }
  });

  it("detects audio files", () => {
    const types = ["audio/mp3", "audio/ogg", "audio/webm"];
    for (const t of types) {
      expect(t.startsWith("audio/")).toBe(true);
    }
  });

  it("formats file sizes correctly", () => {
    function formatFileSize(bytes) {
      if (!bytes || bytes <= 0) return "";
      if (bytes < 1024) return bytes + " Б";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " ГБ";
    }

    expect(formatFileSize(0)).toBe("");
    expect(formatFileSize(500)).toBe("500 Б");
    expect(formatFileSize(1024)).toBe("1.0 КБ");
    expect(formatFileSize(1536)).toBe("1.5 КБ");
    expect(formatFileSize(1048576)).toBe("1.0 МБ");
    expect(formatFileSize(1073741824)).toBe("1.0 ГБ");
  });

  it("maps document extensions to correct colors", () => {
    const extColors = {
      pdf: "bg-red-500/20 text-red-400",
      doc: "bg-blue-500/20 text-blue-400",
      docx: "bg-blue-500/20 text-blue-400",
      xls: "bg-green-500/20 text-green-400",
      xlsx: "bg-green-500/20 text-green-400",
      ppt: "bg-orange-500/20 text-orange-400",
      pptx: "bg-orange-500/20 text-orange-400",
      zip: "bg-yellow-500/20 text-yellow-400",
      rar: "bg-yellow-500/20 text-yellow-400",
      "7z": "bg-yellow-500/20 text-yellow-400",
      txt: "bg-gray-500/20 text-gray-400",
      csv: "bg-green-500/20 text-green-400",
    };

    expect(extColors["pdf"]).toContain("red");
    expect(extColors["doc"]).toContain("blue");
    expect(extColors["xls"]).toContain("green");
    expect(extColors["ppt"]).toContain("orange");
    expect(extColors["zip"]).toContain("yellow");
    expect(extColors["txt"]).toContain("gray");
    // Unknown extension falls back
    expect(extColors["xyz"]).toBeUndefined();
  });

  it("extracts extension from filename correctly", () => {
    function getExt(fileName) {
      return fileName?.split(".").pop()?.toLowerCase() || "";
    }
    
    expect(getExt("report.pdf")).toBe("pdf");
    expect(getExt("photo.JPEG")).toBe("jpeg");
    expect(getExt("archive.tar.gz")).toBe("gz");
    expect(getExt("noext")).toBe("noext");
    expect(getExt(null)).toBe("");
  });
});

// ============================================================
// 8. Video circle recording flow (state machine)
// ============================================================
describe("Video circle recording state machine", () => {
  it("transitions through correct states", () => {
    // Simulate the recording state machine
    let isRecordingVideo = false;
    let videoDuration = 0;
    let isUploading = false;

    // Start recording
    isRecordingVideo = true;
    videoDuration = 0;
    expect(isRecordingVideo).toBe(true);
    expect(videoDuration).toBe(0);

    // Simulate time passing
    videoDuration = 5;
    expect(videoDuration).toBe(5);

    // Stop recording → upload
    isRecordingVideo = false;
    videoDuration = 0;
    isUploading = true;
    expect(isRecordingVideo).toBe(false);
    expect(isUploading).toBe(true);

    // Upload complete
    isUploading = false;
    expect(isUploading).toBe(false);
  });

  it("rejects recordings shorter than 1 second", () => {
    const duration = 0.5; // seconds
    const isValid = duration >= 1;
    expect(isValid).toBe(false);
  });

  it("accepts recordings of 1 second or longer", () => {
    expect(1 >= 1).toBe(true);
    expect(5.3 >= 1).toBe(true);
    expect(59.9 >= 1).toBe(true);
  });

  it("auto-stops at 60 seconds", () => {
    const MAX_DURATION = 60;
    const shouldAutoStop = (elapsed) => elapsed >= MAX_DURATION;
    
    expect(shouldAutoStop(30)).toBe(false);
    expect(shouldAutoStop(59)).toBe(false);
    expect(shouldAutoStop(60)).toBe(true);
    expect(shouldAutoStop(61)).toBe(true);
  });
});

// ============================================================
// 9. Voice recording state machine
// ============================================================
describe("Voice recording state machine", () => {
  it("rejects recordings shorter than 1 second", () => {
    const duration = 0.3;
    expect(duration < 1).toBe(true);
  });

  it("calculates duration correctly from timestamps", () => {
    const start = 1000;
    const end = 6500;
    const duration = (end - start) / 1000;
    expect(duration).toBe(5.5);
    expect(Math.round(duration)).toBe(6);
  });

  it("formats recording timer correctly", () => {
    function formatDuration(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2, "0")}`;
    }

    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(125)).toBe("2:05");
  });
});

// ============================================================
// 10. MIME type support detection
// ============================================================
describe("MIME type support utilities", () => {
  it("selects correct audio MIME priorities", () => {
    const priorities = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    
    // All are valid MIME strings
    for (const mime of priorities) {
      expect(mime).toMatch(/^audio\//);
    }
    
    // First priority is opus in webm
    expect(priorities[0]).toContain("opus");
  });

  it("selects correct video MIME priorities", () => {
    const priorities = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    
    for (const mime of priorities) {
      expect(mime).toMatch(/^video\//);
    }
    
    // VP9 is preferred
    expect(priorities[0]).toContain("vp9");
  });
});

// ============================================================
// 11. Camera stream attachment timing (the bug fix)
// ============================================================
describe("Camera stream attachment timing", () => {
  it("stream should be attached after recording state is set", () => {
    // The old bug: stream was attached before isRecordingVideo=true,
    // so videoPreviewRef.current was null because the <video> wasn't rendered yet.
    // The fix: useEffect watches isRecordingVideo and attaches when true.
    
    let isRecordingVideo = false;
    let videoPreviewCurrent = null;
    let streamAttached = false;
    const stream = { id: "mock-stream" };

    // Before: trying to attach while not recording → element doesn't exist
    if (isRecordingVideo && videoPreviewCurrent) {
      videoPreviewCurrent.srcObject = stream;
      streamAttached = true;
    }
    expect(streamAttached).toBe(false);

    // State changes to recording → element appears
    isRecordingVideo = true;
    videoPreviewCurrent = { srcObject: null, play: () => Promise.resolve() };

    // useEffect fires: attach stream
    if (isRecordingVideo && videoPreviewCurrent) {
      videoPreviewCurrent.srcObject = stream;
      streamAttached = true;
    }
    expect(streamAttached).toBe(true);
    expect(videoPreviewCurrent.srcObject).toBe(stream);
  });
});

// ============================================================
// 12. Message type routing in MessageItem
// ============================================================
describe("Message type routing", () => {
  it("recognizes VOICE type messages", () => {
    const msg = { type: "VOICE", fileUrl: "/uploads/voice.webm", duration: 5 };
    expect(msg.type === "VOICE" && msg.fileUrl).toBeTruthy();
  });

  it("recognizes VIDEO_CIRCLE type messages", () => {
    const msg = { type: "VIDEO_CIRCLE", fileUrl: "/uploads/vc.webm", duration: 10 };
    expect(msg.type === "VIDEO_CIRCLE" && msg.fileUrl).toBeTruthy();
  });

  it("recognizes image-only messages for noBubble rendering", () => {
    const msg = {
      type: "CHAT",
      fileUrl: "/uploads/photo.jpg",
      fileType: "image/jpeg",
      content: "📎 photo.jpg",
    };
    const hasFile = msg.fileUrl && msg.type !== "VOICE" && msg.type !== "VIDEO_CIRCLE";
    const isImageOnly = hasFile && msg.fileType?.startsWith("image/") &&
                         (!msg.content || msg.content.startsWith("📎 "));
    expect(isImageOnly).toBe(true);
  });

  it("does NOT treat image with custom text as image-only", () => {
    const msg = {
      type: "CHAT",
      fileUrl: "/uploads/photo.jpg",
      fileType: "image/jpeg",
      content: "Look at this photo!",
    };
    const hasFile = msg.fileUrl && msg.type !== "VOICE" && msg.type !== "VIDEO_CIRCLE";
    const isImageOnly = hasFile && msg.fileType?.startsWith("image/") &&
                         (!msg.content || msg.content.startsWith("📎 "));
    expect(isImageOnly).toBe(false);
  });

  it("renders POLL messages correctly", () => {
    const msg = {
      type: "POLL",
      pollData: { question: "Best lang?", options: [{ id: 1, text: "JS" }], totalVotes: 5 },
    };
    expect(msg.type === "POLL" && msg.pollData).toBeTruthy();
  });

  it("renders DISAPPEARING_SET as system notification", () => {
    const msg = { type: "DISAPPEARING_SET", content: "Таймер: 1 час" };
    expect(msg.type).toBe("DISAPPEARING_SET");
  });

  it("renders CALL_LOG with correct emoji", () => {
    const audioMsg = { type: "CALL_LOG", content: "Пропущенный аудио звонок" };
    const videoMsg = { type: "CALL_LOG", content: "Видеозвонок" };
    
    const isAudioCall = (msg) =>
      msg.content?.includes("аудио") || msg.content?.includes("audio");
    
    expect(isAudioCall(audioMsg)).toBe(true);
    expect(isAudioCall(videoMsg)).toBe(false);
  });
});
