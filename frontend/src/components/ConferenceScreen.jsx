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
  localStream,
}) {
  const isVideo = confType === 'video';
  const localVidEl = useRef(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Attach local video ref — re-attach when switching between minimized and full views
  useEffect(() => {
    if (localVideoRef) {
      localVideoRef.current = localVidEl.current;
    }
    // Re-attach the local stream to the new video element
    if (localVidEl.current && localStream?.current) {
      localVidEl.current.srcObject = localStream.current;
    }
  }, [localVideoRef, localStream, isMinimized]);

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
        <span className="conf-mini-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="#4ecca3"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 4 3 4.24 3 5c0 9.39 7.61 17 17 17 .71 0 1-.6 1-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg></span>
        <div className="conf-mini-info">
          <span className="conf-mini-name">Конференция</span>
          <span className="conf-mini-dur">{participants.length} чел. · {statusLabel}</span>
        </div>
        <button className={`call-mini-btn conf-mini-mute${isMuted ? ' active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleMute(); }} title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}>{isMuted ? <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.18 4.18L21 19.73 4.27 3z"/></svg> : <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>}</button>
        <button className="call-mini-btn call-mini-expand" onClick={(e) => { e.stopPropagation(); onRestore(); }} title="Развернуть"><svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M3 3h7v2H5v5H3V3zm11 0h7v7h-2V5h-5V3zM3 14h2v5h5v2H3v-7zm14 5h-5v2h7v-7h-2v5z"/></svg></button>
        <button className="call-mini-btn call-mini-hangup" onClick={(e) => { e.stopPropagation(); onLeave(); }} title="Покинуть"><svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg></button>
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
        {/* Self tile — video always rendered so ref stays valid when toggling */}
        <div className="conf-tile conf-tile-self">
          <video
            ref={localVidEl}
            className="conf-tile-video"
            autoPlay
            playsInline
            muted
            style={{ display: (isVideo && !isVideoOff) ? undefined : 'none' }}
          />
          {(!isVideo || isVideoOff) && (
            <div className="conf-tile-avatar">
              <AvatarDisplay name={username} avatarUrl={avatarMap?.[username]} />
            </div>
          )}
          <div className="conf-tile-label">
            <span className="conf-tile-name">Вы</span>
            {isMuted && <span className="conf-tile-muted">🔇</span>}
            {isVideoOff && <span className="conf-tile-muted">📷</span>}
          </div>
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
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M19 13H5v-2h14v2z"/></svg>
          </button>
        )}

        <button
          className={`conf-control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted
            ? <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.18 4.18L21 19.73 4.27 3z"/></svg>
            : <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
          }
        </button>

        <button
          className={`conf-control-btn ${isVideoOff ? 'active' : ''}`}
          onClick={onToggleVideo}
          title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
        >
          {isVideoOff
            ? <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>
            : <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          }
        </button>

        <button
          className="conf-control-btn conf-share-btn"
          onClick={handleCopyLink}
          title="Скопировать ссылку на конференцию"
        >
          {linkCopied
            ? <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            : <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
          }
        </button>

        <button
          className="conf-control-btn conf-hangup-btn"
          onClick={onLeave}
          title="Покинуть конференцию"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
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
      const stream = getRemoteStream(peerId);
      if (stream) {
        videoRef.current.srcObject = stream;
        setHasStream(true);
      }
    }
    return () => setRemoteVideoRef(peerId, null);
  }, [peerId, setRemoteVideoRef, getRemoteStream]);

  // Poll for stream availability (handles late-arriving streams & renegotiation)
  useEffect(() => {
    const interval = setInterval(() => {
      const stream = getRemoteStream(peerId);
      if (stream && videoRef.current) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        if (!hasStream) setHasStream(true);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [peerId, getRemoteStream, hasStream]);

  const showVideo = isVideo && hasStream;

  return (
    <div className="conf-tile">
      <video
        ref={videoRef}
        className="conf-tile-video"
        autoPlay
        playsInline
        style={{ display: showVideo ? undefined : 'none' }}
      />
      {!showVideo && (
        <div className="conf-tile-avatar">
          <AvatarDisplay name={peerId} avatarUrl={avatarUrl} />
        </div>
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
