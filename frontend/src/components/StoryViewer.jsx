import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Trash2, Eye, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { getAvatarColor, getInitials } from '../utils/avatar';

/**
 * Fullscreen story viewer — Telegram/Instagram style.
 * Tap left side = prev, tap right side = next, long-press = pause.
 * Progress bar segments at top.
 */
export default function StoryViewer({
  groupedStories = [],
  initialAuthor,
  username,
  avatarMap = {},
  onClose,
  onView,
  onDelete,
  onGetViewers,
}) {
  // Find initial author index
  const authorIndex = groupedStories.findIndex(g => g.author === initialAuthor);
  const [currentGroupIdx, setCurrentGroupIdx] = useState(Math.max(0, authorIndex));
  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const touchStartRef = useRef(null);

  const currentGroup = groupedStories[currentGroupIdx];
  const currentStory = currentGroup?.stories?.[currentStoryIdx];
  const isMyStory = currentGroup?.author === username;
  const storyDuration = (currentStory?.duration || 15) * 1000; // ms

  /* ── Mark story as viewed ── */
  useEffect(() => {
    if (currentStory && !currentStory.viewedByMe && currentStory.author !== username) {
      onView?.(currentStory.id);
    }
  }, [currentStory?.id]);

  /* ── Auto-advance timer ── */
  useEffect(() => {
    if (!currentStory || paused) return;

    startTimeRef.current = Date.now();
    setProgress(0);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / storyDuration, 1);
      setProgress(pct);
      if (pct >= 1) {
        clearInterval(interval);
        goNext();
      }
    }, 50);

    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [currentGroupIdx, currentStoryIdx, paused, currentStory?.id]);

  /* ── Play/pause video ── */
  useEffect(() => {
    if (videoRef.current) {
      if (paused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [paused, currentStory?.id]);

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    if (currentStoryIdx < currentGroup.stories.length - 1) {
      setCurrentStoryIdx(prev => prev + 1);
      setShowViewers(false);
    } else if (currentGroupIdx < groupedStories.length - 1) {
      setCurrentGroupIdx(prev => prev + 1);
      setCurrentStoryIdx(0);
      setShowViewers(false);
    } else {
      onClose();
    }
  }, [currentGroup, currentStoryIdx, currentGroupIdx, groupedStories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentStoryIdx > 0) {
      setCurrentStoryIdx(prev => prev - 1);
      setShowViewers(false);
    } else if (currentGroupIdx > 0) {
      setCurrentGroupIdx(prev => prev - 1);
      const prevGroup = groupedStories[currentGroupIdx - 1];
      setCurrentStoryIdx(prevGroup ? prevGroup.stories.length - 1 : 0);
      setShowViewers(false);
    }
  }, [currentStoryIdx, currentGroupIdx, groupedStories]);

  /* ── Touch / click handlers ── */
  const handleTouchStart = () => {
    touchStartRef.current = Date.now();
    setPaused(true);
  };

  const handleTouchEnd = (e) => {
    const holdDuration = Date.now() - (touchStartRef.current || 0);
    setPaused(false);

    // If it was a long press (>300ms), just resume — don't navigate
    if (holdDuration > 300) return;

    // Short tap: navigate based on position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.changedTouches?.[0]?.clientX ?? e.clientX) - rect.left;
    if (x < rect.width * 0.35) {
      goPrev();
    } else {
      goNext();
    }
  };

  /* ── Load viewers for own stories ── */
  const handleShowViewers = async () => {
    if (!isMyStory || !currentStory) return;
    setShowViewers(!showViewers);
    if (!showViewers) {
      setPaused(true);
      const v = await onGetViewers?.(currentStory.id);
      setViewers(v || []);
    } else {
      setPaused(false);
    }
  };

  const handleDelete = async () => {
    if (!isMyStory || !currentStory) return;
    await onDelete?.(currentStory.id);
    // After delete, advance or close
    if (currentGroup.stories.length <= 1) {
      if (groupedStories.length <= 1) {
        onClose();
      } else {
        goNext();
      }
    }
  };

  if (!currentStory) return null;

  const av = avatarMap[currentGroup.author] || '';
  const timeAgo = getTimeAgo(currentStory.createdAt);

  return (
    <div className="story-viewer-overlay">
      <div
        className="story-viewer"
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Progress bars */}
        <div className="story-viewer-progress">
          {currentGroup.stories.map((s, i) => (
            <div key={s.id} className="story-viewer-progress-segment">
              <div
                className="story-viewer-progress-fill"
                style={{
                  width: i < currentStoryIdx ? '100%'
                    : i === currentStoryIdx ? `${progress * 100}%`
                    : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="story-viewer-header" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
          <div className="story-viewer-author">
            <div className="story-viewer-author-avatar" style={{ background: av ? 'transparent' : getAvatarColor(currentGroup.author) }}>
              {av
                ? <img src={av} alt="" className="story-viewer-avatar-img" />
                : getInitials(currentGroup.author)}
            </div>
            <div className="story-viewer-author-info">
              <span className="story-viewer-author-name">{currentGroup.author}</span>
              <span className="story-viewer-time">{timeAgo}</span>
            </div>
          </div>
          <div className="story-viewer-actions">
            {paused
              ? <button className="story-viewer-btn" onClick={() => setPaused(false)}><Play size={20} /></button>
              : <button className="story-viewer-btn" onClick={() => setPaused(true)}><Pause size={20} /></button>}
            <button className="story-viewer-btn" onClick={onClose}><X size={22} /></button>
          </div>
        </div>

        {/* Video content */}
        <video
          ref={videoRef}
          src={currentStory.videoUrl}
          className="story-viewer-video"
          playsInline
          muted={false}
          autoPlay
          loop={false}
          onEnded={goNext}
        />

        {/* Navigation arrows (desktop) */}
        {(currentGroupIdx > 0 || currentStoryIdx > 0) && (
          <button
            className="story-viewer-nav story-viewer-nav-left"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            onMouseDown={e => e.stopPropagation()}
          >
            <ChevronLeft size={28} />
          </button>
        )}
        {(currentGroupIdx < groupedStories.length - 1 || currentStoryIdx < (currentGroup?.stories?.length || 1) - 1) && (
          <button
            className="story-viewer-nav story-viewer-nav-right"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            onMouseDown={e => e.stopPropagation()}
          >
            <ChevronRight size={28} />
          </button>
        )}

        {/* Bottom bar for own stories */}
        {isMyStory && (
          <div className="story-viewer-bottom" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <button className="story-viewer-bottom-btn" onClick={handleShowViewers}>
              <Eye size={18} />
              <span>{currentStory.viewCount || 0}</span>
            </button>
            <button className="story-viewer-bottom-btn danger" onClick={handleDelete}>
              <Trash2 size={18} />
              <span>Удалить</span>
            </button>
          </div>
        )}

        {/* Viewers panel */}
        {showViewers && (
          <div className="story-viewer-viewers-panel" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <div className="story-viewers-title">Просмотры ({viewers.length})</div>
            {viewers.length === 0 && <div className="story-viewers-empty">Пока никто не смотрел</div>}
            {viewers.map((v, i) => (
              <div key={i} className="story-viewers-item">
                <div className="story-viewers-avatar" style={{ background: (avatarMap[v.viewer]) ? 'transparent' : getAvatarColor(v.viewer) }}>
                  {avatarMap[v.viewer]
                    ? <img src={avatarMap[v.viewer]} alt="" className="story-viewers-avatar-img" />
                    : getInitials(v.viewer)}
                </div>
                <span className="story-viewers-name">{v.viewer}</span>
                <span className="story-viewers-time">{getTimeAgo(v.viewedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes?.('T') ? dateStr : dateStr.replace(' ', 'T'));
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} дн назад`;
}
