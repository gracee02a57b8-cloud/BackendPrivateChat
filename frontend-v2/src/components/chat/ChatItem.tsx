// ═══════════════════════════════════════════════
//  Chat List Item — Telegram style
// ═══════════════════════════════════════════════
import { cn, formatTime, truncate } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import type { Room } from '@/store';
import { Check, CheckCheck, Pin, VolumeX, Bookmark } from 'lucide-react';

interface ChatItemProps {
  room: Room;
  active: boolean;
  username: string;
  avatarMap: Record<string, string>;
  onClick: () => void;
}

export default function ChatItem({ room, active, username, avatarMap, onClick }: ChatItemProps) {
  const isSaved = room.type === 'SAVED';
  const isPrivate = room.type === 'PRIVATE';
  const otherUser = room.otherUser || room.members?.find((m) => m !== username) || room.name;
  const displayName = isSaved ? 'Избранное' : isPrivate ? otherUser : room.name;
  const avatar = isSaved ? undefined : isPrivate ? avatarMap[otherUser] : room.avatarUrl;
  const typing = room.typingUsers?.filter((u) => u !== username);
  const hasUnread = (room.unreadCount || 0) > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors cursor-pointer text-left group',
        active
          ? 'bg-(--color-accent) text-white'
          : 'hover:bg-(--color-bg-hover) active:bg-(--color-bg-active)'
      )}
    >
      {/* Avatar */}
      {isSaved ? (
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shrink-0">
          <Bookmark size={20} className="text-white" />
        </div>
      ) : (
        <Avatar
          src={avatar}
          name={displayName}
          size="md"
          online={isPrivate ? room.members?.some((m) => m !== username) ? undefined : undefined : undefined}
        />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('font-medium text-[14.5px] truncate', hasUnread && !active && 'font-semibold')}>
            {displayName}
          </span>
          <span className={cn(
            'text-[11px] shrink-0',
            active ? 'text-white/70' : hasUnread ? 'text-(--color-accent)' : 'text-(--color-text-tertiary)'
          )}>
            {formatTime(room.lastMessageTime)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn(
            'text-[13px] truncate',
            active ? 'text-white/80' : typing?.length ? 'text-(--color-accent)' : 'text-(--color-text-secondary)'
          )}>
            {typing?.length ? (
              <span className="italic">{typing[0]} печатает...</span>
            ) : (
              <>
                {room.lastSender && room.lastSender !== username && !isSaved && (
                  <span className={cn(active ? 'text-white/90' : 'text-(--color-text-primary)', 'font-medium')}>
                    {room.lastSender}:{' '}
                  </span>
                )}
                {truncate(room.lastMessage || '', 40)}
              </>
            )}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {room.pinned && (
              <Pin size={12} className={cn(active ? 'text-white/60' : 'text-(--color-text-tertiary)')} />
            )}
            {room.muted && (
              <VolumeX size={12} className={cn(active ? 'text-white/60' : 'text-(--color-text-tertiary)')} />
            )}
            {hasUnread && (
              <span className={cn(
                'min-w-[20px] h-5 px-1.5 text-[11px] font-medium rounded-full flex items-center justify-center',
                active ? 'bg-white/25 text-white' : room.muted ? 'bg-(--color-text-tertiary) text-white' : 'bg-(--color-accent) text-white'
              )}>
                {room.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
