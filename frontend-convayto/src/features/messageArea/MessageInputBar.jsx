import { RiSendPlaneFill, RiAttachmentLine, RiMicLine, RiStopFill, RiCloseLine, RiReplyLine, RiBarChartBoxLine } from "react-icons/ri";
import { useUser } from "../authentication/useUser";
import { useRef, useState, useCallback, useEffect } from "react";
import { useSendNewMessage } from "./useSendNewMessage";
import { v4 as uuid } from "uuid";
import Loader from "../../components/Loader";
import useConvInfo from "./useConvInfo";
import { sendFileMessage, sendVoiceMessage, sendVideoCircle, createPoll } from "./apiMessage";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import PollCreationModal from "../../components/PollCreationModal";

function MessageInputBar({ replyTo, setReplyTo }) {
  const {
    convInfo,
    isPending: isPendingConvInfo,
    isError: isConvInfoError,
  } = useConvInfo();

  const [newMessage, setNewMessage] = useState("");
  const { isSending, sendNewMessage } = useSendNewMessage();
  const { user } = useUser();
  const conversationId = convInfo?.id;
  const friendUserId = convInfo?.friendInfo?.id;
  const myUserId = user?.id;
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const voiceRecorderRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceTimerRef = useRef(null);
  const voiceStartRef = useRef(null);

  // Video circle state
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoTimerRef = useRef(null);
  const videoStartRef = useRef(null);
  const videoStreamRef = useRef(null);
  const videoPreviewRef = useRef(null);

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);

  // Attach camera stream to preview element after recording UI renders
  useEffect(() => {
    if (isRecordingVideo && videoStreamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = videoStreamRef.current;
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [isRecordingVideo]);

  // Poll state
  const [showPollModal, setShowPollModal] = useState(false);

  async function handleCreatePoll({ question, options, multiChoice, anonymous }) {
    if (!conversationId) return;
    try {
      await createPoll(conversationId, { question, options, multiChoice, anonymous });
      toast.success("Опрос создан");
    } catch (err) {
      toast.error(err.message || "Ошибка создания опроса");
      throw err;
    }
  }

  function addOptimisticMessage(msg) {
    queryClient.setQueryData(["friend", friendUserId], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page, i) =>
          i === 0 ? [...(page || []), msg] : page,
        ),
      };
    });
  }

  // --- Send text message ---
  function handleSendNewMessage(e) {
    e.preventDefault();
    inputRef.current?.focus();
    if (!newMessage) return;

    const messageObj = {
      id: uuid(),
      conversation_id: conversationId,
      content: newMessage,
      friendUserId,
      sender_id: myUserId,
      created_at: new Date(),
      optimistic: true,
      ...(replyTo
        ? {
            replyToId: replyTo.id,
            replyToSender: replyTo.sender_id,
            replyToContent: replyTo.content || "📎 Вложение",
          }
        : {}),
    };

    setNewMessage("");
    setReplyTo?.(null);
    sendNewMessage(messageObj, {
      onError: (_, message) => setNewMessage(message.content),
    });
  }

  // --- File attachment ---
  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsUploading(true);
    const msgId = uuid();
    const optimistic = {
      id: msgId,
      conversation_id: conversationId,
      content: `📎 ${file.name}`,
      sender_id: myUserId,
      created_at: new Date().toISOString(),
      type: "CHAT",
      fileUrl: null,
      fileName: file.name,
      optimistic: true,
    };
    addOptimisticMessage(optimistic);

    try {
      await sendFileMessage({
        id: msgId,
        conversation_id: conversationId,
        friendUserId,
        file,
      });
    } catch (err) {
      toast.error(err.message || "Ошибка загрузки файла");
    } finally {
      setIsUploading(false);
    }
  }

  // --- Voice recording ---
  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: getSupportedAudioMime() });
      voiceChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(voiceTimerRef.current);
        const duration = (Date.now() - voiceStartRef.current) / 1000;
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType });

        if (duration < 1) {
          toast.error("Слишком короткое сообщение");
          setIsRecordingVoice(false);
          setVoiceDuration(0);
          return;
        }

        setIsUploading(true);
        setIsRecordingVoice(false);
        setVoiceDuration(0);

        const msgId = uuid();
        addOptimisticMessage({
          id: msgId,
          conversation_id: conversationId,
          content: "🎤 Голосовое сообщение",
          sender_id: myUserId,
          created_at: new Date().toISOString(),
          type: "VOICE",
          duration: Math.round(duration),
          optimistic: true,
        });

        try {
          await sendVoiceMessage({
            id: msgId,
            conversation_id: conversationId,
            friendUserId,
            blob,
            duration,
          });
        } catch (err) {
          toast.error(err.message || "Ошибка отправки голосового");
        } finally {
          setIsUploading(false);
        }
      };

      voiceRecorderRef.current = recorder;
      recorder.start();
      voiceStartRef.current = Date.now();
      setIsRecordingVoice(true);
      setVoiceDuration(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceDuration(Math.floor((Date.now() - voiceStartRef.current) / 1000));
      }, 1000);
    } catch {
      toast.error("Нет доступа к микрофону");
    }
  }, [conversationId, friendUserId, myUserId]);

  function stopVoiceRecording() {
    voiceRecorderRef.current?.stop();
  }

  // --- Video circle recording ---
  const startVideoRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400, facingMode: "user" },
        audio: true,
      });
      videoStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: getSupportedVideoMime() });
      videoChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(videoTimerRef.current);
        const duration = (Date.now() - videoStartRef.current) / 1000;
        const blob = new Blob(videoChunksRef.current, { type: recorder.mimeType });

        if (duration < 1) {
          toast.error("Слишком короткое видео");
          setIsRecordingVideo(false);
          setVideoDuration(0);
          return;
        }

        setIsUploading(true);
        setIsRecordingVideo(false);
        setVideoDuration(0);

        const msgId = uuid();
        addOptimisticMessage({
          id: msgId,
          conversation_id: conversationId,
          content: "🎥 Видеокружок",
          sender_id: myUserId,
          created_at: new Date().toISOString(),
          type: "VIDEO_CIRCLE",
          duration: Math.round(duration),
          optimistic: true,
        });

        try {
          await sendVideoCircle({
            id: msgId,
            conversation_id: conversationId,
            friendUserId,
            blob,
            duration,
          });
        } catch (err) {
          toast.error(err.message || "Ошибка отправки видеокружка");
        } finally {
          setIsUploading(false);
        }
      };

      videoRecorderRef.current = recorder;
      recorder.start();
      videoStartRef.current = Date.now();
      setIsRecordingVideo(true);
      setVideoDuration(0);
      videoTimerRef.current = setInterval(() => {
        setVideoDuration(Math.floor((Date.now() - videoStartRef.current) / 1000));
      }, 1000);

      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (videoRecorderRef.current?.state === "recording") {
          videoRecorderRef.current.stop();
        }
      }, 60000);
    } catch {
      toast.error("Нет доступа к камере или микрофону");
    }
  }, [conversationId, friendUserId, myUserId]);

  function stopVideoRecording() {
    videoRecorderRef.current?.stop();
  }

  function cancelVideoRecording() {
    // Stop the recorder without triggering onstop send logic
    const recorder = videoRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    // Stop camera/mic tracks
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    clearInterval(videoTimerRef.current);
    setIsRecordingVideo(false);
    setVideoDuration(0);
    videoChunksRef.current = [];
    toast("Запись отменена", { icon: "🗑️" });
  }

  function cancelVoiceRecording() {
    const recorder = voiceRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    clearInterval(voiceTimerRef.current);
    setIsRecordingVoice(false);
    setVoiceDuration(0);
    voiceChunksRef.current = [];
    toast("Запись отменена", { icon: "🗑️" });
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (isConvInfoError) return null;

  // Video circle recording overlay
  if (isRecordingVideo) {
    return (
      <div className="px-4 py-2">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-transparent bg-bgPrimary p-4 shadow-lg dark:border-LightShade/20 dark:bg-LightShade/20">
          {/* Round video preview */}
          <div className="relative h-48 w-48">
            <div className="absolute inset-0 animate-ping rounded-full border-2 border-red-400 opacity-30" />
            <div className="relative h-full w-full overflow-hidden rounded-full border-4 border-red-500 shadow-lg">
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-0.5 text-sm font-mono text-white">
                {formatDuration(videoDuration)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={cancelVideoRecording}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-500 text-white shadow-lg transition hover:bg-gray-600 active:scale-95"
              title="Отменить запись"
              data-testid="cancel-video-recording"
            >
              <RiCloseLine className="text-2xl" />
            </button>
            <button
              onClick={stopVideoRecording}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-95"
              title="Остановить и отправить"
              data-testid="stop-video-recording"
            >
              <RiStopFill className="text-2xl" />
            </button>
          </div>
          <p className="text-xs text-textPrimary/50 dark:text-textPrimary-dark/50">
            Макс. 60 сек. Стоп — отправить, ✕ — отменить.
          </p>
        </div>
      </div>
    );
  }

  // Voice recording bar
  if (isRecordingVoice) {
    return (
      <div className="px-4 py-2">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-full border border-transparent bg-bgPrimary px-4 py-2 shadow-lg dark:border-LightShade/20 dark:bg-LightShade/20">
          <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-sm tabular-nums">
            {formatDuration(voiceDuration)}
          </span>
          <span className="flex-1 text-sm text-textPrimary/50 dark:text-textPrimary-dark/50">
            Запись голосового...
          </span>
          <button
            onClick={cancelVoiceRecording}
            className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-textPrimary/60 transition hover:bg-LightShade/20 active:scale-95 dark:text-textPrimary-dark/60"
            title="Отменить запись"
            data-testid="cancel-voice-recording"
          >
            <RiCloseLine />
          </button>
          <button
            onClick={stopVoiceRecording}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600 active:scale-95"
            title="Остановить и отправить"
            data-testid="stop-voice-recording"
          >
            <RiStopFill className="text-xl" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      {/* Reply preview bar */}
      {replyTo && (
        <div className="mx-auto mb-1.5 flex max-w-3xl items-center gap-2 rounded-xl bg-bgPrimary px-3 py-2 shadow dark:bg-LightShade/20">
          <RiReplyLine className="flex-shrink-0 text-lg text-bgAccent dark:text-bgAccent-dark" />
          <div className="min-w-0 flex-1 border-l-2 border-bgAccent pl-2 dark:border-bgAccent-dark">
            <p className="truncate text-xs font-semibold text-bgAccent dark:text-bgAccent-dark">
              {replyTo.sender_id || ""}
            </p>
            <p className="truncate text-xs text-textPrimary/60 dark:text-textPrimary-dark/60">
              {replyTo.content || "📎 Вложение"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo?.(null)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg transition hover:bg-LightShade/20"
          >
            <RiCloseLine />
          </button>
        </div>
      )}
      <form onSubmit={handleSendNewMessage} className="mx-auto flex max-w-3xl items-center gap-0.5 overflow-hidden rounded-full border border-transparent bg-bgPrimary shadow-lg dark:border-LightShade/20 dark:bg-LightShade/20">
        {/* File attachment */}
        <label
          htmlFor="fileAttach"
          className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-xl text-textPrimary/60 transition hover:bg-LightShade/20 active:scale-95 dark:text-textPrimary-dark/60 ml-1"
          title="Прикрепить файл"
        >
          {isUploading ? <Loader size="small" /> : <RiAttachmentLine />}
        </label>
        <input
          ref={fileInputRef}
          id="fileAttach"
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isPendingConvInfo || isUploading}
        />

        {/* Poll button */}
        <button
          type="button"
          onClick={() => setShowPollModal(true)}
          disabled={isPendingConvInfo || isUploading}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl text-textPrimary/60 transition hover:bg-LightShade/20 active:scale-95 disabled:opacity-40 dark:text-textPrimary-dark/60"
          title="Создать опрос"
        >
          <RiBarChartBoxLine />
        </button>

        <label htmlFor="inputMessage" className="sr-only" />
        <input
          disabled={isPendingConvInfo}
          className="h-12 min-w-0 flex-1 bg-transparent pr-2 outline-none"
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          type="text"
          placeholder="Сообщение"
          id="inputMessage"
          autoComplete="off"
        />

        {/* Voice message button */}
        <button
          type="button"
          onClick={startVoiceRecording}
          disabled={isPendingConvInfo || isUploading}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl text-textPrimary/60 transition hover:bg-LightShade/20 active:scale-95 disabled:opacity-40 dark:text-textPrimary-dark/60"
          title="Голосовое сообщение"
        >
          <RiMicLine />
        </button>

        {/* Video circle button */}
        <button
          type="button"
          onClick={startVideoRecording}
          disabled={isPendingConvInfo || isUploading}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl text-textPrimary/60 transition hover:bg-LightShade/20 active:scale-95 disabled:opacity-40 dark:text-textPrimary-dark/60"
          title="Видеокружок"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <rect x="8" y="8.5" width="5.5" height="7" rx="1" />
            <path d="M13.5 10.5l3-1.5v6l-3-1.5" />
          </svg>
        </button>

        {/* Send button */}
        <button
          className="m-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-bgAccent text-2xl text-textPrimary-dark hover:bg-bgAccentDim active:scale-95 disabled:opacity-70 dark:bg-bgAccent-dark dark:hover:bg-bgAccentDim-dark"
          disabled={isSending || isPendingConvInfo || isUploading}
          onClick={handleSendNewMessage}
          type="submit"
        >
          {isSending ? (
            <Loader size="small" />
          ) : (
            <RiSendPlaneFill aria-label="send button" />
          )}
        </button>
      </form>
      <PollCreationModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onSubmit={handleCreatePoll}
      />
    </div>
  );
}

function getSupportedAudioMime() {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) return "audio/ogg;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

function getSupportedVideoMime() {
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) return "video/webm;codecs=vp9,opus";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) return "video/webm;codecs=vp8,opus";
  if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
  if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
  return "";
}

export default MessageInputBar;
