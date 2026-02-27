import { useUser } from "../authentication/useUser";
import { formatTime } from "../../utils/common";
import useConvInfo from "./useConvInfo";
import { useState } from "react";
import { RiShareForwardLine } from "react-icons/ri";
import ForwardMessageModal from "../../components/ForwardMessageModal";

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
        {/* Показать имя отправителя в групповых чатах (не для своих сообщений) */}
        {isGroup && !isOwn && message?.sender_id && (
          <p className="mb-0.5 text-xs font-bold text-bgAccent dark:text-bgAccent-dark">
            {message.sender_id}
          </p>
        )}
        <p>
          {message?.content}
          <span className="float-right ml-2 mt-2 select-none text-xs opacity-70">
            {formatTime(message?.created_at)}
          </span>
        </p>

        {/* Forward button (appears on hover) */}
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
