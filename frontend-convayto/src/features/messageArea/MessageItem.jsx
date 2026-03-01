import { useUser } from "../authentication/useUser";
import { formatTime } from "../../utils/common";
import useConvInfo from "./useConvInfo";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { RiPlayFill, RiPauseFill, RiDownloadLine, RiCheckboxCircleLine, RiCheckboxBlankCircleLine, RiPushpinFill, RiTimerLine, RiBarChartBoxLine, RiEyeLine } from "react-icons/ri";
import MessageContextMenu from "../../components/MessageContextMenu";
import { useUserProfileModal } from "../../contexts/UserProfileModalContext";
import toast from "react-hot-toast";

// ---------- Вспомогательные компоненты ----------

function VoicePlayer({ fileUrl, duration, waveform, isOwn }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const NUM_BARS = 48;
  const bars = useMemo(() => {
    let raw = null;
    if (waveform) {
      try {
        raw = typeof waveform === "string" ? JSON.parse(waveform) : waveform;
      } catch {}
    }
    if (Array.isArray(raw) && raw.length >= 2) {
      const result = [];
      for (let i = 0; i < NUM_BARS; i++) {
        const idx = Math.floor((i / NUM_BARS) * raw.length);
        result.push(Math.max(0.08, Math.min(1, Number(raw[idx]) || 0)));
      }
      return result;
    }
    // Generate pseudo-random waveform from fileUrl hash
    const result = [];
    let seed = 0;
    if (fileUrl) for (let i = 0; i < fileUrl.length; i++) seed += fileUrl.charCodeAt(i);
    for (let i = 0; i < NUM_BARS; i++) {
      seed = (seed * 16807 + 1) % 2147483647;
      result.push(0.1 + ((seed % 100) / 100) * 0.9);
    }
    return result;
  }, [waveform, fileUrl]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      const d = a.duration || duration || 1;
      setProgress(a.currentTime / d);
      setCurrentTime(a.currentTime);
    };
    const onEnd = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("ended", onEnd); };
  }, [duration]);

  function toggle() {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  }

  function handleSeek(e) {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const d = audioRef.current.duration || duration || 1;
    audioRef.current.currentTime = pct * d;
    setProgress(pct);
    setCurrentTime(pct * d);
  }

  const displaySec = isPlaying ? currentTime : (duration || 0);
  const m = Math.floor(displaySec / 60);
  const s = Math.floor(displaySec % 60);

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio ref={audioRef} src={fileUrl} preload="metadata" />
      <button
        onClick={toggle}
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
          isOwn ? "bg-white/20 hover:bg-white/30" : "bg-bgAccent/20 hover:bg-bgAccent/30 dark:bg-bgAccent-dark/20 dark:hover:bg-bgAccent-dark/30"
        }`}
      >
        {isPlaying ? <RiPauseFill className="text-lg" /> : <RiPlayFill className="text-lg ml-0.5" />}
      </button>
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div
          className="flex items-end gap-[2px] h-[24px] cursor-pointer"
          onClick={handleSeek}
        >
          {bars.map((h, i) => {
            const played = progress > 0 && i / bars.length <= progress;
            return (
              <div
                key={i}
                className={`w-[2px] rounded-full flex-shrink-0 transition-colors duration-150 ${
                  played
                    ? isOwn ? "bg-white" : "bg-bgAccent dark:bg-bgAccent-dark"
                    : isOwn ? "bg-white/30" : "bg-LightShade/30"
                }`}
                style={{ height: `${Math.max(h * 24, 2)}px` }}
              />
            );
          })}
        </div>
        <span className="text-[10px] opacity-60 tabular-nums">{m}:{s.toString().padStart(2, "0")}</span>
      </div>
    </div>
  );
}

function VideoCirclePlayer({ fileUrl, duration }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setProgress(v.currentTime / (v.duration || duration || 1));
    const onEnd = () => { setIsPlaying(false); setProgress(0); };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("ended", onEnd); };
  }, [duration]);

  const dur = duration || 0;
  const elapsed = isPlaying ? Math.floor(progress * dur) : 0;
  const displayTime = isPlaying ? elapsed : dur;
  const dm = Math.floor(displayTime / 60);
  const ds = Math.floor(displayTime % 60);

  const size = 240;
  const sw = 3;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  return (
    <div className="flex flex-col items-center">
      <div className="relative cursor-pointer" style={{ width: size, height: size }} onClick={toggle}>
        {/* Progress ring */}
        <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="opacity-10" />
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke="currentColor" strokeWidth={sw}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-bgAccent dark:text-bgAccent-dark transition-all duration-200"
          />
        </svg>
        {/* Video */}
        <div className="absolute overflow-hidden rounded-full" style={{ inset: `${sw}px` }}>
          <video
            ref={videoRef}
            src={fileUrl}
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        </div>
        {/* Play overlay */}
        {!isPlaying && (
          <div className="absolute flex items-center justify-center rounded-full bg-black/30" style={{ inset: `${sw}px` }}>
            <RiPlayFill className="text-4xl text-white drop-shadow" />
          </div>
        )}
        {/* Duration badge */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-mono text-white tabular-nums">
          {dm}:{ds.toString().padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " ГБ";
}

function FileAttachment({ fileUrl, fileName, fileType, fileSize }) {
  const isImage = fileType?.startsWith("image/");
  const isVideo = fileType?.startsWith("video/");
  const isAudio = fileType?.startsWith("audio/");

  if (isImage && fileUrl) {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img src={fileUrl} alt={fileName} className="max-w-[280px] max-h-[320px] rounded-lg object-cover" loading="lazy" />
      </a>
    );
  }

  if (isVideo && fileUrl) {
    return (
      <video src={fileUrl} controls playsInline preload="metadata" className="max-w-[300px] rounded-lg" />
    );
  }

  if (isAudio && fileUrl) {
    return <audio src={fileUrl} controls preload="metadata" className="max-w-[280px]" />;
  }

  // Document — Telegram-like colored extension icon
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  const extColors = {
    pdf: "bg-red-500/20 text-red-400",
    doc: "bg-blue-500/20 text-blue-400",
    docx: "bg-blue-500/20 text-blue-400",
    xls: "bg-green-500/20 text-green-400",
    xlsx: "bg-green-500/20 text-green-400",
    ppt: "bg-orange-500/20 text-orange-400",
    pptx: "bg-orange-500/20 text-orange-400",
    zip: "bg-yellow-500/20 text-yellow-400",
    rar: "bg-yellow-500/20 text-yellow-400",
    "7z": "bg-yellow-500/20 text-yellow-400",
    txt: "bg-gray-500/20 text-gray-400",
    csv: "bg-green-500/20 text-green-400",
  };
  const colorClass = extColors[ext] || "bg-bgAccent/15 text-bgAccent dark:bg-bgAccent-dark/15 dark:text-bgAccent-dark";

  return (
    <a
      href={`${fileUrl}?download=true`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl py-1 transition hover:bg-white/5"
    >
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase ${colorClass}`}>
        {ext ? ext.slice(0, 4) : <RiDownloadLine className="text-xl" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fileName || "Файл"}</p>
        {fileSize > 0 && <p className="text-[11px] opacity-50">{formatFileSize(fileSize)}</p>}
      </div>
    </a>
  );
}

// ---------- Reaction bar under message ----------

function ReactionBar({ reactions, onReaction, myUsername }) {
  if (!reactions || reactions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((r) => {
        const isMine = r.users?.includes(myUsername);
        return (
          <button
            key={r.emoji}
            onClick={() => onReaction?.(r.emoji)}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition active:scale-95 ${
              isMine
                ? "bg-bgAccent/30 ring-1 ring-bgAccent/50 dark:bg-bgAccent-dark/30 dark:ring-bgAccent-dark/50"
                : "bg-LightShade/15 hover:bg-LightShade/25"
            }`}
          >
            <span>{r.emoji}</span>
            <span className="font-medium">{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Link preview ----------

function LinkPreviewCard({ url, preview }) {
  if (!preview || (!preview.title && !preview.description)) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="mt-1 block rounded-lg border border-LightShade/20 bg-white/5 p-2 transition hover:bg-white/10"
    >
      {preview.image && (
        <img src={preview.image} alt="" className="mb-1 max-h-32 w-full rounded object-cover" />
      )}
      {preview.title && <p className="text-xs font-semibold line-clamp-2">{preview.title}</p>}
      {preview.description && <p className="text-[11px] opacity-60 line-clamp-2">{preview.description}</p>}
      <p className="text-[10px] opacity-40 truncate">{url}</p>
    </a>
  );
}

// ---------- Poll display ----------

function PollDisplay({ message, onVote }) {
  const pollData = message?.pollData;
  if (!pollData) return null;
  const myUsername = localStorage.getItem("username");
  const totalVotes = pollData.totalVotes || 0;

  return (
    <div className="min-w-[220px]">
      <p className="mb-2 font-semibold text-sm">{pollData.question}</p>
      <div className="flex flex-col gap-1.5">
        {pollData.options?.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const voted = opt.voters?.includes(myUsername);
          return (
            <button
              key={opt.id}
              onClick={() => !pollData.closed && onVote?.(pollData.pollId, opt.id)}
              disabled={pollData.closed}
              className={`relative overflow-hidden rounded-lg border px-3 py-2 text-left text-xs transition ${
                voted
                  ? "border-bgAccent/50 dark:border-bgAccent-dark/50"
                  : "border-LightShade/20 hover:border-LightShade/40"
              } ${pollData.closed ? "opacity-70 cursor-default" : "cursor-pointer active:scale-[0.98]"}`}
            >
              <div
                className="absolute inset-0 bg-bgAccent/15 dark:bg-bgAccent-dark/15 transition-all"
                style={{ width: `${pct}%` }}
              />
              <span className="relative z-10 flex items-center justify-between">
                <span>{opt.text}</span>
                <span className="font-mono font-bold">{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] opacity-50">
        {totalVotes} голос{totalVotes === 1 ? "" : totalVotes < 5 ? "а" : "ов"}
        {pollData.closed && " · Опрос закрыт"}
      </p>
    </div>
  );
}

// ---------- Bubble wrapper with context menu + selection ----------

function BubbleWrapper({
  children,
  message,
  isOwn,
  isGroup,
  selectionMode,
  isSelected,
  toggleSelectMessage,
  enterSelectionMode,
  onReply,
  onForward,
  onPin,
  onUnpin,
  onDeleteLocal,
  onDeleteForAll,
  onReaction,
  bubbleClass,
  noBubble = false,
}) {
  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      if (selectionMode) return;
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [selectionMode],
  );

  const handleClick = useCallback(() => {
    if (selectionMode) {
      toggleSelectMessage?.(message);
    }
  }, [selectionMode, toggleSelectMessage, message]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message?.content || "").then(() => {
      toast.success("Скопировано");
    });
  }, [message]);

  const handlePin = useCallback(() => {
    if (message?.pinned) {
      onUnpin?.(message);
    } else {
      onPin?.(message);
    }
  }, [message, onPin, onUnpin]);

  const handleSelect = useCallback(() => {
    enterSelectionMode?.(message);
  }, [enterSelectionMode, message]);

  return (
    <div
      id={`msg-${message?.id || ""}`}
      className={`flex items-end gap-1.5 ${isOwn ? "flex-row-reverse" : ""} ${
        selectionMode ? "cursor-pointer" : ""
      } ${isSelected ? "bg-bgAccent/10 dark:bg-bgAccent-dark/10 -mx-2 px-2 rounded-lg" : ""}`}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <span className="flex-shrink-0 py-2 text-xl">
          {isSelected ? (
            <RiCheckboxCircleLine className="text-bgAccent dark:text-bgAccent-dark" />
          ) : (
            <RiCheckboxBlankCircleLine className="opacity-40" />
          )}
        </span>
      )}

      {/* Message bubble */}
      {noBubble ? (
        <div className={`group relative ${isOwn ? "self-end" : ""} my-1 w-fit max-w-[80%]`}>
          {children}
        </div>
      ) : (
        <div
          className={`group relative ${
            isOwn
              ? "self-end rounded-br-none bg-gradient-to-br from-bgAccent to-bgAccentDim text-textPrimary-dark before:absolute before:bottom-0 before:right-0 before:h-0 before:w-0 before:translate-x-full before:border-l-8 before:border-t-8 before:border-l-bgAccentDim before:border-t-transparent before:content-[''] dark:from-bgAccent-dark dark:to-bgAccentDim-dark before:dark:border-l-bgAccentDim-dark"
              : "rounded-bl-none bg-bgPrimary before:absolute before:bottom-0 before:left-0 before:h-0 before:w-0 before:-translate-x-full before:border-r-8 before:border-t-8 before:border-r-bgPrimary before:border-t-transparent before:content-[''] dark:bg-LightShade/20 before:dark:border-r-LightShade/20"
          } my-1 w-fit max-w-[80%] rounded-2xl px-4 py-2 shadow-md before:shadow-md ${bubbleClass || ""}`}
        >
          {children}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOwn={isOwn}
          isPinned={!!message?.pinned}
          onReply={() => onReply?.(message)}
          onCopy={handleCopy}
          onForward={() => onForward?.(message)}
          onPin={handlePin}
          onSelect={handleSelect}
          onDelete={() => onDeleteLocal?.(message)}
          onDeleteForAll={() => onDeleteForAll?.(message)}
          onReaction={(emoji) => onReaction?.(message, emoji)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ---------- Основной компонент ----------

function MessageItem({
  message,
  selectionMode,
  isSelected,
  toggleSelectMessage,
  enterSelectionMode,
  onReply,
  onForward,
  onPin,
  onUnpin,
  onDeleteLocal,
  onDeleteForAll,
  onReaction,
  onVotePoll,
  onShowReaders,
}) {
  const { user } = useUser();
  const { convInfo } = useConvInfo();
  const { openUserProfile } = useUserProfileModal();
  const isGroup = convInfo?.isGroup;
  const isOwn = message?.sender_id === user.id;

  const commonProps = {
    message,
    isOwn,
    isGroup,
    selectionMode,
    isSelected,
    toggleSelectMessage,
    enterSelectionMode,
    onReply,
    onForward,
    onPin,
    onUnpin,
    onDeleteLocal,
    onDeleteForAll,
    onReaction,
  };

  // Disappearing message system notification
  if (message?.type === "DISAPPEARING_SET") {
    return (
      <div className="my-2 flex items-center justify-center gap-2 text-xs text-textPrimary/50 dark:text-textPrimary-dark/50">
        <RiTimerLine />
        <span>{message.content}</span>
      </div>
    );
  }

  // Call log messages
  if (message?.type === "CALL_LOG") {
    const isAudio = message.content?.includes("аудио") || message.content?.includes("audio");
    return (
      <div className="my-2 flex items-center justify-center gap-2 text-xs text-textPrimary/50 dark:text-textPrimary-dark/50">
        <span>{isAudio ? "📞" : "📹"}</span>
        <span>{message.content || "Звонок"}</span>
        <span className="text-[10px]">{formatTime(message?.created_at)}</span>
      </div>
    );
  }

  // Voice message
  if (message?.type === "VOICE" && message?.fileUrl) {
    return (
      <BubbleWrapper {...commonProps}>
        {isGroup && !isOwn && message?.sender_id && (
          <p className="mb-1 cursor-pointer text-xs font-bold text-bgAccent hover:underline dark:text-bgAccent-dark" onClick={() => openUserProfile(message.sender_id)}>{message.sender_id}</p>
        )}
        <VoicePlayer fileUrl={message.fileUrl} duration={message.duration} waveform={message.waveform} isOwn={isOwn} />
        <span className="float-right ml-2 mt-1 select-none text-xs opacity-70">
          {formatTime(message?.created_at)}
        </span>
      </BubbleWrapper>
    );
  }

  // Video circle
  if (message?.type === "VIDEO_CIRCLE" && message?.fileUrl) {
    return (
      <BubbleWrapper {...commonProps} noBubble>
        {isGroup && !isOwn && message?.sender_id && (
          <p className="mb-1 cursor-pointer text-xs font-bold text-bgAccent hover:underline dark:text-bgAccent-dark" onClick={() => openUserProfile(message.sender_id)}>{message.sender_id}</p>
        )}
        <VideoCirclePlayer fileUrl={message.fileUrl} duration={message.duration} />
        <p className="mt-1 text-center text-xs opacity-50">{formatTime(message?.created_at)}</p>
      </BubbleWrapper>
    );
  }

  // Determine if message has a file attachment
  const hasFile = message?.fileUrl && message?.type !== "VOICE" && message?.type !== "VIDEO_CIRCLE";

  // Poll message
  if (message?.type === "POLL" && message?.pollData) {
    return (
      <BubbleWrapper {...commonProps}>
        {isGroup && !isOwn && message?.sender_id && (
          <p className="mb-0.5 cursor-pointer text-xs font-bold text-bgAccent hover:underline dark:text-bgAccent-dark" onClick={() => openUserProfile(message.sender_id)}>{message.sender_id}</p>
        )}
        <PollDisplay message={message} onVote={onVotePoll} />
        <span className="block select-none text-right text-xs opacity-70 mt-1">{formatTime(message?.created_at)}</span>
        <ReactionBar reactions={message?.reactions} onReaction={(emoji) => onReaction?.(message, emoji)} myUsername={user.id} />
      </BubbleWrapper>
    );
  }

  // Image-only message (Telegram-like: no bubble, time overlaid on image)
  const isImageOnly = hasFile && message?.fileType?.startsWith("image/") &&
                       (!message?.content || message.content.startsWith("📎 "));

  if (isImageOnly) {
    return (
      <BubbleWrapper {...commonProps} noBubble>
        {isGroup && !isOwn && message?.sender_id && (
          <p className="mb-1 cursor-pointer text-xs font-bold text-bgAccent hover:underline dark:text-bgAccent-dark" onClick={() => openUserProfile(message.sender_id)}>{message.sender_id}</p>
        )}
        {message?.replyToContent && (
          <div className="mb-1 rounded-lg border-l-2 border-bgAccent bg-black/30 px-2 py-1 text-xs dark:border-bgAccent-dark">
            <p className="font-bold text-white/70">{message.replyToSender || ""}</p>
            <p className="truncate text-white/60">{message.replyToContent}</p>
          </div>
        )}
        <div className="relative overflow-hidden rounded-2xl shadow-md">
          <img
            src={message.fileUrl}
            alt={message.fileName}
            className="max-w-[280px] max-h-[320px] object-cover block"
            loading="lazy"
          />
          <div className="absolute bottom-0 right-0 flex items-center gap-1 rounded-tl-lg bg-black/50 px-2 py-0.5">
            {message?.pinned && <RiPushpinFill className="text-[10px] text-white/80" />}
            {message?.edited && <span className="text-[10px] italic text-white/70">ред.</span>}
            <span className="text-[11px] text-white tabular-nums">{formatTime(message?.created_at)}</span>
          </div>
        </div>
        <ReactionBar reactions={message?.reactions} onReaction={(emoji) => onReaction?.(message, emoji)} myUsername={user.id} />
      </BubbleWrapper>
    );
  }

  return (
    <BubbleWrapper {...commonProps}>
      {isGroup && !isOwn && message?.sender_id && (
        <p className="mb-0.5 cursor-pointer text-xs font-bold text-bgAccent hover:underline dark:text-bgAccent-dark" onClick={() => openUserProfile(message.sender_id)}>
          {message.sender_id}
        </p>
      )}

      {/* Reply reference */}
      {message?.replyToContent && (
        <div className="mb-1 rounded-lg border-l-2 border-bgAccent bg-white/10 px-2 py-1 text-xs dark:border-bgAccent-dark">
          <p className="font-bold opacity-70">{message.replyToSender || ""}</p>
          <p className="truncate opacity-60">{message.replyToContent}</p>
        </div>
      )}

      {/* File attachment */}
      {hasFile && (
        <div className="mb-1">
          <FileAttachment
            fileUrl={message.fileUrl}
            fileName={message.fileName}
            fileType={message.fileType}
            fileSize={message.fileSize}
          />
        </div>
      )}

      {/* Link preview */}
      {message?.linkPreview && (
        <LinkPreviewCard url={message.linkPreview.url} preview={message.linkPreview} />
      )}

      {/* Text content */}
      {message?.content && !message.content.startsWith("📎 ") && (
        <p>
          {message.content}
          <span className="float-right ml-2 mt-2 select-none text-xs opacity-70">
            {message?.pinned && <RiPushpinFill className="mr-1 inline-block text-[11px]" title="Закреплено" />}
            {message?.edited && <span className="mr-1 italic">ред.</span>}
            {isGroup && isOwn && onShowReaders && (
              <button onClick={(e) => { e.stopPropagation(); onShowReaders(message); }} className="mr-1 inline-block hover:opacity-100 opacity-50" title="Кто прочитал">
                <RiEyeLine className="inline-block text-[11px]" />
              </button>
            )}
            {formatTime(message?.created_at)}
          </span>
        </p>
      )}

      {/* If content is only file marker, show time */}
      {(!message?.content || message.content.startsWith("📎 ")) && (
        <span className="block select-none text-right text-xs opacity-70">
          {formatTime(message?.created_at)}
        </span>
      )}

      {/* Reactions */}
      <ReactionBar reactions={message?.reactions} onReaction={(emoji) => onReaction?.(message, emoji)} myUsername={user.id} />
    </BubbleWrapper>
  );
}

export default MessageItem;
