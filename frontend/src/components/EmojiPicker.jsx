import { useState, useRef, useEffect } from 'react';

const EMOJI_DATA = {
  'Смайлы': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐'],
  'Жесты': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏'],
  'Сердца': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟'],
  'Животные': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦅','🦉','🦄','🐝','🐛','🦋','🐌','🐞'],
  'Еда': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥝','🍔','🍕','🌭','🍟','🌮','🍩','🍪','🎂','🍰','🧁','☕','🍵'],
  'Объекты': ['⚽','🏀','🎾','🎮','🎲','🎵','🎸','🎤','🎧','💻','📱','💡','🔥','⭐','🌈','☀️','🌙','⚡','💎','🎁','🎉','🎊','🏆','🥇','🚀','✈️'],
};

export default function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(Object.keys(EMOJI_DATA)[0]);
  const [search, setSearch] = useState('');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const allEmojis = search
    ? Object.values(EMOJI_DATA).flat().filter((e) => e.includes(search))
    : EMOJI_DATA[activeCategory];

  return (
    <div className="emoji-picker" ref={pickerRef}>
      <div className="emoji-search">
        <input
          type="text"
          placeholder="Поиск эмодзи..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      {!search && (
        <div className="emoji-categories">
          {Object.keys(EMOJI_DATA).map((cat) => (
            <button
              key={cat}
              className={`emoji-cat-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              title={cat}
            >
              {EMOJI_DATA[cat][0]}
            </button>
          ))}
        </div>
      )}
      <div className="emoji-grid">
        {allEmojis.map((emoji, i) => (
          <span
            key={i}
            className="emoji-item"
            onClick={() => onSelect(emoji)}
            role="button"
          >
            {emoji}
          </span>
        ))}
      </div>
    </div>
  );
}
