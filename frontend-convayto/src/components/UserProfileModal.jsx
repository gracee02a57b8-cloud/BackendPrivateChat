// ==========================================
// UserProfileModal — view user profile + add/remove contact
// ==========================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { HiOutlineUserCircle } from "react-icons/hi2";
import {
  RiCloseLine,
  RiUserAddLine,
  RiUserUnfollowLine,
  RiChat1Line,
  RiPhoneLine,
  RiShieldCheckLine,
} from "react-icons/ri";
import { getRandomAvatar } from "../utils/avatarUtils";
import { fetchUserProfile, addContact, removeContact } from "../services/apiContacts";
import { useOnlineUsers } from "../hooks/useOnlineUsers";
import toast from "react-hot-toast";
import Loader from "./Loader";

function UserProfileModal({ username, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isContact, setIsContact] = useState(false);
  const [toggling, setToggling] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const onlineUsers = useOnlineUsers();
  const isOnline = onlineUsers.has(username);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUserProfile(username)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setIsContact(!!data.isContact);
      })
      .catch(() => {
        if (!cancelled) toast.error("Не удалось загрузить профиль");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [username]);

  async function handleToggleContact() {
    if (toggling) return;
    setToggling(true);
    try {
      if (isContact) {
        await removeContact(username);
        setIsContact(false);
        toast.success("Удалён из контактов");
      } else {
        await addContact(username);
        setIsContact(true);
        toast.success("Добавлен в контакты");
      }
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch {
      toast.error("Ошибка при обновлении контактов");
    } finally {
      setToggling(false);
    }
  }

  function handleSendMessage() {
    navigate(`/chat/${username}`);
    onClose();
  }

  const fullname =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile?.firstName || profile?.username || username;

  const avatarSrc = profile?.avatarUrl || getRandomAvatar(fullname);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9000] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-[9001] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-bgPrimary shadow-2xl dark:bg-bgPrimary-dark">
        {/* Header */}
        <div className="relative h-32 bg-gradient-to-br from-bgAccent to-bgAccentDim dark:from-bgAccent-dark dark:to-bgAccentDim-dark">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/40"
          >
            <RiCloseLine className="text-xl" />
          </button>

          {/* Avatar overlapping header */}
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-bgPrimary dark:border-bgPrimary-dark">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={fullname}
                  className="h-full w-full object-cover"
                />
              ) : (
                <HiOutlineUserCircle className="h-full w-full opacity-50" strokeWidth="1" />
              )}
            </div>
            {isOnline && (
              <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-bgPrimary bg-green-500 dark:border-bgPrimary-dark" />
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-16">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader size="medium" text="Загрузка профиля..." />
            </div>
          ) : profile ? (
            <>
              {/* Name + tag */}
              <div className="text-center">
                <h2 className="text-xl font-bold">{fullname}</h2>
                <p className="text-sm opacity-60">@{profile.username}</p>
                {profile.tag && (
                  <span className="mt-1 inline-block rounded-full bg-bgAccent/10 px-3 py-0.5 text-xs font-medium text-bgAccent dark:bg-bgAccent-dark/10 dark:text-bgAccent-dark">
                    {profile.tag}
                  </span>
                )}
                {isOnline ? (
                  <p className="mt-1 text-xs font-medium text-green-500">в сети</p>
                ) : profile.lastSeen ? (
                  <p className="mt-1 text-xs opacity-40">
                    Был(а) {profile.lastSeen}
                  </p>
                ) : null}
              </div>

              {/* Bio */}
              {profile.bio && (
                <div className="mt-4 rounded-xl bg-LightShade/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-40">
                    О себе
                  </p>
                  <p className="mt-1 break-words text-sm">{profile.bio}</p>
                </div>
              )}

              {/* Info fields */}
              <div className="mt-3 space-y-2">
                {profile.phone && (
                  <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
                    <RiPhoneLine className="flex-shrink-0 text-lg opacity-50" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile.birthday && (
                  <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
                    <RiShieldCheckLine className="flex-shrink-0 text-lg opacity-50" />
                    <span>День рождения: {profile.birthday}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={handleSendMessage}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-bgAccent py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] dark:bg-bgAccent-dark"
                >
                  <RiChat1Line className="text-base" />
                  Написать
                </button>

                <button
                  onClick={handleToggleContact}
                  disabled={toggling}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 ${
                    isContact
                      ? "bg-red-500/10 text-red-500 dark:bg-red-500/20"
                      : "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                  }`}
                >
                  {isContact ? (
                    <>
                      <RiUserUnfollowLine className="text-base" />
                      Удалить
                    </>
                  ) : (
                    <>
                      <RiUserAddLine className="text-base" />
                      В контакты
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <p className="py-8 text-center opacity-50">Профиль не найден</p>
          )}
        </div>
      </div>
    </>
  );
}

export default UserProfileModal;
