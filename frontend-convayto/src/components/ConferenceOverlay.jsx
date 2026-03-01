// ==========================================
// ConferenceOverlay — fullscreen + minimized group video call UI
// ==========================================
import { useRef, useEffect, useState } from "react";
import { useConference, CONF_STATE, MAX_PARTICIPANTS } from "../contexts/ConferenceContext";
import {
  RiMicLine,
  RiMicOffLine,
  RiCameraLine,
  RiCameraOffLine,
  RiFullscreenLine,
  RiArrowDownSLine,
  RiUserAddLine,
} from "react-icons/ri";
import { HiPhoneXMark } from "react-icons/hi2";
import toast from "react-hot-toast";
import InviteConferenceModal from "./InviteConferenceModal";

/** Mounts a MediaStream on a <video> element */
function VideoTile({ stream, muted = false, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-gray-800 shadow-lg">
      {stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-4xl font-bold uppercase text-gray-500">
          {label?.[0] || "?"}
        </div>
      )}
      {label && (
        <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-xs text-white">
          {label}
        </span>
      )}
    </div>
  );
}

function ConferenceOverlay() {
  const {
    confState,
    localStream,
    peerStreams,
    participants,
    isAudioMuted,
    isVideoOff,
    isMinimized,
    leaveConference,
    toggleAudio,
    toggleVideo,
    toggleMinimize,
    getInviteLink,
    inviteUser,
    CONF_STATE: CS,
  } = useConference();

  const [showInviteModal, setShowInviteModal] = useState(false);

  // Dragging state for minimized widget
  const [dragPos, setDragPos] = useState({ x: 16, y: 80 });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isMinimized) return;

    const handleMove = (e) => {
      if (!draggingRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setDragPos({
        x: clientX - offsetRef.current.x,
        y: clientY - offsetRef.current.y,
      });
    };

    const handleUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isMinimized]);

  const startDrag = (e) => {
    draggingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    offsetRef.current = {
      x: clientX - dragPos.x,
      y: clientY - dragPos.y,
    };
  };

  if (confState === CS.IDLE) return null;

  const peerEntries = Object.entries(peerStreams);
  const totalTiles = 1 + peerEntries.length;
  const myUsername = localStorage.getItem("username");

  // ========== MINIMIZED MODE ==========
  if (isMinimized) {
    return (
      <div
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{ left: dragPos.x, top: dragPos.y }}
        className="fixed z-[9999] flex select-none items-center gap-2 rounded-2xl bg-gray-900/95 p-2 shadow-2xl backdrop-blur-sm"
      >
        {/* Mini local video */}
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-800">
          {localStream ? (
            <MiniVideo stream={localStream} muted />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-gray-500">
              {myUsername?.[0] || "?"}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col text-white">
          <span className="text-xs font-semibold">Конференция</span>
          <span className="text-xs text-green-400">
            {participants.length + 1} участн.
          </span>
        </div>

        {/* Mini controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleAudio}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm text-white transition active:scale-90 ${
              isAudioMuted ? "bg-red-500" : "bg-white/20"
            }`}
          >
            {isAudioMuted ? <RiMicOffLine /> : <RiMicLine />}
          </button>

          <button
            onClick={toggleVideo}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm text-white transition active:scale-90 ${
              isVideoOff ? "bg-red-500" : "bg-white/20"
            }`}
          >
            {isVideoOff ? <RiCameraOffLine /> : <RiCameraLine />}
          </button>

          <button
            onClick={toggleMinimize}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm text-white transition active:scale-90"
            title="Развернуть"
          >
            <RiFullscreenLine />
          </button>

          <button
            onClick={leaveConference}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-sm text-white transition active:scale-90"
            title="Покинуть"
          >
            <HiPhoneXMark />
          </button>
        </div>
      </div>
    );
  }

  // ========== FULLSCREEN MODE ==========
  // Grid columns based on participant count
  let gridCols = "grid-cols-1";
  if (totalTiles === 2) gridCols = "grid-cols-2";
  else if (totalTiles >= 3 && totalTiles <= 4) gridCols = "grid-cols-2";
  else if (totalTiles >= 5) gridCols = "grid-cols-3";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-900 text-white">
      {/* Invite modal */}
      {showInviteModal && (
        <InviteConferenceModal onClose={() => setShowInviteModal(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold">
          Конференция • {participants.length + 1}/{MAX_PARTICIPANTS}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500/70 px-3 py-1.5 text-sm font-medium transition hover:bg-blue-600 active:scale-95"
            title="Пригласить участников"
          >
            <RiUserAddLine className="text-base" />
            Пригласить
          </button>
          {confState === CS.JOINING && (
            <span className="animate-pulse text-sm text-gray-400">
              Подключение...
            </span>
          )}
        </div>
      </div>

      {/* Video grid */}
      <div
        className={`grid flex-1 gap-2 p-2 ${gridCols}`}
        style={{ gridAutoRows: "1fr" }}
      >
        {/* Local */}
        <VideoTile stream={localStream} muted label={`${myUsername} (Вы)`} />

        {/* Remote peers */}
        {peerEntries.map(([peerId, stream]) => (
          <VideoTile key={peerId} stream={stream} label={peerId} />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 pb-8 pt-4">
        <button
          onClick={toggleAudio}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition active:scale-95 ${
            isAudioMuted
              ? "bg-red-500/80 hover:bg-red-600"
              : "bg-white/20 hover:bg-white/30"
          }`}
          title={isAudioMuted ? "Включить микрофон" : "Выключить микрофон"}
        >
          {isAudioMuted ? <RiMicOffLine /> : <RiMicLine />}
        </button>

        <button
          onClick={toggleVideo}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition active:scale-95 ${
            isVideoOff
              ? "bg-red-500/80 hover:bg-red-600"
              : "bg-white/20 hover:bg-white/30"
          }`}
          title={isVideoOff ? "Включить камеру" : "Выключить камеру"}
        >
          {isVideoOff ? <RiCameraOffLine /> : <RiCameraLine />}
        </button>

        <button
          onClick={toggleMinimize}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl shadow-lg transition hover:bg-white/30 active:scale-95"
          title="Свернуть конференцию"
        >
          <RiArrowDownSLine />
        </button>

        <button
          onClick={leaveConference}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-3xl shadow-lg transition hover:bg-red-600 active:scale-95"
          title="Покинуть конференцию"
        >
          <HiPhoneXMark />
        </button>
      </div>
    </div>
  );
}

/** Helper: mini video for minimized mode */
function MiniVideo({ stream, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="h-full w-full object-cover"
    />
  );
}

export default ConferenceOverlay;
