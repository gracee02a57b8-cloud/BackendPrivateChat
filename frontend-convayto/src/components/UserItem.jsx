import { useNavigate, useParams } from "react-router-dom";
import { useEnterKeyPress } from "../utils/useEnterKeyPress";
import { getRandomAvatar } from "../utils/avatarUtils";
import { isPinned, togglePinChat } from "../utils/pinnedChats";
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
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  const handleKeyDown = useEnterKeyPress(handleClick);

  return (
    <>
      <div
        className={`${
          isActiveUser
            ? "pointer-events-none bg-gradient-to-r text-textPrimary-dark sm:from-bgAccentDim sm:to-bgAccent dark:sm:from-bgAccentDim-dark dark:sm:to-bgAccent-dark"
            : "hover:bg-LightShade/20"
        } relative flex cursor-pointer select-none items-center gap-2 rounded-lg p-2`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
          <img
            src={avatar || getRandomAvatar(name || id)}
            alt={name}
            className="pointer-events-none h-full w-full object-cover"
          />
          {online && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bgPrimary bg-green-500 dark:border-bgPrimary-dark" />
          )}
        </span>

        <span className="flex flex-1 flex-col overflow-hidden">
          <span className="flex items-center gap-1 truncate font-bold">
            {pinned && <RiPushpinLine className="flex-shrink-0 text-xs text-bgAccent dark:text-bgAccent-dark" />}
            {name}
            {muted && <RiVolumeMuteLine className="flex-shrink-0 text-xs opacity-40" title="Замьючен" />}
          </span>

          <span className="truncate text-sm opacity-70">{subtext}</span>
        </span>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[8000]" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-[8001] min-w-[180px] rounded-xl border border-LightShade/20 bg-bgPrimary p-1 shadow-2xl dark:bg-bgPrimary-dark"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            <button
              onClick={handleTogglePin}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-LightShade/20"
            >
              {pinned ? <RiUnpinLine className="text-base" /> : <RiPushpinLine className="text-base" />}
              {pinned ? "Открепить чат" : "Закрепить чат"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default UserItem;
