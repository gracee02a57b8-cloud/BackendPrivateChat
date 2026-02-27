import { useState, useRef, useEffect } from "react";

const EMOJI_LIST = [
  "👍", "👎", "❤️", "🔥", "😂", "😮", "😢", "😡",
  "🎉", "🤔", "👏", "🙏", "💯", "✅", "❌", "⭐",
  "🥰", "😎", "🤣", "😱", "💪", "🫡", "🤝", "🙌",
];

function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
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

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 z-[9999] rounded-xl bg-bgPrimary p-2 shadow-2xl ring-1 ring-LightShade/20 backdrop-blur-sm dark:bg-bgPrimary-dark dark:ring-LightShade/30"
    >
      <div className="grid grid-cols-8 gap-1">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-LightShade/20 hover:scale-110 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default EmojiPicker;
