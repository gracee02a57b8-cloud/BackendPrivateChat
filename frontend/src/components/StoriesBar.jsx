import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { getAvatarColor, getInitials } from '../utils/avatar';

/**
 * Horizontal scrollable stories bar — Telegram style.
 * Shows circle avatars with colored ring (gradient if unviewed, grey if all viewed).
 * First item is "My story" with a + button if user has no stories.
 */
export default function StoriesBar({
  groupedStories = [],
  username,
  avatarUrl,
  avatarMap = {},
  onOpenViewer,
  onOpenUpload,
}) {
  const scrollRef = useRef(null);

  const myGroup = groupedStories.find(g => g.author === username);
  const otherGroups = groupedStories.filter(g => g.author !== username);

  return (
    <div className="stories-bar" ref={scrollRef}>
      {/* My story */}
      <div className="stories-bar-item" onClick={() => myGroup ? onOpenViewer(username) : onOpenUpload()}>
        <div className={`stories-bar-ring${myGroup ? (myGroup.hasUnviewed ? ' unviewed' : ' viewed') : ' add'}`}>
          <div className="stories-bar-avatar" style={{ background: avatarUrl ? 'transparent' : getAvatarColor(username) }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="stories-bar-avatar-img" />
              : getInitials(username)}
          </div>
          {!myGroup && (
            <span className="stories-bar-add-badge"><Plus size={12} /></span>
          )}
        </div>
        <span className="stories-bar-name">
          {myGroup ? 'Моя история' : 'Добавить'}
        </span>
      </div>

      {/* Other users' stories */}
      {otherGroups.map(group => {
        const av = avatarMap[group.author];
        return (
          <div
            key={group.author}
            className="stories-bar-item"
            onClick={() => onOpenViewer(group.author)}
          >
            <div className={`stories-bar-ring${group.hasUnviewed ? ' unviewed' : ' viewed'}`}>
              <div className="stories-bar-avatar" style={{ background: av ? 'transparent' : getAvatarColor(group.author) }}>
                {av
                  ? <img src={av} alt="" className="stories-bar-avatar-img" />
                  : getInitials(group.author)}
              </div>
            </div>
            <span className="stories-bar-name">{group.author}</span>
          </div>
        );
      })}
    </div>
  );
}
