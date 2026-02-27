// ==========================================
// ConferenceOverlay — group video call UI (full-mesh grid)
// ==========================================
import { useRef, useEffect } from "react";
import { useConference, CONF_STATE } from "../contexts/ConferenceContext";
import {
  RiMicLine,
  RiMicOffLine,
  RiCameraLine,
  RiCameraOffLine,
} from "react-icons/ri";
import { HiPhoneXMark } from "react-icons/hi2";

/** Mounts a MediaStream on a <video> element */
function VideoTile({ stream, muted = false, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
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
    leaveConference,
    toggleAudio,
    toggleVideo,
    CONF_STATE: CS,
  } = useConference();

  if (confState === CS.IDLE) return null;

  const peerEntries = Object.entries(peerStreams);
  const totalTiles = 1 + peerEntries.length; // local + remotes
  const myUsername = localStorage.getItem("username");

  // Grid columns based on participant count
  let gridCols = "grid-cols-1";
  if (totalTiles === 2) gridCols = "grid-cols-2";
  else if (totalTiles >= 3 && totalTiles <= 4) gridCols = "grid-cols-2";
  else if (totalTiles >= 5) gridCols = "grid-cols-3";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold">
          Конференция • {participants.length + 1} участник
          {participants.length === 0
            ? ""
            : participants.length < 4
              ? "а"
              : "ов"}
        </h2>
        {confState === CS.JOINING && (
          <span className="animate-pulse text-sm text-gray-400">
            Подключение...
          </span>
        )}
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
              : "bg-white/20 hover:bg-white-/30"
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

export default ConferenceOverlay;
