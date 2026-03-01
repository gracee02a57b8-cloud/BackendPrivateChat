// ==========================================
// ConferenceContext.test.jsx — state management tests for group conference
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MockMediaStream,
  MockMediaStreamTrack,
  MockRTCPeerConnection,
} from "./setup";

// ====== Service mocks ======
let wsMessageCallback = null;
const sendWsMessageMock = vi.fn();
const isWsConnectedMock = vi.fn(() => true);
const onConferenceMessageMock = vi.fn((cb) => {
  wsMessageCallback = cb;
  return vi.fn(); // unsub
});

vi.mock("../services/wsService", () => ({
  onConferenceMessage: (...args) => onConferenceMessageMock(...args),
  sendWsMessage: (...args) => sendWsMessageMock(...args),
  isWsConnected: () => isWsConnectedMock(),
}));

const createPeerConnectionMock = vi.fn(async () => new MockRTCPeerConnection());
const getUserMediaStreamMock = vi.fn(async () =>
  new MockMediaStream([
    new MockMediaStreamTrack("audio"),
    new MockMediaStreamTrack("video"),
  ]),
);

vi.mock("../services/webrtcService", () => ({
  createPeerConnection: (...args) => createPeerConnectionMock(...args),
  getUserMediaStream: (...args) => getUserMediaStreamMock(...args),
}));

const apiFetchMock = vi.fn();
vi.mock("../services/apiHelper", () => ({
  apiFetch: (...args) => apiFetchMock(...args),
}));

const toastMock = Object.assign(vi.fn(), {
  success: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
});
vi.mock("react-hot-toast", () => ({
  default: toastMock,
}));

// Import after mocks
let ConferenceProvider, useConference, CONF_STATE, MAX_PARTICIPANTS;

// Helper: component that exposes context
let ctxRef = {};
function TestConsumer() {
  const ctx = useConference();
  ctxRef = ctx;
  return (
    <div>
      <span data-testid="state">{ctx.confState}</span>
      <span data-testid="confId">{ctx.confId || "null"}</span>
      <span data-testid="participants">{ctx.participants.join(",")}</span>
      <span data-testid="audioMuted">{ctx.isAudioMuted ? "yes" : "no"}</span>
      <span data-testid="videoOff">{ctx.isVideoOff ? "yes" : "no"}</span>
      <span data-testid="minimized">{ctx.isMinimized ? "yes" : "no"}</span>
      <button onClick={() => ctx.toggleAudio()}>toggleAudio</button>
      <button onClick={() => ctx.toggleVideo()}>toggleVideo</button>
      <button onClick={() => ctx.toggleMinimize()}>toggleMinimize</button>
      <button onClick={() => ctx.startConference("room1", "video")}>
        startConference
      </button>
      <button onClick={() => ctx.leaveConference()}>leaveConference</button>
      <button onClick={() => ctx.inviteUser("Bob")}>inviteUser</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ConferenceProvider>
      <TestConsumer />
    </ConferenceProvider>,
  );
}

describe("ConferenceContext", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    wsMessageCallback = null;
    localStorage.setItem("username", "TestUser");
    isWsConnectedMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({ confId: "conf-123", roomId: "room1" });
    createPeerConnectionMock.mockImplementation(async (opts) => {
      const pc = new MockRTCPeerConnection();
      // Simulate the webrtcService behavior
      return pc;
    });

    // Dynamic import to get fresh module with mocks applied
    const mod = await import("../contexts/ConferenceContext");
    ConferenceProvider = mod.ConferenceProvider;
    useConference = mod.useConference;
    CONF_STATE = mod.CONF_STATE;
    MAX_PARTICIPANTS = mod.MAX_PARTICIPANTS;
  });

  // ------------------------------------------
  // INITIAL STATE
  // ------------------------------------------
  describe("Initial state", () => {
    it("starts with IDLE state", () => {
      renderWithProvider();
      expect(screen.getByTestId("state").textContent).toBe("idle");
    });

    it("starts with no confId", () => {
      renderWithProvider();
      expect(screen.getByTestId("confId").textContent).toBe("null");
    });

    it("starts with no participants", () => {
      renderWithProvider();
      expect(screen.getByTestId("participants").textContent).toBe("");
    });

    it("starts with audio unmuted", () => {
      renderWithProvider();
      expect(screen.getByTestId("audioMuted").textContent).toBe("no");
    });

    it("starts with video on", () => {
      renderWithProvider();
      expect(screen.getByTestId("videoOff").textContent).toBe("no");
    });

    it("starts not minimized", () => {
      renderWithProvider();
      expect(screen.getByTestId("minimized").textContent).toBe("no");
    });

    it("exports CONF_STATE constants", () => {
      expect(CONF_STATE).toEqual({
        IDLE: "idle",
        JOINING: "joining",
        ACTIVE: "active",
      });
    });

    it("exports MAX_PARTICIPANTS = 10", () => {
      expect(MAX_PARTICIPANTS).toBe(10);
    });
  });

  // ------------------------------------------
  // TOGGLE AUDIO / VIDEO / MINIMIZE
  // ------------------------------------------
  describe("Toggles", () => {
    it("toggleAudio flips isAudioMuted", async () => {
      renderWithProvider();
      // First start a conference to get localStream
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      await act(async () => ctxRef.toggleAudio());
      expect(screen.getByTestId("audioMuted").textContent).toBe("yes");

      await act(async () => ctxRef.toggleAudio());
      expect(screen.getByTestId("audioMuted").textContent).toBe("no");
    });

    it("toggleVideo flips isVideoOff", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      await act(async () => ctxRef.toggleVideo());
      expect(screen.getByTestId("videoOff").textContent).toBe("yes");

      await act(async () => ctxRef.toggleVideo());
      expect(screen.getByTestId("videoOff").textContent).toBe("no");
    });

    it("toggleMinimize flips isMinimized", async () => {
      renderWithProvider();

      await act(async () => ctxRef.toggleMinimize());
      expect(screen.getByTestId("minimized").textContent).toBe("yes");

      await act(async () => ctxRef.toggleMinimize());
      expect(screen.getByTestId("minimized").textContent).toBe("no");
    });

    it("toggleAudio does nothing without localStream (IDLE)", async () => {
      renderWithProvider();
      await act(async () => ctxRef.toggleAudio());
      expect(screen.getByTestId("audioMuted").textContent).toBe("no"); // unchanged
    });

    it("toggleVideo does nothing without localStream (IDLE)", async () => {
      renderWithProvider();
      await act(async () => ctxRef.toggleVideo());
      expect(screen.getByTestId("videoOff").textContent).toBe("no"); // unchanged
    });
  });

  // ------------------------------------------
  // START CONFERENCE
  // ------------------------------------------
  describe("startConference", () => {
    it("transitions to ACTIVE state", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      expect(screen.getByTestId("state").textContent).toBe("active");
    });

    it("sets confId from REST response", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      expect(screen.getByTestId("confId").textContent).toBe("conf-123");
    });

    it("calls getUserMediaStream", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      expect(getUserMediaStreamMock).toHaveBeenCalledWith("video");
    });

    it("calls apiFetch to create conference", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/conference",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("sends CONF_JOIN via WebSocket", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      const joinMsg = sendWsMessageMock.mock.calls.find(
        (c) => c[0].type === "CONF_JOIN",
      );
      expect(joinMsg).toBeDefined();
      expect(joinMsg[0].extra.confId).toBe("conf-123");
    });

    it("sends CHAT notification about conference start", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      const chatMsg = sendWsMessageMock.mock.calls.find(
        (c) => c[0].type === "CHAT",
      );
      expect(chatMsg).toBeDefined();
      expect(chatMsg[0].content).toContain("видеоконференция");
    });

    it("does not start if already not IDLE", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      // Try starting again
      const callsBefore = apiFetchMock.mock.calls.length;
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });
      expect(apiFetchMock.mock.calls.length).toBe(callsBefore);
    });

    it("shows toast error when WS is not connected", async () => {
      isWsConnectedMock.mockReturnValue(false);
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      expect(toastMock.error).toHaveBeenCalledWith("Нет подключения к серверу");
    });

    it("cleans up on REST failure", async () => {
      apiFetchMock.mockRejectedValueOnce(new Error("REST error"));
      apiFetchMock.mockRejectedValueOnce(new Error("REST error 2")); // fallback also fails
      renderWithProvider();

      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      expect(screen.getByTestId("state").textContent).toBe("idle");
    });

    it("joins existing conference when backend returns same confId for the room", async () => {
      // Backend returns an existing conference (same roomId)
      apiFetchMock.mockResolvedValue({ confId: "existing-conf-999", roomId: "room1" });
      renderWithProvider();

      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      expect(screen.getByTestId("state").textContent).toBe("active");
      expect(screen.getByTestId("confId").textContent).toBe("existing-conf-999");
      // Should still send CONF_JOIN with the returned confId
      const joinMsg = sendWsMessageMock.mock.calls.find(
        (c) => c[0].type === "CONF_JOIN",
      );
      expect(joinMsg).toBeDefined();
      expect(joinMsg[0].extra.confId).toBe("existing-conf-999");
    });

    it("falls back to /api/conference/room/{roomId} when POST fails", async () => {
      apiFetchMock
        .mockRejectedValueOnce(new Error("POST failed"))    // POST /api/conference
        .mockResolvedValueOnce({ confId: "fallback-conf", roomId: "room1" }) // GET /api/conference/room/room1
        .mockResolvedValueOnce({});                          // POST /join
      renderWithProvider();

      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      expect(screen.getByTestId("state").textContent).toBe("active");
      expect(screen.getByTestId("confId").textContent).toBe("fallback-conf");
      // Verify fallback URL was called
      const fallbackCall = apiFetchMock.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("/api/conference/room/"),
      );
      expect(fallbackCall).toBeDefined();
    });
  });

  // ------------------------------------------
  // LEAVE CONFERENCE
  // ------------------------------------------
  describe("leaveConference", () => {
    it("sends CONF_LEAVE via WS", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      await act(async () => ctxRef.leaveConference());

      const leaveMsg = sendWsMessageMock.mock.calls.find(
        (c) => c[0].type === "CONF_LEAVE",
      );
      expect(leaveMsg).toBeDefined();
    });

    it("calls REST leave endpoint", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      await act(async () => ctxRef.leaveConference());

      const leaveCall = apiFetchMock.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("/leave"),
      );
      expect(leaveCall).toBeDefined();
    });

    it("resets state to IDLE after leave", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      await act(async () => ctxRef.leaveConference());

      expect(screen.getByTestId("state").textContent).toBe("idle");
      expect(screen.getByTestId("confId").textContent).toBe("null");
    });

    it("does nothing if already IDLE", async () => {
      renderWithProvider();
      await act(async () => ctxRef.leaveConference());
      expect(sendWsMessageMock).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // GET INVITE LINK
  // ------------------------------------------
  describe("getInviteLink", () => {
    it("returns correct conference URL", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      const link = ctxRef.getInviteLink();
      expect(link).toContain("/conference/conf-123");
    });

    it("returns null when no conference is active", () => {
      renderWithProvider();
      const link = ctxRef.getInviteLink();
      expect(link).toBeNull();
    });
  });

  // ------------------------------------------
  // INVITE USER
  // ------------------------------------------
  describe("inviteUser", () => {
    it("sends CONF_INVITE via WS", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      await act(async () => ctxRef.inviteUser("Bob"));

      const invMsg = sendWsMessageMock.mock.calls.find(
        (c) => c[0].type === "CONF_INVITE",
      );
      expect(invMsg).toBeDefined();
      expect(invMsg[0].extra.target).toBe("Bob");
      expect(invMsg[0].extra.confId).toBe("conf-123");
      expect(invMsg[0].extra.inviteLink).toContain("/conference/conf-123");
    });

    it("shows success toast", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      await act(async () => ctxRef.inviteUser("Bob"));

      expect(toastMock.success).toHaveBeenCalledWith(
        "Приглашение отправлено: Bob",
      );
    });

    it("shows error toast when not in ACTIVE state", async () => {
      renderWithProvider();
      await act(async () => ctxRef.inviteUser("Bob"));
      expect(toastMock.error).toHaveBeenCalledWith("Нет активной конференции");
    });

    it("shows error toast when WS is not connected", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });
      isWsConnectedMock.mockReturnValue(false);

      await act(async () => ctxRef.inviteUser("Bob"));
      expect(toastMock.error).toHaveBeenCalledWith("Нет подключения к серверу");
    });

    it("sends autoJoin flag when inviteUser is called with autoJoin=true", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      await act(async () => ctxRef.inviteUser("Bob", true));

      const invMsg = sendWsMessageMock.mock.calls.find(
        (c) => c[0].type === "CONF_INVITE",
      );
      expect(invMsg).toBeDefined();
      expect(invMsg[0].extra.autoJoin).toBe("true");
    });

    it("does not send autoJoin flag for normal invite", async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      await act(async () => ctxRef.inviteUser("Bob"));

      const invMsg = sendWsMessageMock.mock.calls.find(
        (c) => c[0].type === "CONF_INVITE",
      );
      expect(invMsg).toBeDefined();
      expect(invMsg[0].extra.autoJoin).toBe("");
    });
  });

  // ------------------------------------------
  // WS MESSAGE HANDLING
  // ------------------------------------------
  describe("WS message handling", () => {
    beforeEach(async () => {
      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });
    });

    it("CONF_JOIN adds participant and shows toast", async () => {
      await act(async () => {
        wsMessageCallback({
          type: "CONF_JOIN",
          sender: "Charlie",
          roomId: "room1",
          extra: {},
        });
      });

      expect(screen.getByTestId("participants").textContent).toContain("Charlie");
      expect(toastMock).toHaveBeenCalledWith(
        "Charlie присоединился",
        expect.objectContaining({ icon: "👋" }),
      );
    });

    it("CONF_JOIN does not add self", async () => {
      await act(async () => {
        wsMessageCallback({
          type: "CONF_JOIN",
          sender: "TestUser",
          roomId: "room1",
          extra: {},
        });
      });

      expect(screen.getByTestId("participants").textContent).not.toContain("TestUser");
    });

    it("CONF_JOIN does not add duplicate participant", async () => {
      await act(async () => {
        wsMessageCallback({
          type: "CONF_JOIN",
          sender: "Charlie",
          roomId: "room1",
          extra: {},
        });
      });
      await act(async () => {
        wsMessageCallback({
          type: "CONF_JOIN",
          sender: "Charlie",
          roomId: "room1",
          extra: {},
        });
      });

      const parts = screen.getByTestId("participants").textContent.split(",");
      const charlieCount = parts.filter((p) => p === "Charlie").length;
      expect(charlieCount).toBe(1);
    });

    it("CONF_LEAVE removes participant and shows toast", async () => {
      // First add the participant
      await act(async () => {
        wsMessageCallback({
          type: "CONF_JOIN",
          sender: "Charlie",
          roomId: "room1",
          extra: {},
        });
      });

      expect(screen.getByTestId("participants").textContent).toContain("Charlie");

      // Now leave
      await act(async () => {
        wsMessageCallback({
          type: "CONF_LEAVE",
          sender: "Charlie",
          roomId: "room1",
          extra: {},
        });
      });

      expect(screen.getByTestId("participants").textContent).not.toContain("Charlie");
      expect(toastMock).toHaveBeenCalledWith(
        "Charlie покинул конференцию",
        expect.objectContaining({ icon: "👋" }),
      );
    });

    it("CONF_INVITE shows interactive toast notification", async () => {
      // First go back to IDLE to receive invite
      await act(async () => ctxRef.leaveConference());

      await act(async () => {
        wsMessageCallback({
          type: "CONF_INVITE",
          sender: "Alice",
          roomId: "room1",
          extra: {
            confId: "invited-conf-456",
            inviteLink: "https://barsikchat.duckdns.org/conference/invited-conf-456",
          },
        });
      });

      // Toast is called with a render function + options
      expect(toastMock).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ duration: 30000, icon: "📹" }),
      );
    });

    it("CONF_INVITE with autoJoin=true auto-starts conference instead of showing toast", async () => {
      // First go back to IDLE to receive invite
      await act(async () => ctxRef.leaveConference());

      const callsBefore = toastMock.mock.calls.length;

      // Reset apiFetch for the new startConference call
      apiFetchMock.mockResolvedValueOnce({ confId: "auto-conf-789", roomId: "room1" });
      apiFetchMock.mockResolvedValueOnce({});

      await act(async () => {
        wsMessageCallback({
          type: "CONF_INVITE",
          sender: "Alice",
          roomId: "room1",
          extra: {
            confId: "auto-conf-789",
            inviteLink: "https://barsikchat.duckdns.org/conference/auto-conf-789",
            autoJoin: "true",
          },
        });
      });

      // Should NOT show interactive toast (with duration 30000)
      const inviteToasts = toastMock.mock.calls
        .slice(callsBefore)
        .filter(
          (c) => typeof c[1] === "object" && c[1]?.duration === 30000,
        );
      expect(inviteToasts.length).toBe(0);

      // Should have auto-started conference: state becomes ACTIVE
      expect(screen.getByTestId("state").textContent).toBe("active");
    });

    it("CONF_INVITE is ignored when already in conference", async () => {
      // We're already active
      const callsBefore = toastMock.mock.calls.length;

      await act(async () => {
        wsMessageCallback({
          type: "CONF_INVITE",
          sender: "Alice",
          roomId: "room1",
          extra: {
            confId: "new-conf",
            inviteLink: "https://barsikchat.duckdns.org/conference/new-conf",
          },
        });
      });

      // Should not show new toast for invite
      const inviteCalls = toastMock.mock.calls
        .slice(callsBefore)
        .filter(
          (c) => typeof c[1] === "object" && c[1]?.duration === 30000,
        );
      expect(inviteCalls.length).toBe(0);
    });

    it("CONF_PEERS sets participant list", async () => {
      await act(async () => {
        wsMessageCallback({
          type: "CONF_PEERS",
          sender: "server",
          roomId: "room1",
          extra: { peers: "Alice,Bob,Charlie" },
        });
      });

      const parts = screen.getByTestId("participants").textContent;
      expect(parts).toContain("Alice");
      expect(parts).toContain("Bob");
      expect(parts).toContain("Charlie");
    });
  });

  // ------------------------------------------
  // JOIN CONFERENCE BY ID
  // ------------------------------------------
  describe("joinConferenceById", () => {
    it("joins conference and returns roomId", async () => {
      apiFetchMock.mockResolvedValueOnce({ roomId: "room-xyz" }); // conference info
      apiFetchMock.mockResolvedValueOnce({}); // join REST

      renderWithProvider();
      let roomId;
      await act(async () => {
        roomId = await ctxRef.joinConferenceById("ext-conf-789", "video");
      });

      expect(roomId).toBe("room-xyz");
      expect(screen.getByTestId("state").textContent).toBe("active");
    });

    it("calls getUserMediaStream", async () => {
      apiFetchMock.mockResolvedValueOnce({ roomId: "room-xyz" });
      apiFetchMock.mockResolvedValueOnce({});

      renderWithProvider();
      await act(async () => {
        await ctxRef.joinConferenceById("ext-conf-789", "video");
      });

      expect(getUserMediaStreamMock).toHaveBeenCalledWith("video");
    });

    it("sends CONF_JOIN via WS", async () => {
      apiFetchMock.mockResolvedValueOnce({ roomId: "room-xyz" });
      apiFetchMock.mockResolvedValueOnce({});

      renderWithProvider();
      await act(async () => {
        await ctxRef.joinConferenceById("ext-conf-789", "video");
      });

      const joinMsg = sendWsMessageMock.mock.calls.find(
        (c) => c[0].type === "CONF_JOIN",
      );
      expect(joinMsg).toBeDefined();
    });

    it("does not join if not IDLE", async () => {
      apiFetchMock.mockResolvedValueOnce({ confId: "c1", roomId: "r1" });
      apiFetchMock.mockResolvedValueOnce({});

      renderWithProvider();
      await act(async () => {
        await ctxRef.startConference("room1", "video");
      });

      apiFetchMock.mockResolvedValueOnce({ roomId: "room-xyz" });
      const callsBefore = getUserMediaStreamMock.mock.calls.length;

      await act(async () => {
        const result = await ctxRef.joinConferenceById("other-conf");
        expect(result).toBeNull();
      });

      expect(getUserMediaStreamMock.mock.calls.length).toBe(callsBefore);
    });

    it("cleans up and throws on error", async () => {
      apiFetchMock.mockReset();
      apiFetchMock.mockImplementation(() =>
        Promise.reject(new Error("Конференция не найдена")),
      );

      renderWithProvider();
      let thrownError;
      await act(async () => {
        try {
          await ctxRef.joinConferenceById("bad-conf");
        } catch (e) {
          thrownError = e;
        }
      });

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toBe("Конференция не найдена");
      expect(screen.getByTestId("state").textContent).toBe("idle");
    });
  });
});
