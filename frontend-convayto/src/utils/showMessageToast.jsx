import toast from "react-hot-toast";
import { getRandomAvatar } from "./avatarUtils";

/**
 * Show a rich notification toast for incoming messages.
 * Displays avatar, sender name, time, and message preview.
 */
export function showMessageToast({ sender, content, timestamp, msgId, avatar }) {
  const preview = (content || "").substring(0, 60) || "📎 Вложение";

  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });

  toast.custom(
    (t) => (
      <div
        data-testid="message-toast"
        className={`${
          t.visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
        } pointer-events-auto flex w-full max-w-[360px] items-center gap-3 rounded-xl bg-[#1e293b] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300`}
      >
        <img
          src={avatar || getRandomAvatar(sender)}
          alt={sender}
          data-testid="toast-avatar"
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        />
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span
              data-testid="toast-sender"
              className="truncate text-sm font-bold text-slate-100"
            >
              {sender}
            </span>
            <span
              data-testid="toast-time"
              className="shrink-0 text-[11px] text-slate-400"
            >
              {time}
            </span>
          </div>
          <p
            data-testid="toast-preview"
            className="mt-0.5 truncate text-[13px] text-slate-300"
          >
            {preview}
          </p>
        </div>
      </div>
    ),
    {
      position: "bottom-right",
      duration: 4000,
      id: `msg-${msgId || Date.now()}`,
    },
  );
}
