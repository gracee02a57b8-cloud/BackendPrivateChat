// ==========================================
// ConferenceOverlay.test.jsx — UI tests for group conference overlay
// ==========================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConferenceOverlay from "../components/ConferenceOverlay";
import { MockMediaStream, MockMediaStreamTrack } from "./setup";

// ====== Conference context mock ======
const defaultConfCtx = {
  confState: "idle",
  localStream: null,
  peerStreams: {},
  participants: [],
  isAudioMuted: false,
  isVideoOff: false,
  isMinimized: false,
  leaveConference: vi.fn(),
  toggleAudio: vi.fn(),
  toggleVideo: vi.fn(),
  toggleMinimize: vi.fn(),
  getInviteLink: vi.fn(() => "https://barsikchat.duckdns.org/conference/abc-123"),
  inviteUser: vi.fn(),
  CONF_STATE: { IDLE: "idle", JOINING: "joining", ACTIVE: "active" },
};

let confCtxMock = { ...defaultConfCtx };

vi.mock("../contexts/ConferenceContext", () => ({
  useConference: () => confCtxMock,
  CONF_STATE: { IDLE: "idle", JOINING: "joining", ACTIVE: "active" },
  MAX_PARTICIPANTS: 10,
}));

// Mock InviteConferenceModal (tested separately)
vi.mock("../components/InviteConferenceModal", () => ({
  default: ({ onClose }) => (
    <div data-testid="invite-modal">
      <button onClick={onClose} data-testid="close-invite">Close</button>
    </div>
  ),
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

function mkStream(audio = 1, video = 1) {
  const tracks = [];
  for (let i = 0; i < audio; i++) tracks.push(new MockMediaStreamTrack("audio"));
  for (let i = 0; i < video; i++) tracks.push(new MockMediaStreamTrack("video"));
  return new MockMediaStream(tracks);
}

describe("ConferenceOverlay", () => {
  beforeEach(() => {
    confCtxMock = { ...defaultConfCtx };
    vi.clearAllMocks();
    localStorage.setItem("username", "TestUser");
  });

  // ------------------------------------------
  // IDLE — nothing rendered
  // ------------------------------------------
  describe("IDLE state", () => {
    it("renders nothing when confState is IDLE", () => {
      confCtxMock.confState = "idle";
      const { container } = render(<ConferenceOverlay />);
      expect(container.innerHTML).toBe("");
    });
  });

  // ------------------------------------------
  // ACTIVE — fullscreen
  // ------------------------------------------
  describe("ACTIVE state — fullscreen", () => {
    beforeEach(() => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
      confCtxMock.participants = ["Alice", "Bob"];
      confCtxMock.peerStreams = {
        Alice: mkStream(),
        Bob: mkStream(),
      };
    });

    it("shows conference header with participant count", () => {
      render(<ConferenceOverlay />);
      // 3 = me + 2 peers
      expect(screen.getByText(/Конференция • 3\/10/)).toBeInTheDocument();
    });

    it("renders local video tile with '(Вы)' label", () => {
      render(<ConferenceOverlay />);
      expect(screen.getByText("TestUser (Вы)")).toBeInTheDocument();
    });

    it("renders remote peer video tiles with username labels", () => {
      render(<ConferenceOverlay />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("renders correct total number of video tiles (local + peers)", () => {
      const { container } = render(<ConferenceOverlay />);
      // VideoTile elements each have the rounded-2xl bg-gray-800 class
      const tiles = container.querySelectorAll(".rounded-2xl.bg-gray-800");
      expect(tiles.length).toBe(3); // 1 local + 2 remote
    });

    it("renders all 4 control buttons (mic, camera, minimize, leave)", () => {
      render(<ConferenceOverlay />);
      expect(screen.getByTitle("Выключить микрофон")).toBeInTheDocument();
      expect(screen.getByTitle("Выключить камеру")).toBeInTheDocument();
      expect(screen.getByTitle("Свернуть конференцию")).toBeInTheDocument();
      expect(screen.getByTitle("Покинуть конференцию")).toBeInTheDocument();
    });

    it("renders invite button", () => {
      render(<ConferenceOverlay />);
      expect(screen.getByTitle("Пригласить участников")).toBeInTheDocument();
      expect(screen.getByText("Пригласить")).toBeInTheDocument();
    });

    it("buttons are clickable and fire handlers", () => {
      render(<ConferenceOverlay />);
      fireEvent.click(screen.getByTitle("Выключить микрофон"));
      expect(confCtxMock.toggleAudio).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTitle("Выключить камеру"));
      expect(confCtxMock.toggleVideo).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTitle("Свернуть конференцию"));
      expect(confCtxMock.toggleMinimize).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTitle("Покинуть конференцию"));
      expect(confCtxMock.leaveConference).toHaveBeenCalledTimes(1);
    });

    it("all buttons visible and enabled", () => {
      render(<ConferenceOverlay />);
      const buttons = screen.getAllByRole("button");
      // invite + mic + camera + minimize + leave = 5
      expect(buttons.length).toBe(5);
      buttons.forEach((btn) => {
        expect(btn).toBeVisible();
        expect(btn).not.toBeDisabled();
      });
    });

    it("shows 'Подключение...' text when JOINING", () => {
      confCtxMock.confState = "joining";
      render(<ConferenceOverlay />);
      expect(screen.getByText("Подключение...")).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // MIC / CAMERA icon states
  // ------------------------------------------
  describe("Mic and camera icon states", () => {
    beforeEach(() => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
    });

    it("shows 'Включить микрофон' title when muted", () => {
      confCtxMock.isAudioMuted = true;
      render(<ConferenceOverlay />);
      expect(screen.getByTitle("Включить микрофон")).toBeInTheDocument();
    });

    it("shows 'Выключить микрофон' title when not muted", () => {
      confCtxMock.isAudioMuted = false;
      render(<ConferenceOverlay />);
      expect(screen.getByTitle("Выключить микрофон")).toBeInTheDocument();
    });

    it("shows 'Включить камеру' title when video off", () => {
      confCtxMock.isVideoOff = true;
      render(<ConferenceOverlay />);
      expect(screen.getByTitle("Включить камеру")).toBeInTheDocument();
    });

    it("shows 'Выключить камеру' title when video on", () => {
      confCtxMock.isVideoOff = false;
      render(<ConferenceOverlay />);
      expect(screen.getByTitle("Выключить камеру")).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // VIDEO ON/OFF — screen doesn't break
  // ------------------------------------------
  describe("Video toggle does not break layout", () => {
    it("overlay stays rendered when isVideoOff changes from false to true", () => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
      confCtxMock.isVideoOff = false;
      const { rerender, container } = render(<ConferenceOverlay />);

      // Toggle video off — overlay should still exist
      confCtxMock.isVideoOff = true;
      rerender(<ConferenceOverlay />);
      expect(container.querySelector(".fixed.inset-0")).not.toBeNull();
      expect(screen.getByTitle("Включить камеру")).toBeInTheDocument();
    });

    it("overlay stays rendered when isVideoOff changes from true to false", () => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
      confCtxMock.isVideoOff = true;
      const { rerender, container } = render(<ConferenceOverlay />);

      confCtxMock.isVideoOff = false;
      rerender(<ConferenceOverlay />);
      expect(container.querySelector(".fixed.inset-0")).not.toBeNull();
      expect(screen.getByTitle("Выключить камеру")).toBeInTheDocument();
    });

    it("all buttons remain after multiple video toggles", () => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
      const { rerender } = render(<ConferenceOverlay />);

      for (let i = 0; i < 5; i++) {
        confCtxMock.isVideoOff = !confCtxMock.isVideoOff;
        rerender(<ConferenceOverlay />);
      }
      // All buttons still here
      expect(screen.getByTitle("Покинуть конференцию")).toBeInTheDocument();
      expect(screen.getByTitle("Свернуть конференцию")).toBeInTheDocument();
    });

    it("video tiles remain when toggling camera", () => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
      confCtxMock.peerStreams = { Alice: mkStream() };
      confCtxMock.participants = ["Alice"];

      const { rerender, container } = render(<ConferenceOverlay />);
      const tilesBefore = container.querySelectorAll(".rounded-2xl.bg-gray-800").length;

      confCtxMock.isVideoOff = true;
      rerender(<ConferenceOverlay />);
      const tilesAfter = container.querySelectorAll(".rounded-2xl.bg-gray-800").length;

      expect(tilesAfter).toBe(tilesBefore);
    });
  });

  // ------------------------------------------
  // MINIMIZED mode
  // ------------------------------------------
  describe("Minimized mode", () => {
    beforeEach(() => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
      confCtxMock.participants = ["Alice"];
      confCtxMock.isMinimized = true;
    });

    it("shows 'Конференция' label", () => {
      render(<ConferenceOverlay />);
      expect(screen.getByText("Конференция")).toBeInTheDocument();
    });

    it("shows participant count", () => {
      render(<ConferenceOverlay />);
      expect(screen.getByText("2 участн.")).toBeInTheDocument();
    });

    it("renders 4 mini control buttons (mic, camera, expand, leave)", () => {
      render(<ConferenceOverlay />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(4);
      buttons.forEach((btn) => {
        expect(btn).toBeVisible();
        expect(btn).not.toBeDisabled();
      });
    });

    it("expand button fires toggleMinimize", () => {
      render(<ConferenceOverlay />);
      fireEvent.click(screen.getByTitle("Развернуть"));
      expect(confCtxMock.toggleMinimize).toHaveBeenCalledTimes(1);
    });

    it("leave button fires leaveConference", () => {
      render(<ConferenceOverlay />);
      fireEvent.click(screen.getByTitle("Покинуть"));
      expect(confCtxMock.leaveConference).toHaveBeenCalledTimes(1);
    });

    it("minimized mode does not render fullscreen grid", () => {
      const { container } = render(<ConferenceOverlay />);
      // No full-screen overlay
      expect(container.querySelector(".fixed.inset-0")).toBeNull();
    });

    it("minimized widget has correct z-index for overlay", () => {
      const { container } = render(<ConferenceOverlay />);
      const widget = container.firstChild;
      expect(widget.className).toContain("z-[9999]");
    });
  });

  // ------------------------------------------
  // MINIMIZE/EXPAND toggle - screen stability
  // ------------------------------------------
  describe("Minimize/expand cycle — screen stability", () => {
    it("switches between minimized and fullscreen without losing elements", () => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
      confCtxMock.participants = ["Alice"];
      confCtxMock.peerStreams = { Alice: mkStream() };

      // Start fullscreen
      confCtxMock.isMinimized = false;
      const { rerender } = render(<ConferenceOverlay />);
      expect(screen.getByTitle("Покинуть конференцию")).toBeInTheDocument();

      // Minimize
      confCtxMock.isMinimized = true;
      rerender(<ConferenceOverlay />);
      expect(screen.getByTitle("Покинуть")).toBeInTheDocument();
      expect(screen.getByText("Конференция")).toBeInTheDocument();

      // Expand back
      confCtxMock.isMinimized = false;
      rerender(<ConferenceOverlay />);
      expect(screen.getByTitle("Покинуть конференцию")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    it("rapid minimize/expand does not lose buttons", () => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
      const { rerender } = render(<ConferenceOverlay />);

      for (let i = 0; i < 10; i++) {
        confCtxMock.isMinimized = !confCtxMock.isMinimized;
        rerender(<ConferenceOverlay />);
      }
      // Should have buttons in current mode
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ------------------------------------------
  // INVITE MODAL
  // ------------------------------------------
  describe("Invite modal", () => {
    beforeEach(() => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
    });

    it("opens invite modal when invite button is clicked", () => {
      render(<ConferenceOverlay />);
      expect(screen.queryByTestId("invite-modal")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTitle("Пригласить участников"));
      expect(screen.getByTestId("invite-modal")).toBeInTheDocument();
    });

    it("closes invite modal when close button is clicked inside modal", () => {
      render(<ConferenceOverlay />);
      fireEvent.click(screen.getByTitle("Пригласить участников"));
      expect(screen.getByTestId("invite-modal")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("close-invite"));
      expect(screen.queryByTestId("invite-modal")).not.toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // GRID LAYOUT adapts to participant count
  // ------------------------------------------
  describe("Grid layout adapts to participants", () => {
    beforeEach(() => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = mkStream();
    });

    it("1 tile (just me) — grid-cols-1", () => {
      confCtxMock.peerStreams = {};
      confCtxMock.participants = [];
      const { container } = render(<ConferenceOverlay />);
      expect(container.querySelector(".grid-cols-1")).not.toBeNull();
    });

    it("2 tiles — grid-cols-2", () => {
      confCtxMock.peerStreams = { Alice: mkStream() };
      confCtxMock.participants = ["Alice"];
      const { container } = render(<ConferenceOverlay />);
      expect(container.querySelector(".grid-cols-2")).not.toBeNull();
    });

    it("5+ tiles — grid-cols-3", () => {
      confCtxMock.peerStreams = {
        A: mkStream(), B: mkStream(), C: mkStream(), D: mkStream(),
      };
      confCtxMock.participants = ["A", "B", "C", "D"];
      const { container } = render(<ConferenceOverlay />);
      expect(container.querySelector(".grid-cols-3")).not.toBeNull();
    });
  });

  // ------------------------------------------
  // VideoTile fallback when no stream
  // ------------------------------------------
  describe("VideoTile fallback", () => {
    it("shows first letter when peer stream is missing", () => {
      confCtxMock.confState = "active";
      confCtxMock.localStream = null;
      confCtxMock.peerStreams = { Zara: null };
      confCtxMock.participants = ["Zara"];
      render(<ConferenceOverlay />);
      // Fallback shows first letter of label
      expect(screen.getByText("Z")).toBeInTheDocument();
    });
  });
});
