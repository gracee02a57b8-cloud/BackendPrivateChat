import { useNavigate, useParams } from "react-router-dom";
import { useEnterKeyPress } from "../utils/useEnterKeyPress";
import { getRandomAvatar } from "../utils/avatarUtils";
import { isPinned, togglePinChat } from "../utils/pinnedChats";
import { clear as clearUnread } from "../utils/unreadStore";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RiPushpinLine, RiUnpinLine, RiVolumeMuteLine } from "react-icons/ri";

function UserItem({
  id,
  name,
  avatar,
  subtext,
  handler,
  shouldReplace = false,
  roomId,
  online,
  muted,
  unreadCount = 0,
}) {
  const { userId: currentFriendId } = useParams();
  const isActiveUser = currentFriendId === id;
  const queryClient = useQueryClient();

  const navigate = useNavigate();
  const [ctxMenu, setCtxMenu] = useState(null);
  const longPressTimer = useRef(null);

  const chatId = roomId || id;
  const pinned = isPinned(chatId);

  function handleClick() {
    if (ctxMenu) { setCtxMenu(null); return; }
    if (roomId) clearUnread(roomId);
    handler();
    navigate(`/chat/${id}`, { replace: shouldReplace });
  }

  function handleContextMenu(e) {
    e.preventDefault();
    if (!roomId) return; // only show menu for conversations, not contacts
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  function handleTouchStart(e) {
    if (!roomId) return;
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setCtxMenu({ x: touch.clientX, y: touch.clientY });
    }, 500);
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleTogglePin() {
    togglePinChat(chatId);
    setCtxMenu(null);
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
  }

  const handleKeyDown = useEnterKeyPress(handleClick);

  return (
    <>
      <div
        className={`chat-item-premium ${
          isActiveUser
            ? "chat-item-active-glow pointer-events-none rounded-xl bg-gradient-to-r from-bgAccent/90 to-bgAccent text-white dark:from-bgAccent-dark/90 dark:to-bgAccent-dark"
            : "rounded-xl"
        } relative flex cursor-pointer select-none items-center gap-3 px-3 py-2.5`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        {/* Avatar */}
        <span className="relative flex h-[3rem] w-[3rem] flex-shrink-0 items-center justify-center">
          <img
            src={avatar || getRandomAvatar(name || id)}
            alt={name}
            className="avatar-ring pointer-events-none h-full w-full rounded-full object-cover ring-2 ring-LightShade/[0.06]"
          />
          {online && (
            <span className="online-pulse absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-bgPrimary bg-emerald-500 dark:border-bgPrimary-dark" />
          )}
        </span>

        {/* Content */}
        <span className="flex flex-1 flex-col overflow-hidden">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold leading-tight">
              {pinned && <RiPushpinLine className="mr-1 inline-flex flex-shrink-0 text-[11px] text-bgAccent dark:text-bgAccent-dark" />}
              {name}
            </span>
            {muted && <RiVolumeMuteLine className="flex-shrink-0 text-[11px] opacity-30" title="Замьючен" />}
          </span>

          <span className={`truncate text-[12.5px] leading-snug ${isActiveUser ? "opacity-80" : "opacity-45"}`}>
            {subtext}
          </span>
        </span>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="badge-pop flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-gradient-to-br from-bgAccent to-bgAccent/80 px-1.5 text-[11px] font-bold leading-none text-white shadow-lg shadow-bgAccent/25 dark:from-bgAccent-dark dark:to-bgAccent-dark/80 dark:shadow-bgAccent-dark/25"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[8000]" onClick={() => setCtxMenu(null)} />
          <div
            className="ctx-menu-premium fixed z-[8001] min-w-[200px] rounded-2xl bg-bgPrimary/90 p-1.5 dark:bg-bgPrimary-dark/90"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            <button
              onClick={handleTogglePin}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-LightShade/10"
            >
              {pinned ? <RiUnpinLine className="text-base opacity-70" /> : <RiPushpinLine className="text-base opacity-70" />}
              {pinned ? "Открепить чат" : "Закрепить чат"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default UserItem;
