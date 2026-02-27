// ==========================================
// CallOverlay — fullscreen UI for 1:1 voice/video calls
// ==========================================
import { useRef, useEffect } from "react";
import { useCall, CALL_STATE } from "../contexts/CallContext";
import { getRandomAvatar } from "../utils/avatarUtils";
import {
  RiPhoneFill,
  RiMicLine,
  RiMicOffLine,
  RiCameraLine,
  RiCameraOffLine,
  RiVideoChatFill,
} from "react-icons/ri";
import { HiPhoneXMark } from "react-icons/hi2";

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
    callDuration,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    CALL_STATE: CS,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

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

  if (callState === CS.IDLE) return null;

  const isVideo = callType === "video";
  const isRinging = callState === CS.RINGING;
  const isCalling = callState === CS.CALLING;
  const isActive = callState === CS.ACTIVE;

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

        {/* Active / calling: mute, video, end */}
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
