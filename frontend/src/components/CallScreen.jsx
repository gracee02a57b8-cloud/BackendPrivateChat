import { useEffect, useRef } from 'react';

const AVATAR_COLORS = [
  '#e94560', '#4ecca3', '#f0a500', '#a855f7',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Active / outgoing / connecting call screen.
 * Shows local & remote video (for video calls) or avatar + timer (for audio).
 */
export default function CallScreen({
  callState,   // 'outgoing' | 'connecting' | 'active'
  callPeer,
  callType,
  callDuration,
  isMuted,
  isVideoOff,
  avatarUrl,
  localVideoRef,
  remoteVideoRef,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  securityCode,
}) {
  const isVideo = callType === 'video';

  // Attach ref to video elements
  const localVidEl = useRef(null);
  const remoteVidEl = useRef(null);
  const remoteAudioEl = useRef(null);

  useEffect(() => {
    if (localVideoRef) localVideoRef.current = localVidEl.current;
    if (remoteVideoRef) {
      // For video calls → use <video>; for audio calls → use hidden <audio>
      remoteVideoRef.current = isVideo ? remoteVidEl.current : remoteAudioEl.current;
    }
  }, [localVideoRef, remoteVideoRef, isVideo]);

  const statusLabel =
    callState === 'outgoing' ? 'Вызываем...' :
    callState === 'connecting' ? 'Подключение...' :
    formatDuration(callDuration);

  return (
    <div className={`call-screen ${isVideo ? 'call-screen-video' : 'call-screen-audio'}`}>
      {/* Remote video (full background) */}
      {isVideo && (
        <video
          ref={remoteVidEl}
          className="call-remote-video"
          autoPlay
          playsInline
        />
      )}

      {/* Audio call: show peer avatar */}
      {!isVideo && (
        <div className="call-audio-center">
          <div className="call-peer-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt={callPeer} className="call-peer-avatar-img" />
            ) : (
              <div
                className="call-peer-avatar-placeholder"
                style={{ background: getAvatarColor(callPeer || 'U') }}
              >
                {(callPeer || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="call-peer-name">{callPeer}</span>
          <span className="call-status-label">{statusLabel}</span>
        </div>
      )}

      {/* Video call: status overlay */}
      {isVideo && (
        <div className="call-video-overlay">
          <span className="call-peer-name">{callPeer}</span>
          <span className="call-status-label">{statusLabel}</span>
        </div>
      )}

      {/* Local video (picture-in-picture) */}
      {isVideo && (
        <video
          ref={localVidEl}
          className="call-local-video"
          autoPlay
          playsInline
          muted
        />
      )}

      {/* Hidden audio element – plays remote audio for audio-only calls */}
      <audio ref={remoteAudioEl} autoPlay playsInline />

      {/* Security code (Bug 5) */}
      {securityCode && callState === 'active' && (
        <div className="call-security-code">
          <span className="call-security-icon">🔒</span>
          <span className="call-security-label">Код безопасности</span>
          <span className="call-security-digits">{securityCode}</span>
        </div>
      )}

      {/* Controls bar */}
      <div className="call-controls">
        <button
          className={`call-control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        {isVideo && (
          <button
            className={`call-control-btn ${isVideoOff ? 'active' : ''}`}
            onClick={onToggleVideo}
            title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
          >
            {isVideoOff ? '📷' : '📹'}
          </button>
        )}

        <button
          className="call-control-btn call-hangup-btn"
          onClick={onEndCall}
          title="Завершить звонок"
        >
          📕
        </button>
      </div>
    </div>
  );
}
