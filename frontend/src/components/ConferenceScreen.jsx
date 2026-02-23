import { useEffect, useRef, useState, useCallback } from 'react';

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
 * ConferenceScreen — full-screen group video/audio call UI.
 *
 * Shows a responsive grid of participant tiles, each with video or avatar fallback.
 * Controls: mute, video toggle, share link, hang up.
 */
export default function ConferenceScreen({
  confState,
  participants,
  username,
  confType,
  confDuration,
  isMuted,
  isVideoOff,
  avatarMap,
  localVideoRef,
  setRemoteVideoRef,
  getRemoteStream,
  onLeave,
  onToggleMute,
  onToggleVideo,
  onCopyLink,
  isMinimized,
  onMinimize,
  onRestore,
}) {
  const isVideo = confType === 'video';
  const localVidEl = useRef(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Attach local video ref
  useEffect(() => {
    if (localVideoRef) localVideoRef.current = localVidEl.current;
  }, [localVideoRef]);

  const handleCopyLink = useCallback(async () => {
    const ok = await onCopyLink();
    if (ok) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [onCopyLink]);

  const remotePeers = participants.filter(p => p !== username);
  const totalTiles = remotePeers.length + 1; // +1 for self

  // Calculate grid class based on number of participants
  const getGridClass = () => {
    if (totalTiles <= 1) return 'conf-grid-1';
    if (totalTiles <= 2) return 'conf-grid-2';
    if (totalTiles <= 4) return 'conf-grid-4';
    if (totalTiles <= 6) return 'conf-grid-6';
    return 'conf-grid-10';
  };

  const statusLabel =
    confState === 'joining' ? 'Подключение...' :
    formatDuration(confDuration);

  // ── Minimized floating widget ──
  if (isMinimized) {
    return (
      <div className="conf-mini-widget" onClick={onRestore}>
        {/* Keep local video ref alive while minimized */}
        <video ref={localVidEl} style={{ display: 'none' }} autoPlay playsInline muted />
        <span className="conf-mini-icon">📞</span>
        <div className="conf-mini-info">
          <span className="conf-mini-name">Конференция</span>
          <span className="conf-mini-dur">{participants.length} чел. · {statusLabel}</span>
        </div>
        <button className={`call-mini-btn conf-mini-mute${isMuted ? ' active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleMute(); }} title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}>{isMuted ? '🔇' : '🎤'}</button>
        <button className="call-mini-btn call-mini-expand" onClick={(e) => { e.stopPropagation(); onRestore(); }} title="Развернуть">🔳</button>
        <button className="call-mini-btn call-mini-hangup" onClick={(e) => { e.stopPropagation(); onLeave(); }} title="Покинуть">📕</button>
      </div>
    );
  }

  return (
    <div className="conf-screen">
      {/* Header */}
      <div className="conf-header">
        <span className="conf-title">
          📞 Конференция
          <span className="conf-participant-count">{participants.length} чел.</span>
        </span>
        <span className="conf-timer">{statusLabel}</span>
      </div>

      {/* Participant grid */}
      <div className={`conf-grid ${getGridClass()}`}>
        {/* Self tile */}
        <div className="conf-tile conf-tile-self">
          {isVideo ? (
            <video
              ref={localVidEl}
              className="conf-tile-video"
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div className="conf-tile-avatar">
              <AvatarDisplay name={username} avatarUrl={avatarMap?.[username]} />
            </div>
          )}
          <div className="conf-tile-label">
            <span className="conf-tile-name">Вы</span>
            {isMuted && <span className="conf-tile-muted">🔇</span>}
            {isVideo && isVideoOff && <span className="conf-tile-muted">📷</span>}
          </div>
          {isVideo && isVideoOff && (
            <div className="conf-tile-avatar conf-tile-avatar-overlay">
              <AvatarDisplay name={username} avatarUrl={avatarMap?.[username]} />
            </div>
          )}
        </div>

        {/* Remote peer tiles */}
        {remotePeers.map(peerId => (
          <PeerTile
            key={peerId}
            peerId={peerId}
            isVideo={isVideo}
            avatarUrl={avatarMap?.[peerId]}
            setRemoteVideoRef={setRemoteVideoRef}
            getRemoteStream={getRemoteStream}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="conf-controls">
        {onMinimize && (
          <button
            className="conf-control-btn"
            onClick={onMinimize}
            title="Свернуть конференцию"
          >
            🗕
          </button>
        )}

        <button
          className={`conf-control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          className={`conf-control-btn ${isVideoOff ? 'active' : ''}`}
          onClick={onToggleVideo}
          title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
        >
          {isVideoOff ? '📷' : '📹'}
        </button>

        <button
          className="conf-control-btn conf-share-btn"
          onClick={handleCopyLink}
          title="Скопировать ссылку на конференцию"
        >
          {linkCopied ? '✅' : '🔗'}
        </button>

        <button
          className="conf-control-btn conf-hangup-btn"
          onClick={onLeave}
          title="Покинуть конференцию"
        >
          📕
        </button>
      </div>
    </div>
  );
}

/** Individual peer video/avatar tile */
function PeerTile({ peerId, isVideo, avatarUrl, setRemoteVideoRef, getRemoteStream }) {
  const videoRef = useRef(null);
  const [hasStream, setHasStream] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      setRemoteVideoRef(peerId, videoRef.current);
      // Check if stream is already available
      const stream = getRemoteStream(peerId);
      if (stream) {
        videoRef.current.srcObject = stream;
        setHasStream(true);
      }
    }
    return () => setRemoteVideoRef(peerId, null);
  }, [peerId, setRemoteVideoRef, getRemoteStream]);

  // Poll for stream availability
  useEffect(() => {
    if (hasStream) return;
    const interval = setInterval(() => {
      const stream = getRemoteStream(peerId);
      if (stream) {
        if (videoRef.current) videoRef.current.srcObject = stream;
        setHasStream(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [peerId, getRemoteStream, hasStream]);

  return (
    <div className="conf-tile">
      {isVideo ? (
        <>
          <video
            ref={videoRef}
            className="conf-tile-video"
            autoPlay
            playsInline
          />
          {!hasStream && (
            <div className="conf-tile-avatar conf-tile-avatar-overlay">
              <AvatarDisplay name={peerId} avatarUrl={avatarUrl} />
            </div>
          )}
        </>
      ) : (
        <>
          <audio ref={videoRef} autoPlay playsInline />
          <div className="conf-tile-avatar">
            <AvatarDisplay name={peerId} avatarUrl={avatarUrl} />
          </div>
        </>
      )}
      <div className="conf-tile-label">
        <span className="conf-tile-name">{peerId}</span>
      </div>
    </div>
  );
}

/** Avatar display component */
function AvatarDisplay({ name, avatarUrl }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="conf-avatar-img" />;
  }
  return (
    <div
      className="conf-avatar-placeholder"
      style={{ background: getAvatarColor(name || 'U') }}
    >
      {(name || 'U').charAt(0).toUpperCase()}
    </div>
  );
}
