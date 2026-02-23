import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { getAvatarColor } from '../utils/avatar';
import { Lock, ChevronDown, ChevronUp, SwitchCamera, Maximize2 } from 'lucide-react';

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
  onSwitchCamera,
}) {
  const isVideo = callType === 'video' && !isVideoOff;

  // Always render video elements; refs are always available
  const localVidEl = useRef(null);
  const remoteVidEl = useRef(null);
  const remoteAudioEl = useRef(null);

  // Expandable security code
  const [securityExpanded, setSecurityExpanded] = useState(false);

  // Swap local/remote video — CSS-only swap, refs stay stable
  const [videoSwapped, setVideoSwapped] = useState(false);

  // Stream caches (always canonical: local = actual local, remote = actual remote)
  const localStreamCache = useRef(null);
  const remoteStreamCache = useRef(null);

  // Reset swap when call type changes (renegotiation)
  useEffect(() => { setVideoSwapped(false); }, [callType]);

  // Sync hook refs to DOM elements immediately after DOM commit (before paint)
  useLayoutEffect(() => {
    if (localVideoRef) localVideoRef.current = localVidEl.current;
    if (remoteVideoRef) remoteVideoRef.current = remoteVidEl.current;
  });

  // Keep stream caches up-to-date + sync audio element
  useEffect(() => {
    const interval = setInterval(() => {
      if (localVidEl.current?.srcObject) localStreamCache.current = localVidEl.current.srcObject;
      if (remoteVidEl.current?.srcObject) remoteStreamCache.current = remoteVidEl.current.srcObject;
      if (remoteAudioEl.current && remoteStreamCache.current) {
        if (remoteAudioEl.current.srcObject !== remoteStreamCache.current) {
          remoteAudioEl.current.srcObject = remoteStreamCache.current;
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Re-attach streams when view or call state changes
  useEffect(() => {
    const reattach = () => {
      if (localVidEl.current && localStreamCache.current) {
        if (localVidEl.current.srcObject !== localStreamCache.current) {
          localVidEl.current.srcObject = localStreamCache.current;
        }
      }
      if (remoteVidEl.current && remoteStreamCache.current) {
        if (remoteVidEl.current.srcObject !== remoteStreamCache.current) {
          remoteVidEl.current.srcObject = remoteStreamCache.current;
        }
      }
      if (remoteAudioEl.current && remoteStreamCache.current) {
        remoteAudioEl.current.srcObject = remoteStreamCache.current;
      }
      if (localVideoRef) localVideoRef.current = localVidEl.current;
      if (remoteVideoRef) remoteVideoRef.current = remoteVidEl.current;
    };
    reattach();
    const t1 = setTimeout(reattach, 150);
    const t2 = setTimeout(reattach, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isMinimized, callState, callType, isVideoOff, localVideoRef, remoteVideoRef]);

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
        <button className={`call-mini-btn call-mini-mute${isMuted ? ' active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleMute(); }} title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}>{isMuted ? <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.18 4.18L21 19.73 4.27 3z"/></svg> : <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>}</button>
        <button className="call-mini-btn call-mini-expand" onClick={(e) => { e.stopPropagation(); onRestore(); }} title="Развернуть"><svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M3 3h7v2H5v5H3V3zm11 0h7v7h-2V5h-5V3zM3 14h2v5h5v2H3v-7zm14 5h-5v2h7v-7h-2v5z"/></svg></button>
        <button className="call-mini-btn call-mini-hangup" onClick={(e) => { e.stopPropagation(); onEndCall(); }} title="Завершить"><svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg></button>
      </div>
    );
  }

  // ── Full-screen call view ──
  return (
    <div className={`call-screen ${isVideo ? 'call-screen-video' : 'call-screen-audio'}`}>
      {/* Remote video: full-screen normally, PiP-sized when swapped */}
      <video
        ref={remoteVidEl}
        className={isVideo ? (videoSwapped ? 'call-video-pip' : 'call-video-main') : ''}
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

      {/* Local video: PiP-sized normally, full-screen when swapped */}
      {isVideo && (
        <video
          ref={localVidEl}
          className={videoSwapped ? 'call-video-main' : 'call-video-pip'}
          autoPlay
          playsInline
          muted
        />
      )}

      {/* Overlay on PiP position: tap to swap + camera switch */}
      {isVideo && (
        <div className="call-pip-overlay" onClick={() => setVideoSwapped(v => !v)}>
          <span className="call-pip-swap-hint" title="Нажмите, чтобы поменять">
            <Maximize2 size={14} />
          </span>
          {onSwitchCamera && (
            <button
              className="call-pip-switch-cam"
              onClick={(e) => { e.stopPropagation(); onSwitchCamera(); }}
              title="Сменить камеру"
            >
              <SwitchCamera size={16} />
            </button>
          )}
        </div>
      )}

      {/* Hidden audio element – plays remote audio always */}
      <audio ref={remoteAudioEl} autoPlay playsInline />

      {/* Hidden video refs for audio-only mode */}
      {!isVideo && (
        <>
          <video ref={remoteVidEl} style={{ display: 'none' }} autoPlay playsInline />
          <video ref={localVidEl} style={{ display: 'none' }} autoPlay playsInline muted />
        </>
      )}

      {/* Feature #3: Expandable security code */}
      {securityCode && callState === 'active' && (
        <div
          className={`call-security-code ${securityExpanded ? 'expanded' : ''}`}
          onClick={() => setSecurityExpanded(v => !v)}
        >
          <span className="call-security-icon"><Lock size={12} /></span>
          {securityExpanded ? (
            <>
              <span className="call-security-label">Код безопасности</span>
              <span className="call-security-digits">{securityCode}</span>
              <ChevronUp size={14} className="call-security-chevron" />
            </>
          ) : (
            <ChevronDown size={14} className="call-security-chevron" />
          )}
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
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M19 13H5v-2h14v2z"/></svg>
          </button>
        )}

        <button
          className={`call-control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted
            ? <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.18 4.18L21 19.73 4.27 3z"/></svg>
            : <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
          }
        </button>

        <button
          className={`call-control-btn ${isVideoOff ? 'active' : ''}`}
          onClick={onToggleVideo}
          title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
        >
          {isVideoOff
            ? <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>
            : <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          }
        </button>

        {callState === 'active' && onUpgradeToConference && (
          <button
            className="call-control-btn call-conf-btn"
            onClick={onUpgradeToConference}
            title="Создать конференцию (добавить участников)"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </button>
        )}

        <button
          className="call-control-btn call-hangup-btn"
          onClick={onEndCall}
          title="Завершить звонок"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
        </button>
      </div>
    </div>
  );
}
