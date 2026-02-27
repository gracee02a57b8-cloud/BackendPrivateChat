import { useUser } from "../authentication/useUser";
import { formatTime } from "../../utils/common";
import useConvInfo from "./useConvInfo";

function MessageItem({ message }) {
  const { user } = useUser();
  const { convInfo } = useConvInfo();
  const isGroup = convInfo?.isGroup;
  const isOwn = message?.sender_id === user.id;

  return (
    <div
      className={`relative ${
        isOwn
          ? "self-end rounded-br-none bg-gradient-to-br from-bgAccent to-bgAccentDim text-textPrimary-dark before:absolute before:bottom-0 before:right-0 before:h-0 before:w-0 before:translate-x-full before:border-l-8 before:border-t-8 before:border-l-bgAccentDim before:border-t-transparent before:content-[''] dark:from-bgAccent-dark dark:to-bgAccentDim-dark before:dark:border-l-bgAccentDim-dark"
          : "rounded-bl-none bg-bgPrimary before:absolute before:bottom-0 before:left-0 before:h-0 before:w-0 before:-translate-x-full before:border-r-8 before:border-t-8 before:border-r-bgPrimary before:border-t-transparent before:content-[''] dark:bg-LightShade/20 before:dark:border-r-LightShade/20"
      } my-1 w-fit max-w-[80%] rounded-2xl px-4 py-2 shadow-md before:shadow-md`}
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
    </div>
  );
}

export default MessageItem;
