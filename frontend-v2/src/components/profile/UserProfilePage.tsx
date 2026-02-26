// ═══════════════════════════════════════════════
//  User Profile Page — view other user's profile
// ═══════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useStore, type User } from '@/store';
import { getUserProfile, createPrivateRoom, addContact, removeContact, blockUser, unblockUser } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import {
  ArrowLeft, Phone, MessageSquare, MoreVertical, UserPlus, UserMinus,
  Ban, AtSign, Calendar, FileText, Info,
} from 'lucide-react';
import { cn, formatLastSeen } from '@/lib/utils';

interface UserProfilePageProps {
  targetUsername: string;
  onClose: () => void;
  onChat: (roomId: number) => void;
}

export default function UserProfilePage({ targetUsername, onClose, onChat }: UserProfilePageProps) {
  const { token, username, contacts, avatarMap, onlineUsers, addRoom, setActiveRoom, setContacts } = useStore();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);

  const isContact = contacts.some((c) => c.username === targetUsername);
  const isOnline = onlineUsers.includes(targetUsername);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getUserProfile(token, targetUsername)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, targetUsername]);

  const handleMessage = async () => {
    if (!token) return;
    try {
      const room = await createPrivateRoom(token, targetUsername);
      addRoom(room);
      setActiveRoom(room.id);
      onChat(room.id);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleContact = async () => {
    if (!token) return;
    try {
      if (isContact) {
        await removeContact(token, targetUsername);
        setContacts(contacts.filter((c) => c.username !== targetUsername));
      } else {
        await addContact(token, targetUsername);
        setContacts([...contacts, { username: targetUsername, ...(profile || {}) }]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-(--color-accent) border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary)">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 bg-(--color-bg-surface) border-b border-(--color-separator)">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-base font-semibold flex-1">Профиль</h2>
        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="p-2 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
            <MoreVertical size={20} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-(--color-bg-surface) border border-(--color-border) rounded-xl shadow-xl z-50 py-1 min-w-[180px] animate-scaleIn">
                <button
                  onClick={() => { toggleContact(); setMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-(--color-bg-hover) cursor-pointer"
                >
                  {isContact ? <UserMinus size={16} /> : <UserPlus size={16} />}
                  {isContact ? 'Удалить из контактов' : 'Добавить в контакты'}
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-(--color-bg-hover) cursor-pointer text-(--color-danger)">
                  <Ban size={16} /> Заблокировать
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Profile content */}
      <div className="flex-1 overflow-y-auto">
        {/* Avatar + name */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6">
          <Avatar
            src={avatarMap[targetUsername] || profile?.avatarUrl}
            name={targetUsername}
            size="xl"
            online={isOnline}
          />
          <h2 className="text-xl font-bold mt-4">
            {profile?.firstName && profile?.lastName
              ? `${profile.firstName} ${profile.lastName}`
              : targetUsername}
          </h2>
          <p className={cn(
            'text-sm mt-1',
            isOnline ? 'text-(--color-accent)' : 'text-(--color-text-secondary)'
          )}>
            {isOnline ? 'в сети' : profile?.lastSeen ? formatLastSeen(profile.lastSeen) : 'не в сети'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4 pb-6">
          <ActionCircle icon={<MessageSquare size={20} />} label="Написать" onClick={handleMessage} />
          <ActionCircle icon={<Phone size={20} />} label="Позвонить" onClick={() => {}} />
          <ActionCircle
            icon={isContact ? <UserMinus size={20} /> : <UserPlus size={20} />}
            label={isContact ? 'Удалить' : 'Добавить'}
            onClick={toggleContact}
          />
        </div>

        {/* Info section */}
        <div className="bg-(--color-bg-surface) mx-3 rounded-xl divide-y divide-(--color-separator)">
          {profile?.tag && (
            <InfoRow icon={<AtSign size={18} />} label="Тег" value={`@${profile.tag}`} />
          )}
          {profile?.bio && (
            <InfoRow icon={<Info size={18} />} label="О себе" value={profile.bio} />
          )}
          {profile?.phone && (
            <InfoRow icon={<Phone size={18} />} label="Телефон" value={profile.phone} />
          )}
          {profile?.birthday && (
            <InfoRow icon={<Calendar size={18} />} label="День рождения" value={profile.birthday} />
          )}
        </div>
      </div>
    </div>
  );
}

function ActionCircle({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 cursor-pointer group">
      <div className="w-12 h-12 rounded-full bg-(--color-accent)/10 flex items-center justify-center text-(--color-accent) group-hover:bg-(--color-accent)/20 transition-colors">
        {icon}
      </div>
      <span className="text-xs text-(--color-text-secondary)">{label}</span>
    </button>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-(--color-accent) mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm">{value}</p>
        <p className="text-xs text-(--color-text-tertiary) mt-0.5">{label}</p>
      </div>
    </div>
  );
}
