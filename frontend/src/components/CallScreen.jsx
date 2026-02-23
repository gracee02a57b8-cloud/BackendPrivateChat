import { useState, useEffect, useRef } from 'react';

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
  onUpgradeToConference,
  isMinimized,
  onMinimize,
  onRestore,
}) {
  const isVideo = callType === 'video' && !isVideoOff;

  // Always render video elements; refs are always available
  const localVidEl = useRef(null);
  const remoteVidEl = useRef(null);
  const remoteAudioEl = useRef(null);

  // Always keep remoteVideoRef pointing to the <video> element
  // The ontrack handler routes the stream to it regardless of callType
  useEffect(() => {
    if (localVideoRef) localVideoRef.current = localVidEl.current;
    if (remoteVideoRef) remoteVideoRef.current = remoteVidEl.current;
  }, [localVideoRef, remoteVideoRef]);

  // Sync remote stream to audio element for audio-only playback
  useEffect(() => {
    if (remoteVidEl.current && remoteVidEl.current.srcObject) {
      remoteAudioEl.current.srcObject = remoteVidEl.current.srcObject;
    }
  }, [callType]);

  const statusLabel =
    callState === 'outgoing' ? 'Вызываем...' :
    callState === 'connecting' ? 'Подключение...' :
    formatDuration(callDuration);

  // ── Minimized floating widget ──
  if (isMinimized) {
    return (
      <div className="call-mini-widget" onClick={onRestore}>
        <audio ref={remoteAudioEl} autoPlay playsInline />
        <video ref={remoteVidEl} style={{ display: 'none' }} autoPlay playsInline />
        <video ref={localVidEl} style={{ display: 'none' }} autoPlay playsInline muted />
        <span className="call-mini-avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="call-mini-avatar-img" />
            : <span style={{ background: getAvatarColor(callPeer || 'U') }} className="call-mini-avatar-ph">{(callPeer || 'U').charAt(0).toUpperCase()}</span>
          }
        </span>
        <div className="call-mini-info">
          <span className="call-mini-name">{callPeer}</span>
          <span className="call-mini-dur">{statusLabel}</span>
        </div>
        <button className={`call-mini-btn call-mini-mute${isMuted ? ' active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleMute(); }} title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}>{isMuted ? '🔇' : '🎤'}</button>
        <button className="call-mini-btn call-mini-expand" onClick={(e) => { e.stopPropagation(); onRestore(); }} title="Развернуть">🔳</button>
        <button className="call-mini-btn call-mini-hangup" onClick={(e) => { e.stopPropagation(); onEndCall(); }} title="Завершить">📕</button>
      </div>
    );
  }

  // ── Full-screen call view ──
  return (
    <div className={`call-screen ${isVideo ? 'call-screen-video' : 'call-screen-audio'}`}>
      {/* Remote video — always rendered, hidden when audio-only */}
      <video
        ref={remoteVidEl}
        className="call-remote-video"
        autoPlay
        playsInline
        style={{ display: isVideo ? 'block' : 'none' }}
      />

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

      {/* Local video — always rendered, hidden when audio-only */}
      <video
        ref={localVidEl}
        className="call-local-video"
        autoPlay
        playsInline
        muted
        style={{ display: isVideo ? 'block' : 'none' }}
      />

      {/* Hidden audio element – plays remote audio always */}
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
        {onMinimize && (
          <button
            className="call-control-btn"
            onClick={onMinimize}
            title="Свернуть звонок"
          >
            🗕
          </button>
        )}

        <button
          className={`call-control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          className={`call-control-btn ${callType === 'video' && isVideoOff ? 'active' : ''}`}
          onClick={onToggleVideo}
          title={callType === 'video' && !isVideoOff ? 'Выключить камеру' : 'Включить камеру'}
        >
          {callType === 'video' && !isVideoOff ? '📹' : '📷'}
        </button>

        {callState === 'active' && onUpgradeToConference && (
          <button
            className="call-control-btn call-conf-btn"
            onClick={onUpgradeToConference}
            title="Создать конференцию (добавить участников)"
          >
            👥
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
