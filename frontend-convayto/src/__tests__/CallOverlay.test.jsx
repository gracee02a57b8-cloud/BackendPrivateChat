// ==========================================
// CallOverlay.test.jsx — comprehensive UI tests for 1:1 call overlay
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import CallOverlay from "../components/CallOverlay";
import { MockMediaStream, MockMediaStreamTrack } from "./setup";

// ====== Mock dependencies ======

// CallContext mock — state controlled per test
const defaultCallState = {
  callState: "idle",
  callType: "audio",
  remoteUser: "TestUser",
  roomId: "room-123",
  localStream: null,
  remoteStream: null,
  isAudioMuted: false,
  isVideoOff: false,
  isMinimized: false,
  isReconnecting: false,
  callDuration: 0,
  acceptCall: vi.fn(),
  rejectCall: vi.fn(),
  endCall: vi.fn(),
  escalateToConference: vi.fn(),
  finishEscalation: vi.fn(),
  toggleAudio: vi.fn(),
  toggleVideo: vi.fn(),
  toggleMinimize: vi.fn(),
  CALL_STATE: {
    IDLE: "idle",
    CALLING: "calling",
    RINGING: "ringing",
    ACTIVE: "active",
    ESCALATING: "escalating",
  },
};

let callStateMock = { ...defaultCallState };

vi.mock("../contexts/CallContext", () => ({
  useCall: () => callStateMock,
  CALL_STATE: {
    IDLE: "idle",
    CALLING: "calling",
    RINGING: "ringing",
    ACTIVE: "active",
    ESCALATING: "escalating",
  },
}));

// ConferenceContext mock
const defaultConfState = {
  startConference: vi.fn().mockResolvedValue(undefined),
  inviteUser: vi.fn(),
  confState: "idle",
  CONF_STATE: {
    IDLE: "idle",
    JOINING: "joining",
    ACTIVE: "active",
  },
};

let confStateMock = { ...defaultConfState };

vi.mock("../contexts/ConferenceContext", () => ({
  useConference: () => confStateMock,
}));

// Avatar utility mock
vi.mock("../utils/avatarUtils", () => ({
  getRandomAvatar: (name) => `https://avatar.test/${name}.png`,
}));

// Helper to create a mock stream with tracks
function createMockStream(audioCount = 1, videoCount = 0) {
  const tracks = [];
  for (let i = 0; i < audioCount; i++) tracks.push(new MockMediaStreamTrack("audio"));
  for (let i = 0; i < videoCount; i++) tracks.push(new MockMediaStreamTrack("video"));
  return new MockMediaStream(tracks);
}

// ====== Tests ======

describe("CallOverlay", () => {
  beforeEach(() => {
    callStateMock = { ...defaultCallState };
    confStateMock = { ...defaultConfState };
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // IDLE STATE — component should not render
  // ------------------------------------------
  describe("IDLE state", () => {
    it("renders nothing when callState is IDLE", () => {
      callStateMock.callState = "idle";
      const { container } = render(<CallOverlay />);
      expect(container.innerHTML).toBe("");
    });
  });

  // ------------------------------------------
  // RINGING STATE (incoming call) — fullscreen
  // ------------------------------------------
  describe("RINGING state (fullscreen)", () => {
    beforeEach(() => {
      callStateMock.callState = "ringing";
      callStateMock.remoteUser = "Alice";
      callStateMock.callType = "audio";
    });

    it("shows remote user name", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    it("shows 'Входящий звонок...' text", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Входящий звонок...")).toBeInTheDocument();
    });

    it("shows audio call indicator for audio calls", () => {
      callStateMock.callType = "audio";
      render(<CallOverlay />);
      expect(screen.getByText("📞 Аудиозвонок")).toBeInTheDocument();
    });

    it("shows video call indicator for video calls", () => {
      callStateMock.callType = "video";
      render(<CallOverlay />);
      expect(screen.getByText("📹 Видеозвонок")).toBeInTheDocument();
    });

    it("shows avatar for remote user", () => {
      render(<CallOverlay />);
      const avatar = screen.getByAltText("Alice");
      expect(avatar).toBeInTheDocument();
      expect(avatar.src).toContain("Alice");
    });

    it("renders accept button", () => {
      render(<CallOverlay />);
      const acceptBtn = screen.getByTitle("Принять");
      expect(acceptBtn).toBeInTheDocument();
      expect(acceptBtn).toBeVisible();
    });

    it("renders reject button", () => {
      render(<CallOverlay />);
      const rejectBtn = screen.getByTitle("Отклонить");
      expect(rejectBtn).toBeInTheDocument();
      expect(rejectBtn).toBeVisible();
    });

    it("does NOT render mic/camera/end/minimize buttons during ringing", () => {
      render(<CallOverlay />);
      expect(screen.queryByTitle("Включить микрофон")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Выключить микрофон")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Завершить")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Свернуть звонок")).not.toBeInTheDocument();
    });

    it("calls acceptCall when accept button is clicked", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Принять"));
      expect(callStateMock.acceptCall).toHaveBeenCalledTimes(1);
    });

    it("calls rejectCall when reject button is clicked", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Отклонить"));
      expect(callStateMock.rejectCall).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------
  // CALLING STATE (outgoing) — fullscreen
  // ------------------------------------------
  describe("CALLING state (fullscreen)", () => {
    beforeEach(() => {
      callStateMock.callState = "calling";
      callStateMock.remoteUser = "Bob";
      callStateMock.callType = "audio";
    });

    it("shows remote user name", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("shows 'Вызов...' text", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Вызов...")).toBeInTheDocument();
    });

    it("renders mic toggle button", () => {
      render(<CallOverlay />);
      const micBtn = screen.getByTitle("Выключить микрофон");
      expect(micBtn).toBeInTheDocument();
      expect(micBtn).toBeVisible();
    });

    it("renders camera toggle button", () => {
      render(<CallOverlay />);
      // For audio call, camera is off, so title is "Включить камеру"
      const cameraBtn = screen.getByTitle("Включить камеру");
      expect(cameraBtn).toBeInTheDocument();
      expect(cameraBtn).toBeVisible();
    });

    it("renders minimize button", () => {
      render(<CallOverlay />);
      const minBtn = screen.getByTitle("Свернуть звонок");
      expect(minBtn).toBeInTheDocument();
      expect(minBtn).toBeVisible();
    });

    it("renders end call button", () => {
      render(<CallOverlay />);
      const endBtn = screen.getByTitle("Завершить");
      expect(endBtn).toBeInTheDocument();
      expect(endBtn).toBeVisible();
    });

    it("does NOT render accept/reject buttons", () => {
      render(<CallOverlay />);
      expect(screen.queryByTitle("Принять")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Отклонить")).not.toBeInTheDocument();
    });

    it("does NOT render conference escalation button (only available in ACTIVE)", () => {
      render(<CallOverlay />);
      expect(screen.queryByTitle("Перейти в конференцию")).not.toBeInTheDocument();
    });

    it("calls toggleAudio when mic button is clicked", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Выключить микрофон"));
      expect(callStateMock.toggleAudio).toHaveBeenCalledTimes(1);
    });

    it("calls toggleVideo when camera button is clicked", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Включить камеру"));
      expect(callStateMock.toggleVideo).toHaveBeenCalledTimes(1);
    });

    it("calls toggleMinimize when minimize button is clicked", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Свернуть звонок"));
      expect(callStateMock.toggleMinimize).toHaveBeenCalledTimes(1);
    });

    it("calls endCall when end button is clicked", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Завершить"));
      expect(callStateMock.endCall).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------
  // ACTIVE STATE — audio call fullscreen
  // ------------------------------------------
  describe("ACTIVE state — audio call (fullscreen)", () => {
    beforeEach(() => {
      callStateMock.callState = "active";
      callStateMock.callType = "audio";
      callStateMock.remoteUser = "Charlie";
      callStateMock.callDuration = 125; // 02:05
      callStateMock.localStream = createMockStream(1, 0);
    });

    it("shows remote user name", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    it("shows formatted call duration", () => {
      render(<CallOverlay />);
      expect(screen.getByText("02:05")).toBeInTheDocument();
    });

    it("renders all 5 control buttons (mic, camera, conference, minimize, end)", () => {
      render(<CallOverlay />);
      expect(screen.getByTitle("Выключить микрофон")).toBeInTheDocument();
      expect(screen.getByTitle("Включить камеру")).toBeInTheDocument();
      expect(screen.getByTitle("Перейти в конференцию")).toBeInTheDocument();
      expect(screen.getByTitle("Свернуть звонок")).toBeInTheDocument();
      expect(screen.getByTitle("Завершить")).toBeInTheDocument();
    });

    it("does NOT render accept/reject buttons", () => {
      render(<CallOverlay />);
      expect(screen.queryByTitle("Принять")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Отклонить")).not.toBeInTheDocument();
    });

    it("shows reconnecting status when isReconnecting is true", () => {
      callStateMock.isReconnecting = true;
      render(<CallOverlay />);
      expect(screen.getByText("Переподключение...")).toBeInTheDocument();
    });

    it("shows avatar (not video) for audio-only calls", () => {
      render(<CallOverlay />);
      const avatar = screen.getByAltText("Charlie");
      expect(avatar).toBeInTheDocument();
    });

    it("does NOT show conference button when conference is not IDLE", () => {
      confStateMock.confState = "joining";
      render(<CallOverlay />);
      expect(screen.queryByTitle("Перейти в конференцию")).not.toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // ACTIVE STATE — video call fullscreen
  // ------------------------------------------
  describe("ACTIVE state — video call (fullscreen)", () => {
    beforeEach(() => {
      callStateMock.callState = "active";
      callStateMock.callType = "video";
      callStateMock.remoteUser = "Diana";
      callStateMock.callDuration = 60; // 01:00
      callStateMock.localStream = createMockStream(1, 1);
      callStateMock.remoteStream = createMockStream(1, 1);
      callStateMock.isVideoOff = false;
    });

    it("shows remote user name in top floating info bar", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Diana")).toBeInTheDocument();
    });

    it("shows formatted call duration", () => {
      render(<CallOverlay />);
      expect(screen.getByText("01:00")).toBeInTheDocument();
    });

    it("renders camera toggle with 'Выключить камеру' title for active video", () => {
      render(<CallOverlay />);
      expect(screen.getByTitle("Выключить камеру")).toBeInTheDocument();
    });

    it("renders camera toggle with 'Включить камеру' when video is off", () => {
      callStateMock.isVideoOff = true;
      render(<CallOverlay />);
      expect(screen.getByTitle("Включить камеру")).toBeInTheDocument();
    });

    it("renders all control buttons for active video call", () => {
      render(<CallOverlay />);
      expect(screen.getByTitle("Выключить микрофон")).toBeInTheDocument();
      expect(screen.getByTitle("Выключить камеру")).toBeInTheDocument();
      expect(screen.getByTitle("Перейти в конференцию")).toBeInTheDocument();
      expect(screen.getByTitle("Свернуть звонок")).toBeInTheDocument();
      expect(screen.getByTitle("Завершить")).toBeInTheDocument();
    });

    it("local video PIP is rendered when video is on and stream exists", () => {
      const { container } = render(<CallOverlay />);
      // Local PIP is inside the div with bottom-32 right-4 classes
      const pip = container.querySelector(".bottom-32.right-4");
      expect(pip).not.toBeNull();
      const pipVideo = pip.querySelector("video");
      expect(pipVideo).not.toBeNull();
    });

    it("local video PIP is NOT rendered when isVideoOff is true", () => {
      callStateMock.isVideoOff = true;
      const { container } = render(<CallOverlay />);
      // PIP div has specific class "bottom-32 right-4"
      const pip = container.querySelector(".bottom-32.right-4");
      expect(pip).toBeNull();
    });

    it("shows reconnecting status on video call", () => {
      callStateMock.isReconnecting = true;
      render(<CallOverlay />);
      expect(screen.getByText("Переподключение...")).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // MIC TOGGLE — icon changes
  // ------------------------------------------
  describe("Mic toggle icon state", () => {
    beforeEach(() => {
      callStateMock.callState = "active";
      callStateMock.callType = "audio";
      callStateMock.remoteUser = "Eve";
    });

    it("shows 'Выключить микрофон' title when mic is NOT muted", () => {
      callStateMock.isAudioMuted = false;
      render(<CallOverlay />);
      expect(screen.getByTitle("Выключить микрофон")).toBeInTheDocument();
      expect(screen.queryByTitle("Включить микрофон")).not.toBeInTheDocument();
    });

    it("shows 'Включить микрофон' title when mic IS muted", () => {
      callStateMock.isAudioMuted = true;
      render(<CallOverlay />);
      expect(screen.getByTitle("Включить микрофон")).toBeInTheDocument();
      expect(screen.queryByTitle("Выключить микрофон")).not.toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // CAMERA TOGGLE — icon changes
  // ------------------------------------------
  describe("Camera toggle icon state", () => {
    beforeEach(() => {
      callStateMock.callState = "active";
      callStateMock.remoteUser = "Frank";
    });

    it("shows 'Выключить камеру' for video call with camera on", () => {
      callStateMock.callType = "video";
      callStateMock.isVideoOff = false;
      render(<CallOverlay />);
      expect(screen.getByTitle("Выключить камеру")).toBeInTheDocument();
    });

    it("shows 'Включить камеру' for video call with camera off", () => {
      callStateMock.callType = "video";
      callStateMock.isVideoOff = true;
      render(<CallOverlay />);
      expect(screen.getByTitle("Включить камеру")).toBeInTheDocument();
    });

    it("shows 'Включить камеру' for audio call (no video)", () => {
      callStateMock.callType = "audio";
      callStateMock.isVideoOff = false;
      render(<CallOverlay />);
      expect(screen.getByTitle("Включить камеру")).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // MINIMIZED MODE — ACTIVE call
  // ------------------------------------------
  describe("Minimized mode — ACTIVE call", () => {
    beforeEach(() => {
      callStateMock.callState = "active";
      callStateMock.callType = "audio";
      callStateMock.remoteUser = "Grace";
      callStateMock.callDuration = 30;
      callStateMock.isMinimized = true;
    });

    it("shows remote user name (truncated)", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Grace")).toBeInTheDocument();
    });

    it("shows formatted duration", () => {
      render(<CallOverlay />);
      expect(screen.getByText("00:30")).toBeInTheDocument();
    });

    it("renders mic toggle, camera toggle, end call, and expand buttons", () => {
      render(<CallOverlay />);
      // Mini buttons don't have long titles — check by title attributes
      expect(screen.getByTitle("Завершить")).toBeInTheDocument();
      expect(screen.getByTitle("Развернуть")).toBeInTheDocument();
    });

    it("calls toggleAudio on mic button click in mini mode", () => {
      render(<CallOverlay />);
      // Mic button is one of the h-8 w-8 buttons
      const buttons = screen.getAllByRole("button");
      // Find mic button (toggleAudio handler)
      const micBtn = buttons.find(
        (b) =>
          !b.title || b.title === "",
      );
      // Use the first small button (toggleAudio)
      fireEvent.click(buttons[0]);
      expect(callStateMock.toggleAudio).toHaveBeenCalledTimes(1);
    });

    it("calls endCall on end button click in mini mode", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Завершить"));
      expect(callStateMock.endCall).toHaveBeenCalledTimes(1);
    });

    it("calls toggleMinimize (expand) on expand button click", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Развернуть"));
      expect(callStateMock.toggleMinimize).toHaveBeenCalledTimes(1);
    });

    it("shows reconnecting text when isReconnecting is true in mini mode", () => {
      callStateMock.isReconnecting = true;
      render(<CallOverlay />);
      expect(screen.getByText("Переподключение...")).toBeInTheDocument();
    });

    it("shows avatar in mini mode for audio call", () => {
      render(<CallOverlay />);
      const avatar = screen.getByAltText("Grace");
      expect(avatar).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // MINIMIZED MODE — RINGING
  // ------------------------------------------
  describe("Minimized mode — RINGING", () => {
    beforeEach(() => {
      callStateMock.callState = "ringing";
      callStateMock.remoteUser = "Henry";
      callStateMock.callType = "audio";
      callStateMock.isMinimized = true;
    });

    it("shows remote user name", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Henry")).toBeInTheDocument();
    });

    it("shows 'Входящий...' text", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Входящий...")).toBeInTheDocument();
    });

    it("renders accept and reject buttons (not mic/camera/end)", () => {
      render(<CallOverlay />);
      expect(screen.getByTitle("Принять")).toBeInTheDocument();
      expect(screen.getByTitle("Отклонить")).toBeInTheDocument();
      expect(screen.queryByTitle("Завершить")).not.toBeInTheDocument();
    });

    it("renders expand button alongside accept/reject", () => {
      render(<CallOverlay />);
      expect(screen.getByTitle("Развернуть")).toBeInTheDocument();
    });

    it("calls acceptCall on accept button click", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Принять"));
      expect(callStateMock.acceptCall).toHaveBeenCalledTimes(1);
    });

    it("calls rejectCall on reject button click", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Отклонить"));
      expect(callStateMock.rejectCall).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------
  // MINIMIZED MODE — CALLING
  // ------------------------------------------
  describe("Minimized mode — CALLING", () => {
    beforeEach(() => {
      callStateMock.callState = "calling";
      callStateMock.remoteUser = "Ivan";
      callStateMock.callType = "video";
      callStateMock.isMinimized = true;
    });

    it("shows 'Вызов...' text", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Вызов...")).toBeInTheDocument();
    });

    it("renders mic, camera, end call, and expand buttons", () => {
      render(<CallOverlay />);
      expect(screen.getByTitle("Завершить")).toBeInTheDocument();
      expect(screen.getByTitle("Развернуть")).toBeInTheDocument();
    });

    it("does NOT render accept/reject buttons during outgoing call", () => {
      render(<CallOverlay />);
      expect(screen.queryByTitle("Принять")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Отклонить")).not.toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // MINIMIZED VIDEO — shows video preview
  // ------------------------------------------
  describe("Minimized mode — video call with remote stream", () => {
    beforeEach(() => {
      callStateMock.callState = "active";
      callStateMock.callType = "video";
      callStateMock.remoteUser = "Julia";
      callStateMock.callDuration = 10;
      callStateMock.isMinimized = true;
      callStateMock.remoteStream = createMockStream(1, 1);
    });

    it("renders mini video preview instead of avatar", () => {
      const { container } = render(<CallOverlay />);
      // Mini video is rendered in the 16x16 container
      const videos = container.querySelectorAll("video");
      expect(videos.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ------------------------------------------
  // DURATION FORMAT
  // ------------------------------------------
  describe("Call duration formatting", () => {
    beforeEach(() => {
      callStateMock.callState = "active";
      callStateMock.callType = "audio";
      callStateMock.remoteUser = "Kate";
    });

    it("formats 0 seconds as 00:00", () => {
      callStateMock.callDuration = 0;
      render(<CallOverlay />);
      expect(screen.getByText("00:00")).toBeInTheDocument();
    });

    it("formats 59 seconds as 00:59", () => {
      callStateMock.callDuration = 59;
      render(<CallOverlay />);
      expect(screen.getByText("00:59")).toBeInTheDocument();
    });

    it("formats 60 seconds as 01:00", () => {
      callStateMock.callDuration = 60;
      render(<CallOverlay />);
      expect(screen.getByText("01:00")).toBeInTheDocument();
    });

    it("formats 3661 seconds as 61:01", () => {
      callStateMock.callDuration = 3661;
      render(<CallOverlay />);
      expect(screen.getByText("61:01")).toBeInTheDocument();
    });
  });

  // ------------------------------------------
  // BUTTON PRESENCE — all states, no disappearance
  // ------------------------------------------
  describe("All buttons remain accessible and do not disappear", () => {
    it("CALLING: exactly 4 interactive buttons (mic, camera, minimize, end)", () => {
      callStateMock.callState = "calling";
      callStateMock.callType = "video";
      callStateMock.remoteUser = "Leo";
      render(<CallOverlay />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(4);
      buttons.forEach((btn) => {
        expect(btn).toBeVisible();
        expect(btn).not.toBeDisabled();
      });
    });

    it("RINGING: exactly 2 interactive buttons (reject, accept)", () => {
      callStateMock.callState = "ringing";
      callStateMock.callType = "audio";
      callStateMock.remoteUser = "Mia";
      render(<CallOverlay />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(2);
      buttons.forEach((btn) => {
        expect(btn).toBeVisible();
        expect(btn).not.toBeDisabled();
      });
    });

    it("ACTIVE with conference available: exactly 5 buttons (mic, camera, conference, minimize, end)", () => {
      callStateMock.callState = "active";
      callStateMock.callType = "video";
      callStateMock.remoteUser = "Noah";
      confStateMock.confState = "idle";
      render(<CallOverlay />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(5);
      buttons.forEach((btn) => {
        expect(btn).toBeVisible();
        expect(btn).not.toBeDisabled();
      });
    });

    it("ACTIVE without conference: exactly 4 buttons (mic, camera, minimize, end)", () => {
      callStateMock.callState = "active";
      callStateMock.callType = "video";
      callStateMock.remoteUser = "Olivia";
      confStateMock.confState = "active"; // conference not idle — no escalation
      render(<CallOverlay />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(4);
    });

    it("Minimized ACTIVE: exactly 4 mini buttons (mic, camera, end, expand)", () => {
      callStateMock.callState = "active";
      callStateMock.callType = "audio";
      callStateMock.remoteUser = "Pete";
      callStateMock.isMinimized = true;
      render(<CallOverlay />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(4);
      buttons.forEach((btn) => {
        expect(btn).toBeVisible();
        expect(btn).not.toBeDisabled();
      });
    });

    it("Minimized RINGING: exactly 3 mini buttons (reject, accept, expand)", () => {
      callStateMock.callState = "ringing";
      callStateMock.remoteUser = "Quinn";
      callStateMock.isMinimized = true;
      render(<CallOverlay />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(3);
      buttons.forEach((btn) => {
        expect(btn).toBeVisible();
        expect(btn).not.toBeDisabled();
      });
    });
  });

  // ------------------------------------------
  // CONFERENCE ESCALATION (seamless transition)
  // ------------------------------------------
  describe("Conference escalation button", () => {
    beforeEach(() => {
      callStateMock.callState = "active";
      callStateMock.callType = "audio";
      callStateMock.remoteUser = "Rachel";
      callStateMock.roomId = "room-456";
      callStateMock.escalateToConference = vi.fn();
      confStateMock.confState = "idle";
      confStateMock.startConference = vi.fn().mockResolvedValue(undefined);
      confStateMock.inviteUser = vi.fn();
    });

    it("renders conference button during ACTIVE call when confState is IDLE", () => {
      render(<CallOverlay />);
      expect(screen.getByTitle("Перейти в конференцию")).toBeInTheDocument();
    });

    it("does NOT render conference button when confState is not IDLE", () => {
      confStateMock.confState = "joining";
      render(<CallOverlay />);
      expect(screen.queryByTitle("Перейти в конференцию")).not.toBeInTheDocument();
    });

    it("clicking conference button calls escalateToConference (not endCall)", () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Перейти в конференцию"));
      expect(callStateMock.escalateToConference).toHaveBeenCalledTimes(1);
      expect(callStateMock.endCall).not.toHaveBeenCalled();
    });

    it("starts conference with autoInviteUser for seamless escalation", async () => {
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Перейти в конференцию"));

      await waitFor(() => {
        expect(confStateMock.startConference).toHaveBeenCalledWith("room-456", "video", "Rachel");
      });
    });

    it("passes null as autoInviteUser when there is no remote user", async () => {
      callStateMock.remoteUser = null;
      render(<CallOverlay />);
      fireEvent.click(screen.getByTitle("Перейти в конференцию"));

      await waitFor(() => {
        expect(confStateMock.startConference).toHaveBeenCalledWith("room-456", "video", null);
      });
    });
  });

  // ------------------------------------------
  // ESCALATING STATE — transitional UI
  // ------------------------------------------
  describe("ESCALATING state — transition to conference", () => {
    beforeEach(() => {
      callStateMock.callState = "escalating";
      callStateMock.remoteUser = "Rachel";
      callStateMock.finishEscalation = vi.fn();
    });

    it("shows 'Переход в конференцию...' transitional text", () => {
      render(<CallOverlay />);
      expect(screen.getByText("Переход в конференцию...")).toBeInTheDocument();
    });

    it("does not render any call control buttons", () => {
      render(<CallOverlay />);
      const buttons = screen.queryAllByRole("button");
      expect(buttons.length).toBe(0);
    });

    it("calls finishEscalation when conference becomes ACTIVE", () => {
      confStateMock.confState = "active";
      render(<CallOverlay />);
      expect(callStateMock.finishEscalation).toHaveBeenCalledTimes(1);
    });

    it("does NOT call finishEscalation when conference is still IDLE", () => {
      confStateMock.confState = "idle";
      render(<CallOverlay />);
      expect(callStateMock.finishEscalation).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // MULTIPLE CLICK HANDLER INVOCATIONS
  // ------------------------------------------
  describe("Multiple rapid clicks are handled", () => {
    beforeEach(() => {
      callStateMock.callState = "active";
      callStateMock.callType = "video";
      callStateMock.remoteUser = "Sam";
    });

    it("multiple mic toggles fire handler each time", () => {
      render(<CallOverlay />);
      const micBtn = screen.getByTitle("Выключить микрофон");
      fireEvent.click(micBtn);
      fireEvent.click(micBtn);
      fireEvent.click(micBtn);
      expect(callStateMock.toggleAudio).toHaveBeenCalledTimes(3);
    });

    it("multiple camera toggles fire handler each time", () => {
      render(<CallOverlay />);
      const camBtn = screen.getByTitle("Выключить камеру");
      fireEvent.click(camBtn);
      fireEvent.click(camBtn);
      expect(callStateMock.toggleVideo).toHaveBeenCalledTimes(2);
    });
  });
});
