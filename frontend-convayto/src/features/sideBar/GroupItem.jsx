import { useNavigate, useParams } from "react-router-dom";
import { useEnterKeyPress } from "../../utils/useEnterKeyPress";
import { getRandomAvatar } from "../../utils/avatarUtils";
import { isPinned, togglePinChat } from "../../utils/pinnedChats";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RiPushpinLine, RiUnpinLine } from "react-icons/ri";

function GroupItem({ group, handler }) {
  const { roomId: currentRoomId } = useParams();
  const isActive = currentRoomId === group.id;
  const queryClient = useQueryClient();

  const navigate = useNavigate();
  const [ctxMenu, setCtxMenu] = useState(null);
  const longPressTimer = useRef(null);

  const pinned = isPinned(group.id);

  function handleClick() {
    if (ctxMenu) { setCtxMenu(null); return; }
    handler();
    navigate(`/chat/room/${encodeURIComponent(group.id)}`);
  }

  function handleContextMenu(e) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  function handleTouchStart(e) {
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
    togglePinChat(group.id);
    setCtxMenu(null);
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
  }

  const handleKeyDown = useEnterKeyPress(handleClick);

  const membersText = `${group.members?.length || 0} участник${
    (group.members?.length || 0) === 1
      ? ""
      : (group.members?.length || 0) < 5
        ? "а"
        : "ов"
  }`;

  return (
    <>
      <div
        className={`chat-item-premium ${
          isActive
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
        <span className="flex h-[3rem] w-[3rem] flex-shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-LightShade/[0.06]">
          <img
            src={group.avatarUrl || getRandomAvatar(group.name || group.id)}
            alt={group.name}
            className="avatar-ring pointer-events-none h-full w-full object-cover"
          />
        </span>

        {/* Content */}
        <span className="flex flex-1 flex-col overflow-hidden">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold leading-tight">
              {pinned && <RiPushpinLine className="mr-1 inline-flex flex-shrink-0 text-[11px] text-bgAccent dark:text-bgAccent-dark" />}
              {group.name}
            </span>
          </span>
          <span className={`truncate text-[12.5px] leading-snug ${isActive ? "opacity-80" : "opacity-45"}`}>
            {group.description || membersText}
          </span>
        </span>
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

export default GroupItem;
