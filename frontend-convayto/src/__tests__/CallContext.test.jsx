// ==========================================
// CallContext.test.jsx — tests for 1:1 call state management logic
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CallProvider, useCall, CALL_STATE } from "../contexts/CallContext";
import { MockMediaStream, MockMediaStreamTrack } from "./setup";

// ====== Capture wsService mocks ======
let callMessageCallback = null;

const mockSendWsMessage = vi.fn(() => true);
const mockIsWsConnected = vi.fn(() => true);
const mockConnectWebSocket = vi.fn();
const mockOnCallMessage = vi.fn((cb) => {
  callMessageCallback = cb;
  return () => { callMessageCallback = null; };
});

vi.mock("../services/wsService", () => ({
  sendWsMessage: (...args) => mockSendWsMessage(...args),
  isWsConnected: (...args) => mockIsWsConnected(...args),
  connectWebSocket: (...args) => mockConnectWebSocket(...args),
  onCallMessage: (...args) => mockOnCallMessage(...args),
}));

// ====== Capture webrtcService mocks ======
const mockCreatePeerConnection = vi.fn();
const mockGetUserMediaStream = vi.fn();

vi.mock("../services/webrtcService", () => ({
  createPeerConnection: (...args) => mockCreatePeerConnection(...args),
  getUserMediaStream: (...args) => mockGetUserMediaStream(...args),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: vi.fn(),
}));

// Helper: create a fake peer connection object
function createFakePc() {
  return {
    close: vi.fn(),
    addTrack: vi.fn((track, stream) => ({ track, replaceTrack: vi.fn() })),
    getSenders: vi.fn(() => []),
    createOffer: vi.fn(() => Promise.resolve({ type: "offer", sdp: "mock-offer" })),
    createAnswer: vi.fn(() => Promise.resolve({ type: "answer", sdp: "mock-answer" })),
    setLocalDescription: vi.fn(() => Promise.resolve()),
    setRemoteDescription: vi.fn(() => Promise.resolve()),
    addIceCandidate: vi.fn(() => Promise.resolve()),
    localDescription: null,
    remoteDescription: null,
    connectionState: "new",
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
  };
}

// Helper: create a mock media stream with specified tracks
function createMockStream(audioCount = 1, videoCount = 0) {
  const tracks = [];
  for (let i = 0; i < audioCount; i++) tracks.push(new MockMediaStreamTrack("audio"));
  for (let i = 0; i < videoCount; i++) tracks.push(new MockMediaStreamTrack("video"));
  return new MockMediaStream(tracks);
}

// ====== Test component that exposes CallContext state ======
let capturedCtx = null;

function TestConsumer() {
  const ctx = useCall();
  capturedCtx = ctx;
  return (
    <div>
      <span data-testid="callState">{ctx.callState}</span>
      <span data-testid="callType">{ctx.callType || "null"}</span>
      <span data-testid="remoteUser">{ctx.remoteUser || "null"}</span>
      <span data-testid="roomId">{ctx.roomId || "null"}</span>
      <span data-testid="isAudioMuted">{String(ctx.isAudioMuted)}</span>
      <span data-testid="isVideoOff">{String(ctx.isVideoOff)}</span>
      <span data-testid="isMinimized">{String(ctx.isMinimized)}</span>
      <span data-testid="isReconnecting">{String(ctx.isReconnecting)}</span>
      <span data-testid="callDuration">{ctx.callDuration}</span>
      <button data-testid="btn-toggleAudio" onClick={ctx.toggleAudio}>toggleAudio</button>
      <button data-testid="btn-toggleVideo" onClick={ctx.toggleVideo}>toggleVideo</button>
      <button data-testid="btn-toggleMinimize" onClick={ctx.toggleMinimize}>toggleMinimize</button>
      <button data-testid="btn-endCall" onClick={ctx.endCall}>endCall</button>
      <button data-testid="btn-rejectCall" onClick={ctx.rejectCall}>rejectCall</button>
      <button data-testid="btn-acceptCall" onClick={ctx.acceptCall}>acceptCall</button>
      <button data-testid="btn-startCall" onClick={() => ctx.startCall("Bob", "room-1", "audio")}>startAudioCall</button>
      <button data-testid="btn-startVideoCall" onClick={() => ctx.startCall("Bob", "room-1", "video")}>startVideoCall</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <CallProvider>
      <TestConsumer />
    </CallProvider>,
  );
}

// ====== Tests ======

describe("CallContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    capturedCtx = null;
    callMessageCallback = null;

    // Re-establish mock return values after clearAllMocks
    mockIsWsConnected.mockReturnValue(true);
    mockSendWsMessage.mockReturnValue(true);

    // Default mock implementations
    const fakePc = createFakePc();
    mockCreatePeerConnection.mockImplementation(async (handlers) => {
      fakePc.onicecandidate = (e) => handlers.onIceCandidate?.(e);
      fakePc.ontrack = (e) => handlers.onTrack?.(e);
      fakePc.onconnectionstatechange = () => handlers.onConnectionStateChange?.(fakePc.connectionState);
      return fakePc;
    });

    mockGetUserMediaStream.mockImplementation(() =>
      Promise.resolve(createMockStream(1, 0)),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ------------------------------------------
  // INITIAL STATE
  // ------------------------------------------
  describe("Initial state", () => {
    it("starts in IDLE state with all defaults", () => {
      renderWithProvider();
      expect(screen.getByTestId("callState").textContent).toBe("idle");
      expect(screen.getByTestId("callType").textContent).toBe("null");
      expect(screen.getByTestId("remoteUser").textContent).toBe("null");
      expect(screen.getByTestId("roomId").textContent).toBe("null");
      expect(screen.getByTestId("isAudioMuted").textContent).toBe("false");
      expect(screen.getByTestId("isVideoOff").textContent).toBe("false");
      expect(screen.getByTestId("isMinimized").textContent).toBe("false");
      expect(screen.getByTestId("isReconnecting").textContent).toBe("false");
      expect(screen.getByTestId("callDuration").textContent).toBe("0");
    });

    it("provides all required functions", () => {
      renderWithProvider();
      expect(typeof capturedCtx.startCall).toBe("function");
      expect(typeof capturedCtx.acceptCall).toBe("function");
      expect(typeof capturedCtx.rejectCall).toBe("function");
      expect(typeof capturedCtx.endCall).toBe("function");
      expect(typeof capturedCtx.escalateToConference).toBe("function");
      expect(typeof capturedCtx.finishEscalation).toBe("function");
      expect(typeof capturedCtx.toggleAudio).toBe("function");
      expect(typeof capturedCtx.toggleVideo).toBe("function");
      expect(typeof capturedCtx.toggleMinimize).toBe("function");
    });

    it("provides CALL_STATE constants", () => {
      renderWithProvider();
      expect(capturedCtx.CALL_STATE).toEqual({
        IDLE: "idle",
        CALLING: "calling",
        RINGING: "ringing",
        ACTIVE: "active",
        ESCALATING: "escalating",
      });
    });

    it("subscribes to WS call messages on mount", () => {
      renderWithProvider();
      expect(mockOnCallMessage).toHaveBeenCalledTimes(1);
      expect(typeof callMessageCallback).toBe("function");
    });
  });

  // ------------------------------------------
  // START CALL
  // ------------------------------------------
  describe("startCall", () => {
    it("transitions to CALLING state for audio call", async () => {
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Alice", "room-42", "audio");
      });

      expect(screen.getByTestId("callState").textContent).toBe("calling");
      expect(screen.getByTestId("callType").textContent).toBe("audio");
      expect(screen.getByTestId("remoteUser").textContent).toBe("Alice");
      expect(screen.getByTestId("roomId").textContent).toBe("room-42");
    });

    it("requests user media on start", async () => {
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Alice", "room-42", "audio");
      });
      expect(mockGetUserMediaStream).toHaveBeenCalledWith("audio");
    });

    it("creates peer connection on start", async () => {
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Alice", "room-42", "audio");
      });
      expect(mockCreatePeerConnection).toHaveBeenCalledTimes(1);
    });

    it("sends CALL_OFFER via WebSocket", async () => {
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Alice", "room-42", "audio");
      });
      expect(mockSendWsMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CALL_OFFER",
          roomId: "room-42",
          extra: expect.objectContaining({
            target: "Alice",
            callType: "audio",
          }),
        }),
      );
    });

    it("requests video media for video call", async () => {
      mockGetUserMediaStream.mockImplementation(() =>
        Promise.resolve(createMockStream(1, 1)),
      );
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Alice", "room-42", "video");
      });
      expect(mockGetUserMediaStream).toHaveBeenCalledWith("video");
      expect(screen.getByTestId("callType").textContent).toBe("video");
    });

    it("does nothing if already in a call", async () => {
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Alice", "room-1", "audio");
      });
      mockSendWsMessage.mockClear();
      await act(async () => {
        await capturedCtx.startCall("Bob", "room-2", "audio");
      });
      expect(mockSendWsMessage).not.toHaveBeenCalled();
    });

    it("attempts WS reconnect if not connected", async () => {
      mockIsWsConnected.mockReturnValue(false);
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Alice", "room-1", "audio");
      });
      expect(mockConnectWebSocket).toHaveBeenCalled();
      // Should NOT transition to calling
      expect(screen.getByTestId("callState").textContent).toBe("idle");
    });

    it("falls back to audio media if video getUserMedia fails but keeps callType as video", async () => {
      let callCount = 0;
      mockGetUserMediaStream.mockImplementation(async (type) => {
        callCount++;
        if (callCount === 1 && type === "video") throw new Error("Camera denied");
        return createMockStream(1, 0);
      });

      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Alice", "room-42", "video");
      });

      // Should still start the call — gets audio stream as fallback
      expect(screen.getByTestId("callState").textContent).toBe("calling");
      // callType stays "video" (UI shows video mode with camera off)
      expect(screen.getByTestId("callType").textContent).toBe("video");
      // isVideoOff is set to true because camera failed
      expect(screen.getByTestId("isVideoOff").textContent).toBe("true");
      // getUserMedia was called twice: first "video" (failed), then "audio" (fallback)
      expect(mockGetUserMediaStream).toHaveBeenCalledTimes(2);
      expect(mockGetUserMediaStream).toHaveBeenCalledWith("video");
      expect(mockGetUserMediaStream).toHaveBeenCalledWith("audio");
    });
  });

  // ------------------------------------------
  // INCOMING CALL (WS CALL_OFFER)
  // ------------------------------------------
  describe("Incoming call (CALL_OFFER via WS)", () => {
    it("transitions to RINGING on incoming CALL_OFFER", () => {
      renderWithProvider();
      act(() => {
        callMessageCallback({
          type: "CALL_OFFER",
          sender: "Charlie",
          roomId: "room-99",
          extra: { callType: "audio", sdp: '{"type":"offer","sdp":"remote-sdp"}' },
        });
      });

      expect(screen.getByTestId("callState").textContent).toBe("ringing");
      expect(screen.getByTestId("remoteUser").textContent).toBe("Charlie");
      expect(screen.getByTestId("roomId").textContent).toBe("room-99");
      expect(screen.getByTestId("callType").textContent).toBe("audio");
    });

    it("accepts video call type from CALL_OFFER", () => {
      renderWithProvider();
      act(() => {
        callMessageCallback({
          type: "CALL_OFFER",
          sender: "Charlie",
          roomId: "room-99",
          extra: { callType: "video", sdp: '{"type":"offer","sdp":"v-sdp"}' },
        });
      });
      expect(screen.getByTestId("callType").textContent).toBe("video");
    });

    it("sends CALL_BUSY if already in a call", async () => {
      renderWithProvider();
      // Start a call first
      await act(async () => {
        await capturedCtx.startCall("Alice", "room-1", "audio");
      });
      mockSendWsMessage.mockClear();

      // Receive another CALL_OFFER
      act(() => {
        callMessageCallback({
          type: "CALL_OFFER",
          sender: "Dave",
          roomId: "room-2",
          extra: { callType: "audio", sdp: '{"type":"offer","sdp":"x"}' },
        });
      });

      expect(mockSendWsMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CALL_BUSY",
          extra: expect.objectContaining({ target: "Dave" }),
        }),
      );
    });
  });

  // ------------------------------------------
  // REJECT CALL
  // ------------------------------------------
  describe("rejectCall", () => {
    it("sends CALL_REJECT and returns to IDLE", () => {
      renderWithProvider();
      // Simulate incoming call
      act(() => {
        callMessageCallback({
          type: "CALL_OFFER",
          sender: "Eve",
          roomId: "room-77",
          extra: { callType: "audio", sdp: '{"type":"offer","sdp":"e"}' },
        });
      });
      expect(screen.getByTestId("callState").textContent).toBe("ringing");

      // Reject
      act(() => {
        capturedCtx.rejectCall();
      });

      expect(mockSendWsMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CALL_REJECT",
          extra: expect.objectContaining({ target: "Eve" }),
        }),
      );
      expect(screen.getByTestId("callState").textContent).toBe("idle");
    });

    it("does nothing if not in RINGING state", async () => {
      renderWithProvider();
      mockSendWsMessage.mockClear();
      act(() => {
        capturedCtx.rejectCall();
      });
      expect(mockSendWsMessage).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // END CALL
  // ------------------------------------------
  describe("endCall", () => {
    it("sends CALL_END and returns to IDLE from CALLING", async () => {
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Frank", "room-10", "audio");
      });
      expect(screen.getByTestId("callState").textContent).toBe("calling");

      mockSendWsMessage.mockClear();
      act(() => {
        capturedCtx.endCall();
      });

      expect(mockSendWsMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CALL_END",
          roomId: "room-10",
          extra: expect.objectContaining({ target: "Frank", reason: "hangup" }),
        }),
      );
      expect(screen.getByTestId("callState").textContent).toBe("idle");
    });

    it("does nothing if already IDLE", () => {
      renderWithProvider();
      mockSendWsMessage.mockClear();
      act(() => {
        capturedCtx.endCall();
      });
      expect(mockSendWsMessage).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // REMOTE CALL_END / CALL_REJECT / CALL_BUSY
  // ------------------------------------------
  describe("Remote call termination via WS", () => {
    async function startCall() {
      await act(async () => {
        await capturedCtx.startCall("George", "room-20", "audio");
      });
    }

    it("returns to IDLE on receiving CALL_END", async () => {
      renderWithProvider();
      await startCall();
      expect(screen.getByTestId("callState").textContent).toBe("calling");

      act(() => {
        callMessageCallback({
          type: "CALL_END",
          sender: "George",
          roomId: "room-20",
          extra: { reason: "hangup" },
        });
      });
      expect(screen.getByTestId("callState").textContent).toBe("idle");
    });

    it("returns to IDLE on receiving CALL_REJECT", async () => {
      renderWithProvider();
      await startCall();

      act(() => {
        callMessageCallback({
          type: "CALL_REJECT",
          sender: "George",
          roomId: "room-20",
          extra: {},
        });
      });
      expect(screen.getByTestId("callState").textContent).toBe("idle");
    });

    it("returns to IDLE on receiving CALL_BUSY", async () => {
      renderWithProvider();
      await startCall();

      act(() => {
        callMessageCallback({
          type: "CALL_BUSY",
          sender: "George",
          roomId: "room-20",
          extra: {},
        });
      });
      expect(screen.getByTestId("callState").textContent).toBe("idle");
    });
  });

  // ------------------------------------------
  // TOGGLE AUDIO
  // ------------------------------------------
  describe("toggleAudio", () => {
    it("toggles isAudioMuted state", async () => {
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Hannah", "room-30", "audio");
      });

      expect(screen.getByTestId("isAudioMuted").textContent).toBe("false");

      act(() => {
        capturedCtx.toggleAudio();
      });
      expect(screen.getByTestId("isAudioMuted").textContent).toBe("true");

      act(() => {
        capturedCtx.toggleAudio();
      });
      expect(screen.getByTestId("isAudioMuted").textContent).toBe("false");
    });
  });

  // ------------------------------------------
  // TOGGLE VIDEO
  // ------------------------------------------
  describe("toggleVideo", () => {
    it("toggles isVideoOff for video calls", async () => {
      mockGetUserMediaStream.mockImplementation(() =>
        Promise.resolve(createMockStream(1, 1)),
      );

      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Ian", "room-40", "video");
      });
      expect(screen.getByTestId("isVideoOff").textContent).toBe("false");

      await act(async () => {
        await capturedCtx.toggleVideo();
      });
      expect(screen.getByTestId("isVideoOff").textContent).toBe("true");

      await act(async () => {
        await capturedCtx.toggleVideo();
      });
      expect(screen.getByTestId("isVideoOff").textContent).toBe("false");
    });
  });

  // ------------------------------------------
  // TOGGLE MINIMIZE
  // ------------------------------------------
  describe("toggleMinimize", () => {
    it("toggles isMinimized state", () => {
      renderWithProvider();
      expect(screen.getByTestId("isMinimized").textContent).toBe("false");

      act(() => {
        capturedCtx.toggleMinimize();
      });
      expect(screen.getByTestId("isMinimized").textContent).toBe("true");

      act(() => {
        capturedCtx.toggleMinimize();
      });
      expect(screen.getByTestId("isMinimized").textContent).toBe("false");
    });
  });

  // ------------------------------------------
  // CLEANUP
  // ------------------------------------------
  describe("Cleanup on endCall", () => {
    it("resets all state to defaults after endCall", async () => {
      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Kate", "room-50", "audio");
      });
      expect(screen.getByTestId("callState").textContent).toBe("calling");

      act(() => {
        capturedCtx.endCall();
      });

      expect(screen.getByTestId("callState").textContent).toBe("idle");
      expect(screen.getByTestId("callType").textContent).toBe("null");
      expect(screen.getByTestId("remoteUser").textContent).toBe("null");
      expect(screen.getByTestId("roomId").textContent).toBe("null");
      expect(screen.getByTestId("isAudioMuted").textContent).toBe("false");
      expect(screen.getByTestId("isVideoOff").textContent).toBe("false");
      expect(screen.getByTestId("callDuration").textContent).toBe("0");
      expect(screen.getByTestId("isMinimized").textContent).toBe("false");
      expect(screen.getByTestId("isReconnecting").textContent).toBe("false");
    });
  });

  // ------------------------------------------
  // CALL_ANSWER handling (CALLING → ACTIVE)
  // ------------------------------------------
  describe("CALL_ANSWER handling", () => {
    it("transitions to ACTIVE on receiving CALL_ANSWER", async () => {
      const fakePc = createFakePc();
      mockCreatePeerConnection.mockImplementation(async (handlers) => {
        return fakePc;
      });

      renderWithProvider();
      await act(async () => {
        await capturedCtx.startCall("Larry", "room-60", "audio");
      });
      expect(screen.getByTestId("callState").textContent).toBe("calling");

      await act(async () => {
        callMessageCallback({
          type: "CALL_ANSWER",
          sender: "Larry",
          roomId: "room-60",
          extra: { sdp: JSON.stringify({ type: "answer", sdp: "remote-answer" }) },
        });
      });

      // Wait for async SDP processing
      await waitFor(() => {
        expect(screen.getByTestId("callState").textContent).toBe("active");
      });
    });

    it("ignores CALL_ANSWER if not in CALLING state", () => {
      renderWithProvider();
      act(() => {
        callMessageCallback({
          type: "CALL_ANSWER",
          sender: "Larry",
          roomId: "room-60",
          extra: { sdp: '{"type":"answer","sdp":"x"}' },
        });
      });
      expect(screen.getByTestId("callState").textContent).toBe("idle");
    });
  });

  // ------------------------------------------
  // ICE_CANDIDATE handling
  // ------------------------------------------
  describe("ICE_CANDIDATE handling", () => {
    it("does not crash on ICE_CANDIDATE without active call", () => {
      renderWithProvider();
      expect(() => {
        act(() => {
          callMessageCallback({
            type: "ICE_CANDIDATE",
            sender: "Mike",
            roomId: "room-70",
            extra: { candidate: '{"candidate":"mock-ice","sdpMid":"0","sdpMLineIndex":0}' },
          });
        });
      }).not.toThrow();
    });
  });

  // ------------------------------------------
  // CALL_REOFFER / CALL_REANSWER (mid-call renegotiation)
  // ------------------------------------------
  describe("Mid-call renegotiation", () => {
    it("ignores CALL_REOFFER if not in ACTIVE state", () => {
      renderWithProvider();
      expect(() => {
        act(() => {
          callMessageCallback({
            type: "CALL_REOFFER",
            sender: "Nancy",
            roomId: "room-80",
            extra: { sdp: '{"type":"offer","sdp":"re-offer"}', callType: "video" },
          });
        });
      }).not.toThrow();
    });

    it("ignores CALL_REANSWER if not in ACTIVE state", () => {
      renderWithProvider();
      expect(() => {
        act(() => {
          callMessageCallback({
            type: "CALL_REANSWER",
            sender: "Oscar",
            roomId: "room-90",
            extra: { sdp: '{"type":"answer","sdp":"re-answer"}' },
          });
        });
      }).not.toThrow();
    });
  });

  // ------------------------------------------
  // useCall outside provider
  // ------------------------------------------
  describe("useCall outside provider", () => {
    it("throws error when used outside CallProvider", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useCall must be used within CallProvider");
      consoleError.mockRestore();
    });
  });

  // ------------------------------------------
  // CALL_STATE export
  // ------------------------------------------
  describe("CALL_STATE export", () => {
    it("exports correct CALL_STATE enum values", () => {
      expect(CALL_STATE).toEqual({
        IDLE: "idle",
        CALLING: "calling",
        RINGING: "ringing",
        ACTIVE: "active",
        ESCALATING: "escalating",
      });
    });
  });
});
