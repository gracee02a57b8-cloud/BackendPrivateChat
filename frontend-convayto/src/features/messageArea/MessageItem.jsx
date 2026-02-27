import { useUser } from "../authentication/useUser";
import { formatTime } from "../../utils/common";
import useConvInfo from "./useConvInfo";
import { useState, useRef, useEffect, useCallback } from "react";
import { RiPlayFill, RiPauseFill, RiDownloadLine, RiCheckboxCircleLine, RiCheckboxBlankCircleLine } from "react-icons/ri";
import MessageContextMenu from "../../components/MessageContextMenu";
import toast from "react-hot-toast";

// ---------- Вспомогательные компоненты ----------

function VoicePlayer({ fileUrl, duration }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime / (a.duration || duration || 1));
    const onEnd = () => { setIsPlaying(false); setProgress(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("ended", onEnd); };
  }, [duration]);

  function toggle() {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  }

  const dur = duration || 0;
  const m = Math.floor(dur / 60);
  const s = dur % 60;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={fileUrl} preload="metadata" />
      <button
        onClick={toggle}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30 active:scale-95"
      >
        {isPlaying ? <RiPauseFill className="text-lg" /> : <RiPlayFill className="text-lg ml-0.5" />}
      </button>
      <div className="flex flex-1 flex-col gap-1">
        <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
          <div className="h-full rounded-full bg-current transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-[10px] opacity-70">{m}:{s.toString().padStart(2, "0")}</span>
      </div>
    </div>
  );
}

function VideoCirclePlayer({ fileUrl, duration }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function toggle() {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); } else { videoRef.current.play(); }
    setIsPlaying(!isPlaying);
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnd = () => setIsPlaying(false);
    v.addEventListener("ended", onEnd);
    return () => v.removeEventListener("ended", onEnd);
  }, []);

  const dur = duration || 0;
  const m = Math.floor(dur / 60);
  const s = dur % 60;

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative h-52 w-52 cursor-pointer overflow-hidden rounded-full border-2 border-current/20 shadow-lg"
        onClick={toggle}
      >
        <video
          ref={videoRef}
          src={fileUrl}
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <RiPlayFill className="text-4xl text-white drop-shadow" />
          </div>
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-mono text-white">
          {m}:{s.toString().padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}

function FileAttachment({ fileUrl, fileName, fileType }) {
  const isImage = fileType?.startsWith("image/");
  const isVideo = fileType?.startsWith("video/");
  const isAudio = fileType?.startsWith("audio/");

  if (isImage && fileUrl) {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img src={fileUrl} alt={fileName} className="max-w-[260px] max-h-[260px] rounded-lg object-cover" />
      </a>
    );
  }

  if (isVideo && fileUrl) {
    return (
      <video src={fileUrl} controls playsInline preload="metadata" className="max-w-[280px] rounded-lg" />
    );
  }

  if (isAudio && fileUrl) {
    return <audio src={fileUrl} controls preload="metadata" className="max-w-[260px]" />;
  }

  return (
    <a
      href={`${fileUrl}?download=true`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 transition hover:bg-white/20"
    >
      <RiDownloadLine className="text-lg flex-shrink-0" />
      <span className="truncate text-sm">{fileName || "Файл"}</span>
    </a>
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
  onDeleteLocal,
  onDeleteForAll,
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
    toast("Закрепление — в разработке", { icon: "📌" });
  }, []);

  const handleSelect = useCallback(() => {
    enterSelectionMode?.(message);
  }, [enterSelectionMode, message]);

  return (
    <div
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
          onReply={() => onReply?.(message)}
          onCopy={handleCopy}
          onForward={() => onForward?.(message)}
          onPin={handlePin}
          onSelect={handleSelect}
          onDelete={() => onDeleteLocal?.(message)}
          onDeleteForAll={() => onDeleteForAll?.(message)}
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
  onDeleteLocal,
  onDeleteForAll,
}) {
  const { user } = useUser();
  const { convInfo } = useConvInfo();
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
    onDeleteLocal,
    onDeleteForAll,
  };

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
          <p className="mb-1 text-xs font-bold text-bgAccent dark:text-bgAccent-dark">{message.sender_id}</p>
        )}
        <VoicePlayer fileUrl={message.fileUrl} duration={message.duration} />
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
          <p className="mb-1 text-xs font-bold text-bgAccent dark:text-bgAccent-dark">{message.sender_id}</p>
        )}
        <VideoCirclePlayer fileUrl={message.fileUrl} duration={message.duration} />
        <p className="mt-1 text-center text-xs opacity-50">{formatTime(message?.created_at)}</p>
      </BubbleWrapper>
    );
  }

  // Determine if message has a file attachment
  const hasFile = message?.fileUrl && message?.type !== "VOICE" && message?.type !== "VIDEO_CIRCLE";

  return (
    <BubbleWrapper {...commonProps}>
      {isGroup && !isOwn && message?.sender_id && (
        <p className="mb-0.5 text-xs font-bold text-bgAccent dark:text-bgAccent-dark">
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
          />
        </div>
      )}

      {/* Text content */}
      {message?.content && !message.content.startsWith("📎 ") && (
        <p>
          {message.content}
          <span className="float-right ml-2 mt-2 select-none text-xs opacity-70">
            {message?.edited && <span className="mr-1 italic">ред.</span>}
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
    </BubbleWrapper>
  );
}

export default MessageItem;
