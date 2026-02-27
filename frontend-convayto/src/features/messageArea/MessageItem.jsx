import { useUser } from "../authentication/useUser";
import { formatTime } from "../../utils/common";
import useConvInfo from "./useConvInfo";
import { useState, useRef, useEffect } from "react";
import { RiShareForwardLine, RiPlayFill, RiPauseFill, RiDownloadLine } from "react-icons/ri";
import ForwardMessageModal from "../../components/ForwardMessageModal";

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

function FileAttachment({ fileUrl, fileName, fileType, isOwn }) {
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

// ---------- Основной компонент ----------

function MessageItem({ message }) {
  const { user } = useUser();
  const { convInfo } = useConvInfo();
  const isGroup = convInfo?.isGroup;
  const isOwn = message?.sender_id === user.id;
  const [showForward, setShowForward] = useState(false);
  const [hovered, setHovered] = useState(false);

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
      <>
        <div
          className={`group relative ${
            isOwn
              ? "self-end rounded-br-none bg-gradient-to-br from-bgAccent to-bgAccentDim text-textPrimary-dark before:absolute before:bottom-0 before:right-0 before:h-0 before:w-0 before:translate-x-full before:border-l-8 before:border-t-8 before:border-l-bgAccentDim before:border-t-transparent before:content-[''] dark:from-bgAccent-dark dark:to-bgAccentDim-dark before:dark:border-l-bgAccentDim-dark"
              : "rounded-bl-none bg-bgPrimary before:absolute before:bottom-0 before:left-0 before:h-0 before:w-0 before:-translate-x-full before:border-r-8 before:border-t-8 before:border-r-bgPrimary before:border-t-transparent before:content-[''] dark:bg-LightShade/20 before:dark:border-r-LightShade/20"
          } my-1 w-fit max-w-[80%] rounded-2xl px-4 py-2 shadow-md before:shadow-md`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {isGroup && !isOwn && message?.sender_id && (
            <p className="mb-1 text-xs font-bold text-bgAccent dark:text-bgAccent-dark">{message.sender_id}</p>
          )}
          <VoicePlayer fileUrl={message.fileUrl} duration={message.duration} />
          <span className="float-right ml-2 mt-1 select-none text-xs opacity-70">
            {formatTime(message?.created_at)}
          </span>
          {hovered && (
            <button
              onClick={() => setShowForward(true)}
              className={`absolute top-1 ${isOwn ? "-left-8" : "-right-8"} flex h-6 w-6 items-center justify-center rounded-full bg-LightShade/30 text-xs text-textPrimary/60 transition hover:bg-LightShade/50 dark:text-textPrimary-dark/60`}
              title="Переслать"
            >
              <RiShareForwardLine />
            </button>
          )}
        </div>
        <ForwardMessageModal isOpen={showForward} onClose={() => setShowForward(false)} message={message} />
      </>
    );
  }

  // Video circle
  if (message?.type === "VIDEO_CIRCLE" && message?.fileUrl) {
    return (
      <>
        <div
          className={`group relative ${isOwn ? "self-end" : ""} my-1 w-fit max-w-[80%]`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {isGroup && !isOwn && message?.sender_id && (
            <p className="mb-1 text-xs font-bold text-bgAccent dark:text-bgAccent-dark">{message.sender_id}</p>
          )}
          <VideoCirclePlayer fileUrl={message.fileUrl} duration={message.duration} />
          <p className="mt-1 text-center text-xs opacity-50">{formatTime(message?.created_at)}</p>
          {hovered && (
            <button
              onClick={() => setShowForward(true)}
              className={`absolute top-1 ${isOwn ? "-left-8" : "-right-8"} flex h-6 w-6 items-center justify-center rounded-full bg-LightShade/30 text-xs text-textPrimary/60 transition hover:bg-LightShade/50 dark:text-textPrimary-dark/60`}
              title="Переслать"
            >
              <RiShareForwardLine />
            </button>
          )}
        </div>
        <ForwardMessageModal isOpen={showForward} onClose={() => setShowForward(false)} message={message} />
      </>
    );
  }

  // Determine if message has a file attachment
  const hasFile = message?.fileUrl && message?.type !== "VOICE" && message?.type !== "VIDEO_CIRCLE";

  return (
    <>
      <div
        className={`group relative ${
          isOwn
            ? "self-end rounded-br-none bg-gradient-to-br from-bgAccent to-bgAccentDim text-textPrimary-dark before:absolute before:bottom-0 before:right-0 before:h-0 before:w-0 before:translate-x-full before:border-l-8 before:border-t-8 before:border-l-bgAccentDim before:border-t-transparent before:content-[''] dark:from-bgAccent-dark dark:to-bgAccentDim-dark before:dark:border-l-bgAccentDim-dark"
            : "rounded-bl-none bg-bgPrimary before:absolute before:bottom-0 before:left-0 before:h-0 before:w-0 before:-translate-x-full before:border-r-8 before:border-t-8 before:border-r-bgPrimary before:border-t-transparent before:content-[''] dark:bg-LightShade/20 before:dark:border-r-LightShade/20"
        } my-1 w-fit max-w-[80%] rounded-2xl px-4 py-2 shadow-md before:shadow-md`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {isGroup && !isOwn && message?.sender_id && (
          <p className="mb-0.5 text-xs font-bold text-bgAccent dark:text-bgAccent-dark">
            {message.sender_id}
          </p>
        )}

        {/* File attachment (image / video / document) */}
        {hasFile && (
          <div className="mb-1">
            <FileAttachment
              fileUrl={message.fileUrl}
              fileName={message.fileName}
              fileType={message.fileType}
              isOwn={isOwn}
            />
          </div>
        )}

        {/* Text content (skip if only an attachment marker) */}
        {message?.content && !message.content.startsWith("📎 ") && (
          <p>
            {message.content}
            <span className="float-right ml-2 mt-2 select-none text-xs opacity-70">
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

        {/* Forward button */}
        {hovered && (
          <button
            onClick={() => setShowForward(true)}
            className={`absolute top-1 ${isOwn ? "-left-8" : "-right-8"} flex h-6 w-6 items-center justify-center rounded-full bg-LightShade/30 text-xs text-textPrimary/60 transition hover:bg-LightShade/50 dark:text-textPrimary-dark/60`}
            title="Переслать"
          >
            <RiShareForwardLine />
          </button>
        )}
      </div>

      <ForwardMessageModal
        isOpen={showForward}
        onClose={() => setShowForward(false)}
        message={message}
      />
    </>
  );
}

export default MessageItem;
