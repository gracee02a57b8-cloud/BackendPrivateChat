// ═══════════════════════════════════════════════
//  Group Info Panel — room details + members
// ═══════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useStore, type Room } from '@/store';
import { joinRoom, leaveRoom } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import {
  ArrowLeft, MoreVertical, UserPlus, LogOut, Users,
  Link, Bell, BellOff, Pin, Image, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupInfoPanelProps {
  room: Room;
  onClose: () => void;
}

export default function GroupInfoPanel({ room, onClose }: GroupInfoPanelProps) {
  const { token, username, avatarMap, onlineUsers, updateRoom } = useStore();
  const [members, setMembers] = useState<string[]>(room.members || []);
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState<'members' | 'media' | 'files'>('members');

  useEffect(() => {
    if (!token || !room.id) return;
    // Room members from room.members or fetch
    if (room.members) {
      setMembers(room.members);
    }
  }, [token, room]);

  const handleLeave = async () => {
    if (!token) return;
    try {
      await leaveRoom(token, room.id);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}?join=${room.id}`;
    navigator.clipboard.writeText(link);
  };

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary)">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 bg-(--color-bg-surface) border-b border-(--color-separator) shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-base font-semibold flex-1">Информация о группе</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group avatar + name */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6">
          <Avatar src={room.avatarUrl} name={room.name} size="xl" />
          <h2 className="text-xl font-bold mt-4">{room.name}</h2>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            {members.length} участников
          </p>
          {room.description && (
            <p className="text-sm text-(--color-text-secondary) mt-2 text-center">{room.description}</p>
          )}
        </div>

        {/* Action row */}
        <div className="flex justify-center gap-4 pb-6">
          <ActionCircle icon={<Link size={20} />} label="Ссылка" onClick={copyLink} />
          <ActionCircle
            icon={room.muted ? <BellOff size={20} /> : <Bell size={20} />}
            label={room.muted ? 'Вкл. звук' : 'Выкл. звук'}
            onClick={() => updateRoom(room.id, { muted: !room.muted })}
          />
          <ActionCircle
            icon={<LogOut size={20} />}
            label="Выйти"
            onClick={handleLeave}
            danger
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-(--color-separator) bg-(--color-bg-surface)">
          {(['members', 'media', 'files'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium cursor-pointer transition-colors',
                tab === t ? 'text-(--color-accent) border-b-2 border-(--color-accent)' : 'text-(--color-text-secondary)'
              )}
            >
              {t === 'members' ? `Участники (${members.length})` : t === 'media' ? 'Медиа' : 'Файлы'}
            </button>
          ))}
        </div>

        {/* Members list */}
        {tab === 'members' && (
          <div>
            {/* Add member button */}
            {room.createdBy === username && (
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-(--color-bg-hover) transition-colors cursor-pointer text-(--color-accent)">
                <div className="w-10 h-10 rounded-full bg-(--color-accent)/10 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <span className="text-sm font-medium">Добавить участника</span>
              </button>
            )}

            {members.map((m) => (
              <div key={m} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar
                  src={avatarMap[m]}
                  name={m}
                  size="md"
                  online={onlineUsers.includes(m)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m}</p>
                  <p className={cn(
                    'text-xs',
                    onlineUsers.includes(m) ? 'text-(--color-accent)' : 'text-(--color-text-tertiary)'
                  )}>
                    {onlineUsers.includes(m) ? 'в сети' : 'не в сети'}
                  </p>
                </div>
                {m === room.createdBy && (
                  <span className="text-[10px] text-(--color-accent) bg-(--color-accent)/10 px-2 py-0.5 rounded-full">
                    admin
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Media / Files placeholders */}
        {tab === 'media' && (
          <div className="flex flex-col items-center justify-center h-40 text-(--color-text-tertiary)">
            <Image size={32} className="mb-2 opacity-40" />
            <p className="text-sm">Нет медиа</p>
          </div>
        )}
        {tab === 'files' && (
          <div className="flex flex-col items-center justify-center h-40 text-(--color-text-tertiary)">
            <FileText size={32} className="mb-2 opacity-40" />
            <p className="text-sm">Нет файлов</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCircle({ icon, label, onClick, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 cursor-pointer group">
      <div className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
        danger
          ? 'bg-(--color-danger)/10 text-(--color-danger) group-hover:bg-(--color-danger)/20'
          : 'bg-(--color-accent)/10 text-(--color-accent) group-hover:bg-(--color-accent)/20'
      )}>
        {icon}
      </div>
      <span className={cn('text-xs', danger ? 'text-(--color-danger)' : 'text-(--color-text-secondary)')}>{label}</span>
    </button>
  );
}
