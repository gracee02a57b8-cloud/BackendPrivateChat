// ==========================================
// CallOverlay — fullscreen + minimized UI for 1:1 voice/video calls
// ==========================================
import { useRef, useEffect, useState, useCallback } from "react";
import { useCall, CALL_STATE } from "../contexts/CallContext";
import { getRandomAvatar } from "../utils/avatarUtils";
import {
  RiPhoneFill,
  RiMicLine,
  RiMicOffLine,
  RiCameraLine,
  RiCameraOffLine,
  RiVideoChatFill,
  RiFullscreenLine,
  RiArrowDownSLine,
} from "react-icons/ri";
import { HiPhoneXMark } from "react-icons/hi2";

// ====== Ringtone using Web Audio API ======
let ringtoneCtx = null;
let ringtoneInterval = null;

function startRingtone() {
  stopRingtone();
  try {
    ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = () => {
      if (!ringtoneCtx) return;
      // Two-tone ring: 440Hz then 480Hz
      [440, 480].forEach((freq, i) => {
        const osc = ringtoneCtx.createOscillator();
        const gain = ringtoneCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ringtoneCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ringtoneCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(ringtoneCtx.destination);
        osc.start(ringtoneCtx.currentTime + i * 0.15);
        osc.stop(ringtoneCtx.currentTime + 0.8 + i * 0.15);
      });
    };
    playTone();
    ringtoneInterval = setInterval(playTone, 2000);
  } catch (e) {
    console.warn("[Ringtone] Failed to play:", e);
  }
}

function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (ringtoneCtx) {
    ringtoneCtx.close().catch(() => {});
    ringtoneCtx = null;
  }
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function CallOverlay() {
  const {
    callState,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    isMinimized,
    callDuration,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleMinimize,
    CALL_STATE: CS,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const miniVideoRef = useRef(null);

  // Dragging state for minimized widget
  const [dragPos, setDragPos] = useState({ x: 16, y: 16 });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video/audio element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Attach remote stream to mini video element
  useEffect(() => {
    if (miniVideoRef.current && remoteStream) {
      miniVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isMinimized]);

  // Play ringtone on incoming call (RINGING) or outgoing (CALLING)
  useEffect(() => {
    if (callState === CS.RINGING || callState === CS.CALLING) {
      startRingtone();
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [callState, CS.RINGING, CS.CALLING]);

  // Drag handlers for minimized PIP
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

  if (callState === CS.IDLE) return null;

  const isVideo = callType === "video";
  const isRinging = callState === CS.RINGING;
  const isCalling = callState === CS.CALLING;
  const isActive = callState === CS.ACTIVE;

  // ========== MINIMIZED MODE ==========
  if (isMinimized && (isActive || isCalling)) {
    return (
      <div
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{ left: dragPos.x, top: dragPos.y }}
        className="fixed z-[9999] flex select-none items-center gap-2 rounded-2xl bg-gray-900/95 p-2 shadow-2xl backdrop-blur-sm"
      >
        {/* Mini video or avatar */}
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
          {isVideo && remoteStream ? (
            <video
              ref={miniVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={getRandomAvatar(remoteUser)}
              alt={remoteUser}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col text-white">
          <span className="text-xs font-semibold truncate max-w-[80px]">
            {remoteUser}
          </span>
          <span className="text-xs text-green-400">
            {isActive ? formatDuration(callDuration) : "Вызов..."}
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

          {isVideo && (
            <button
              onClick={toggleVideo}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm text-white transition active:scale-90 ${
                isVideoOff ? "bg-red-500" : "bg-white/20"
              }`}
            >
              {isVideoOff ? <RiCameraOffLine /> : <RiCameraLine />}
            </button>
          )}

          <button
            onClick={toggleMinimize}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm text-white transition active:scale-90"
            title="Развернуть"
          >
            <RiFullscreenLine />
          </button>

          <button
            onClick={endCall}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-sm text-white transition active:scale-90"
            title="Завершить"
          >
            <HiPhoneXMark />
          </button>
        </div>
      </div>
    );
  }

  // ========== FULLSCREEN MODE ==========
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-900/95 text-white">
      {/* Remote video (or dark bg for audio) */}
      {isVideo && isActive ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <audio ref={remoteVideoRef} autoPlay />
      )}

      {/* Top info bar */}
      <div className="relative z-10 flex flex-col items-center pt-12">
        {/* Avatar */}
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full shadow-lg">
          <img src={getRandomAvatar(remoteUser)} alt={remoteUser} className="h-full w-full object-cover" />
        </div>
        <p className="mt-4 text-2xl font-semibold">{remoteUser}</p>
        <p className="mt-1 text-sm text-gray-300">
          {isRinging && "Входящий звонок..."}
          {isCalling && "Вызов..."}
          {isActive && formatDuration(callDuration)}
        </p>
        {isRinging && (
          <p className="mt-1 text-xs text-gray-400">
            {isVideo ? "📹 Видеозвонок" : "📞 Аудиозвонок"}
          </p>
        )}
      </div>

      {/* Local video PIP (video calls only) */}
      {isVideo && localStream && (
        <div className="absolute bottom-32 right-4 z-20 h-40 w-28 overflow-hidden rounded-2xl border-2 border-white/30 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Control buttons */}
      <div className="relative z-10 mt-auto flex items-center justify-center gap-6 pb-12">
        {/* Incoming call: accept / reject */}
        {isRinging && (
          <>
            <button
              onClick={rejectCall}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-3xl shadow-lg transition hover:bg-red-600 active:scale-95"
              title="Отклонить"
            >
              <HiPhoneXMark />
            </button>
            <button
              onClick={acceptCall}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-3xl shadow-lg transition hover:bg-green-600 active:scale-95"
              title="Принять"
            >
              {isVideo ? <RiVideoChatFill /> : <RiPhoneFill />}
            </button>
          </>
        )}

        {/* Active / calling: mute, video, minimize, end */}
        {(isActive || isCalling) && (
          <>
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

            {isVideo && (
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
            )}

            <button
              onClick={toggleMinimize}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl shadow-lg transition hover:bg-white/30 active:scale-95"
              title="Свернуть звонок"
            >
              <RiArrowDownSLine />
            </button>

            <button
              onClick={endCall}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-3xl shadow-lg transition hover:bg-red-600 active:scale-95"
              title="Завершить"
            >
              <HiPhoneXMark />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default CallOverlay;
