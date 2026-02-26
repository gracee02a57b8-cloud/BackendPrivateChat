// ═══════════════════════════════════════════════
//  My Profile Page — own profile view + edit
// ═══════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import {
  getProfile, updateProfile, uploadAvatar, deleteAvatar,
} from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import {
  ArrowLeft, Camera, Trash2, Pencil, Check, X,
  AtSign, Phone, Calendar, Info, User,
} from 'lucide-react';

interface MyProfilePageProps {
  onClose: () => void;
}

export default function MyProfilePage({ onClose }: MyProfilePageProps) {
  const { token, username, avatarUrl, setAvatarUrl, updateAvatarMap } = useStore();
  const [profile, setProfile] = useState<any>({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', bio: '', phone: '', birthday: '', tag: '' });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    getProfile(token).then((p) => {
      setProfile(p);
      setForm({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        bio: p.bio || '',
        phone: p.phone || '',
        birthday: p.birthday || '',
        tag: p.tag || '',
      });
    }).catch(console.error);
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await updateProfile(token, form);
      setProfile({ ...profile, ...form });
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setAvatarUploading(true);
    try {
      const data = await uploadAvatar(token, file);
      setAvatarUrl(data.url || data.avatarUrl);
      if (username) updateAvatarMap(username, data.url || data.avatarUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!token) return;
    try {
      await deleteAvatar(token);
      setAvatarUrl(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary)">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 bg-(--color-bg-surface) border-b border-(--color-separator) shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-base font-semibold flex-1">Профиль</h2>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="p-2 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
              <X size={20} />
            </button>
            <button onClick={handleSave} disabled={saving} className="p-2 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-accent)">
              <Check size={20} />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="p-2 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-text-secondary)">
            <Pencil size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar section */}
        <div className="flex flex-col items-center pt-8 pb-6">
          <div className="relative">
            <Avatar src={avatarUrl} name={username || '?'} size="xl" />
            <div className="absolute -bottom-1 -right-1 flex gap-1">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-8 h-8 rounded-full bg-(--color-accent) text-white flex items-center justify-center cursor-pointer hover:opacity-90 shadow-md"
              >
                {avatarUploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
              {avatarUrl && (
                <button
                  onClick={handleDeleteAvatar}
                  className="w-8 h-8 rounded-full bg-(--color-danger) text-white flex items-center justify-center cursor-pointer hover:opacity-90 shadow-md"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <h2 className="text-xl font-bold mt-4">{username}</h2>
          <p className="text-sm text-(--color-text-secondary) mt-1">в сети</p>
        </div>

        {/* Fields */}
        <div className="bg-(--color-bg-surface) mx-3 rounded-xl divide-y divide-(--color-separator)">
          <ProfileField
            icon={<User size={18} />}
            label="Имя"
            value={form.firstName}
            editing={editing}
            onChange={(v) => setForm({ ...form, firstName: v })}
          />
          <ProfileField
            icon={<User size={18} />}
            label="Фамилия"
            value={form.lastName}
            editing={editing}
            onChange={(v) => setForm({ ...form, lastName: v })}
          />
          <ProfileField
            icon={<AtSign size={18} />}
            label="Тег"
            value={form.tag}
            editing={editing}
            onChange={(v) => setForm({ ...form, tag: v })}
          />
          <ProfileField
            icon={<Info size={18} />}
            label="О себе"
            value={form.bio}
            editing={editing}
            onChange={(v) => setForm({ ...form, bio: v })}
          />
          <ProfileField
            icon={<Phone size={18} />}
            label="Телефон"
            value={form.phone}
            editing={editing}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          <ProfileField
            icon={<Calendar size={18} />}
            label="День рождения"
            value={form.birthday}
            editing={editing}
            onChange={(v) => setForm({ ...form, birthday: v })}
            type="date"
          />
        </div>
      </div>
    </div>
  );
}

function ProfileField({
  icon, label, value, editing, onChange, type = 'text',
}: {
  icon: React.ReactNode; label: string; value: string; editing: boolean;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-(--color-accent) mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={label}
            className="w-full text-sm bg-transparent outline-none border-b border-(--color-border) pb-1 focus:border-(--color-accent)"
          />
        ) : (
          <p className="text-sm">{value || '—'}</p>
        )}
        <p className="text-xs text-(--color-text-tertiary) mt-0.5">{label}</p>
      </div>
    </div>
  );
}
