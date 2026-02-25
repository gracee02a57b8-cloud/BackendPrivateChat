import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * VoiceMessage — Telegram-style voice message player.
 *
 * Features: play/pause, waveform visualization with progress,
 * speed toggle (1×, 1.5×, 2×), duration display.
 */
export default function VoiceMessage({ fileUrl, duration, waveformData, isOwn }) {
  const audioUrl = fileUrl;
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loaded, setLoaded] = useState(false);
  
  const audioRef = useRef(null);
  const animRef = useRef(null);
  const waveformRef = useRef(null);

  // Parse waveform
  const bars = (() => {
    try {
      if (typeof waveformData === 'string') return JSON.parse(waveformData);
      if (Array.isArray(waveformData)) return waveformData;
    } catch {}
    return Array(48).fill(0.1);
  })();

  const TOTAL_BARS = bars.length || 48;

  const formatTime = (sec) => {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const remaining = duration ? duration - currentTime : 0;

  // Animation loop for progress
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      const p = audio.duration ? audio.currentTime / audio.duration : 0;
      setProgress(p);
      setCurrentTime(audio.currentTime);
      animRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (audio.paused) {
      // Stop all other playing audio on page
      document.querySelectorAll('audio').forEach(a => {
        if (a !== audio && !a.paused) a.pause();
      });
      audio.play().then(() => {
        setPlaying(true);
        animRef.current = requestAnimationFrame(tick);
      }).catch(() => {});
    } else {
      audio.pause();
      setPlaying(false);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
  }, [tick]);

  const cycleSpeed = useCallback(() => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

  // Seek on waveform click
  const handleWaveformClick = useCallback((e) => {
    const audio = audioRef.current;
    const container = waveformRef.current;
    if (!audio || !container || !audio.duration) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
    setCurrentTime(audio.currentTime);
    
    if (audio.paused) {
      audio.play().then(() => {
        setPlaying(true);
        animRef.current = requestAnimationFrame(tick);
      }).catch(() => {});
    }
  }, [tick]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };

    const handleLoaded = () => setLoaded(true);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoaded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoaded);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const filledBars = Math.floor(progress * TOTAL_BARS);

  return (
    <div className={`voice-msg ${isOwn ? 'voice-msg-own' : ''}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <button
        className={`voice-play-btn ${playing ? 'playing' : ''}`}
        onClick={togglePlay}
        type="button"
        title={playing ? 'Пауза' : 'Воспроизвести'}
      >
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      <div className="voice-msg-body">
        <div
          className="voice-waveform"
          ref={waveformRef}
          onClick={handleWaveformClick}
          role="slider"
          aria-label="Прогресс воспроизведения"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
        >
          {bars.map((v, i) => (
            <div
              key={i}
              className={`voice-bar ${i < filledBars ? 'voice-bar-filled' : ''}${i === filledBars - 1 && playing ? ' voice-bar-active' : ''}`}
              style={{ height: `${Math.max(3, (v || 0.1) * 28)}px` }}
            />
          ))}
        </div>

        <div className="voice-msg-meta">
          <span className="voice-msg-time">
            {playing || progress > 0
              ? formatTime(currentTime)
              : formatTime(duration || 0)
            }
          </span>
          {(playing || progress > 0) && (
            <button
              className="voice-speed-btn"
              onClick={cycleSpeed}
              type="button"
              title="Скорость"
            >
              {speed}×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
