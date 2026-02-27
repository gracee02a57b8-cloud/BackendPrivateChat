import { useEffect, useRef, useState } from "react";
import {
  RiReplyLine,
  RiFileCopyLine,
  RiShareForwardLine,
  RiPushpinLine,
  RiUnpinLine,
  RiCheckboxMultipleLine,
  RiDeleteBinLine,
  RiDeleteBin2Line,
  RiEmotionLine,
} from "react-icons/ri";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function MessageContextMenu({
  x,
  y,
  isOwn,
  isPinned,
  onReply,
  onCopy,
  onForward,
  onPin,
  onSelect,
  onDelete,
  onDeleteForAll,
  onReaction,
  onClose,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    function handleEsc(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  const items = [
    { icon: RiReplyLine, label: "Ответить", action: onReply },
    { icon: RiFileCopyLine, label: "Копировать", action: onCopy },
    { icon: RiShareForwardLine, label: "Переслать", action: onForward },
    { icon: isPinned ? RiUnpinLine : RiPushpinLine, label: isPinned ? "Открепить" : "Закрепить", action: onPin },
    { icon: RiCheckboxMultipleLine, label: "Выбрать", action: onSelect },
    { divider: true },
    { icon: RiDeleteBinLine, label: "Удалить у себя", action: onDelete, danger: true },
    ...(isOwn
      ? [
          {
            icon: RiDeleteBin2Line,
            label: "Удалить для всех",
            action: onDeleteForAll,
            danger: true,
          },
        ]
      : []),
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[210px] animate-in fade-in rounded-xl bg-bgPrimary shadow-2xl ring-1 ring-LightShade/20 backdrop-blur-sm dark:bg-bgPrimary-dark dark:ring-LightShade/30"
      style={{ left: x, top: y }}
    >
      {/* Quick reaction bar */}
      {onReaction && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-LightShade/15">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onReaction(emoji); onClose(); }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-LightShade/20 hover:scale-125 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="py-1.5">
        {items.map((item, i) =>
          item.divider ? (
            <div key={i} className="my-1 border-t border-LightShade/15" />
          ) : (
            <button
              key={i}
              onClick={() => {
                item.action?.();
                onClose();
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-LightShade/10 active:bg-LightShade/20 ${
                item.danger
                  ? "text-red-400 hover:text-red-300"
                  : "text-textPrimary dark:text-textPrimary-dark"
              }`}
            >
              <item.icon className="text-base flex-shrink-0" />
              {item.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export default MessageContextMenu;
