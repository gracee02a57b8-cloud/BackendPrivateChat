// ==========================================
// CallOverlay — fullscreen + minimized UI for 1:1 voice/video calls
// ==========================================
import { useRef, useEffect, useState, useCallback } from "react";
import { useCall, CALL_STATE } from "../contexts/CallContext";
import { useConference } from "../contexts/ConferenceContext";
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
  RiGroupLine,
} from "react-icons/ri";
import { HiPhoneXMark } from "react-icons/hi2";

// ====== Ringtone using Web Audio API ======
let ringtoneCtx = null;
let ringtoneInterval = null;

function startRingtone(isOutgoing = false) {
  stopRingtone();
  try {
    ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Resume for mobile: AudioContext may be suspended when created outside user gesture
    if (ringtoneCtx.state === "suspended") ringtoneCtx.resume().catch(() => {});
    const playTone = () => {
      if (!ringtoneCtx) return;
      if (isOutgoing) {
        // Outgoing ringback: single 425Hz tone (European standard)
        const osc = ringtoneCtx.createOscillator();
        const gain = ringtoneCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = 425;
        gain.gain.setValueAtTime(0.1, ringtoneCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ringtoneCtx.currentTime + 1.0);
        osc.connect(gain);
        gain.connect(ringtoneCtx.destination);
        osc.start(ringtoneCtx.currentTime);
        osc.stop(ringtoneCtx.currentTime + 1.0);
      } else {
        // Incoming ring: two-tone 440Hz+480Hz (louder)
        [440, 480].forEach((freq, i) => {
          const osc = ringtoneCtx.createOscillator();
          const gain = ringtoneCtx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.2, ringtoneCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ringtoneCtx.currentTime + 0.8);
          osc.connect(gain);
          gain.connect(ringtoneCtx.destination);
          osc.start(ringtoneCtx.currentTime + i * 0.15);
          osc.stop(ringtoneCtx.currentTime + 0.8 + i * 0.15);
        });
      }
    };
    playTone();
    ringtoneInterval = setInterval(playTone, isOutgoing ? 3500 : 2000);
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
    roomId,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    isMinimized,
    isReconnecting,
    callDuration,
    acceptCall,
    rejectCall,
    endCall,
    escalateToConference,
    finishEscalation,
    toggleAudio,
    toggleVideo,
    toggleMinimize,
    CALL_STATE: CS,
  } = useCall();

  const { startConference, confState, CONF_STATE } = useConference();

  // Escalate 1:1 call → group conference in the same room (seamless transition)
  const handleEscalateToConference = useCallback(() => {
    const room = roomId;
    const targetUser = remoteUser;
    if (!room) return;
    escalateToConference();
    // Pass targetUser so invite is sent from inside startConference
    // (where roomId/confId are local variables — no stale closure issues)
    startConference(room, "video", targetUser || null);
  }, [roomId, remoteUser, escalateToConference, startConference]);

  // Auto-clear ESCALATING state when conference becomes active
  useEffect(() => {
    if (callState === CS.ESCALATING && confState === CONF_STATE.ACTIVE) {
      finishEscalation();
    }
  }, [callState, confState, CS.ESCALATING, CONF_STATE.ACTIVE, finishEscalation]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const miniVideoRef = useRef(null);

  // Dragging state for minimized widget
  const [dragPos, setDragPos] = useState({ x: 16, y: 16 });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  // Attach local stream to video element (isMinimized/isVideoOff dep: DOM element recreated on toggle)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isMinimized, isVideoOff]);

  // Attach remote stream to video/audio element (isMinimized/callState dep: DOM element swap)
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, isMinimized, callState]);

  // Attach remote stream to mini video element
  useEffect(() => {
    if (miniVideoRef.current && remoteStream) {
      miniVideoRef.current.srcObject = remoteStream;
      miniVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, isMinimized]);

  // Play ringtone: incoming ring or outgoing ringback + vibrate on incoming
  useEffect(() => {
    if (callState === CS.RINGING) {
      startRingtone(false);
      // Vibrate on mobile for incoming calls
      try { navigator.vibrate?.([300, 200, 300, 200, 300]); } catch {}
    } else if (callState === CS.CALLING) {
      startRingtone(true);
    } else {
      stopRingtone();
      try { navigator.vibrate?.(0); } catch {} // stop vibration
    }
    return () => {
      stopRingtone();
      try { navigator.vibrate?.(0); } catch {}
    };
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

  // Transitional screen: 1:1 call → conference
  if (callState === CS.ESCALATING) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-900/95 text-white">
        <div className="flex flex-col items-center gap-4">
          <RiGroupLine className="text-5xl text-blue-400 animate-pulse" />
          <p className="text-xl font-semibold">Переход в конференцию...</p>
        </div>
      </div>
    );
  }

  const isVideo = callType === "video";
  const isRinging = callState === CS.RINGING;
  const isCalling = callState === CS.CALLING;
  const isActive = callState === CS.ACTIVE;

  // ========== MINIMIZED MODE ==========
  if (isMinimized && (isActive || isCalling || isRinging)) {
    return (
      <div
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{ left: dragPos.x, top: dragPos.y }}
        className="fixed z-[9999] flex select-none items-center gap-2 rounded-2xl bg-gray-900/95 p-2 shadow-2xl backdrop-blur-sm"
      >
        {/* Mini video or avatar */}
        <div className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl ${isRinging ? 'ring-2 ring-green-400 animate-pulse' : ''}`}>
          {isVideo && remoteStream && !isRinging ? (
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
          <span className={`text-xs ${isRinging ? 'text-green-400 animate-pulse' : isReconnecting ? 'text-yellow-400 animate-pulse' : 'text-green-400'}`}>
            {isActive ? (isReconnecting ? "Переподключение..." : formatDuration(callDuration)) : isRinging ? "Входящий..." : "Вызов..."}
          </span>
        </div>

        {/* Mini controls */}
        <div className="flex items-center gap-1">
          {isRinging ? (
            <>
              <button
                onClick={rejectCall}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-sm text-white transition active:scale-90"
                title="Отклонить"
              >
                <HiPhoneXMark />
              </button>
              <button
                onClick={acceptCall}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-sm text-white transition active:scale-90"
                title="Принять"
              >
                <RiPhoneFill />
              </button>
            </>
          ) : (
            <>
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
                  isVideoOff || !isVideo ? "bg-red-500/70" : "bg-white/20"
                }`}
                title={isVideo ? (isVideoOff ? "Включить камеру" : "Выключить камеру") : "Включить камеру"}
              >
                {isVideoOff || !isVideo ? <RiCameraOffLine /> : <RiCameraLine />}
              </button>

              <button
                onClick={endCall}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-sm text-white transition active:scale-90"
                title="Завершить"
              >
                <HiPhoneXMark />
              </button>
            </>
          )}

          <button
            onClick={toggleMinimize}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm text-white transition active:scale-90"
            title="Развернуть"
          >
            <RiFullscreenLine />
          </button>
        </div>
      </div>
    );
  }

  // ========== FULLSCREEN MODE ==========
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-900/95 text-white">
      {/* Remote stream — single <video> element, never swapped (handles both audio and video) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={isVideo && isActive
          ? "absolute inset-0 h-full w-full object-cover"
          : "absolute w-px h-px opacity-0 pointer-events-none"
        }
      />

      {/* Active video call: minimal floating info at top */}
      {isVideo && isActive && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{remoteUser}</span>
            {isReconnecting ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-xs text-yellow-400 animate-pulse">Переподключение...</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 tabular-nums">{formatDuration(callDuration)}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Top info bar — shown during calling, ringing, or audio calls */}
      {!(isVideo && isActive) && (
        <div className="relative z-10 flex flex-col items-center pt-12">
          {/* Avatar with pulse rings during calling/ringing */}
          <div className="relative">
            {(isRinging || isCalling) && (
              <>
                <div className="absolute -inset-3 rounded-full border-2 border-green-400/40 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute -inset-6 rounded-full border border-green-400/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
              </>
            )}
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full shadow-lg">
              <img src={getRandomAvatar(remoteUser)} alt={remoteUser} className="h-full w-full object-cover" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold">{remoteUser}</p>
          <p className="mt-1 text-sm text-gray-300">
            {isRinging && "Входящий звонок..."}
            {isCalling && "Вызов..."}
            {isActive && (isReconnecting
              ? <span className="text-yellow-400 animate-pulse">Переподключение...</span>
              : formatDuration(callDuration)
            )}
          </p>
          {isRinging && (
            <p className="mt-1 text-xs text-gray-400">
              {isVideo ? "📹 Видеозвонок" : "📞 Аудиозвонок"}
            </p>
          )}
        </div>
      )}

      {/* Local video PIP (video calls only) */}
      {isVideo && localStream && !isVideoOff && (
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

        {/* Active / calling: mute, video, conference, minimize, end */}
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

            <button
              onClick={toggleVideo}
              className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition active:scale-95 ${
                isVideoOff || !isVideo
                  ? "bg-red-500/80 hover:bg-red-600"
                  : "bg-white/20 hover:bg-white/30"
              }`}
              title={isVideo ? (isVideoOff ? "Включить камеру" : "Выключить камеру") : "Включить камеру"}
            >
              {isVideoOff || !isVideo ? <RiCameraOffLine /> : <RiCameraLine />}
            </button>

            {/* Escalate to group conference */}
            {isActive && confState === CONF_STATE.IDLE && (
              <button
                onClick={handleEscalateToConference}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/70 text-2xl shadow-lg transition hover:bg-blue-600 active:scale-95"
                title="Перейти в конференцию"
              >
                <RiGroupLine />
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
