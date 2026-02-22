import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * VideoCircleMessage — Telegram-style circular video message player.
 *
 * Circular <video> with progress ring, play/pause on tap,
 * mute/unmute, duration overlay, thumbnail poster.
 */
export default function VideoCircleMessage({ fileUrl, duration, thumbnailUrl, isOwn }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0); // 0..1
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const videoRef = useRef(null);
  const animRef = useRef(null);

  const SIZE = 160; // px
  const RING_R = 76; // radius for progress ring
  const circumference = 2 * Math.PI * RING_R;

  const formatTime = (sec) => {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.paused) {
      const p = video.duration ? video.currentTime / video.duration : 0;
      setProgress(p);
      setCurrentTime(video.currentTime);
      animRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // Pause all other media
      document.querySelectorAll('video, audio').forEach((el) => {
        if (el !== video && !el.paused) el.pause();
      });
      video.play().then(() => {
        setPlaying(true);
        animRef.current = requestAnimationFrame(tick);
      }).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
  }, [tick]);

  const toggleMute = useCallback((e) => {
    e.stopPropagation(); // Don't trigger play/pause
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };

    const handleLoaded = () => setLoaded(true);

    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadedmetadata', handleLoaded);

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadedmetadata', handleLoaded);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const dashOffset = circumference * (1 - progress);
  const remaining = duration ? duration - currentTime : 0;

  return (
    <div className={`vc-msg ${isOwn ? 'vc-msg-own' : ''}`} onClick={togglePlay} role="button" tabIndex={0}>
      <div className="vc-circle-wrap" style={{ width: SIZE, height: SIZE, position: 'relative' }}>
        <div className="vc-circle" style={{ width: SIZE, height: SIZE }}>
          {/* Progress ring */}
          <svg className="vc-ring" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RING_R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
            {playing && (
              <circle cx={SIZE / 2} cy={SIZE / 2} r={RING_R} fill="none" stroke="#4ecca3" strokeWidth="3.5"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
            )}
          </svg>

          <video
            ref={videoRef}
            className="vc-video"
            src={fileUrl}
            poster={thumbnailUrl || undefined}
            preload="metadata"
            muted={muted}
            playsInline
            loop={false}
          />

          {/* Play overlay — show when not playing */}
          {!playing && (
            <div className="vc-play-overlay">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Mute toggle — positioned OUTSIDE vc-circle to avoid overflow:hidden clipping */}
        {playing && (
          <button className="vc-mute-btn" onClick={toggleMute} type="button" title={muted ? 'Включить звук' : 'Выключить звук'}>
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Duration label */}
      <span className="vc-duration">
        {playing ? formatTime(currentTime) : formatTime(duration || 0)}
      </span>
    </div>
  );
}
