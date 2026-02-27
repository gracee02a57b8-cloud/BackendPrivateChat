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
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
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
        className={`${
          isActive
            ? "pointer-events-none bg-gradient-to-r text-textPrimary-dark sm:from-bgAccentDim sm:to-bgAccent dark:sm:from-bgAccentDim-dark dark:sm:to-bgAccent-dark"
            : "hover:bg-LightShade/20"
        } flex cursor-pointer select-none items-center gap-2 rounded-lg p-2`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
          <img
            src={group.avatarUrl || getRandomAvatar(group.name || group.id)}
            alt={group.name}
            className="pointer-events-none h-full w-full object-cover"
          />
        </span>

        <span className="flex flex-1 flex-col overflow-hidden">
          <span className="flex items-center gap-1 truncate font-bold">
            {pinned && <RiPushpinLine className="flex-shrink-0 text-xs text-bgAccent dark:text-bgAccent-dark" />}
            {group.name}
          </span>
          <span className="truncate text-sm opacity-70">
            {group.description || membersText}
          </span>
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

export default GroupItem;
