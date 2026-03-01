import { useUi } from "../../contexts/UiContext";
import { HiOutlineUserCircle } from "react-icons/hi2";
import ToggleableContent from "../../components/ToggleableContent";
import IconButton from "../../components/IconButton";
import { useState, useEffect } from "react";
import { apiFetch } from "../../services/apiHelper";
import { addContact, removeContact, fetchUserProfile } from "../../services/apiContacts";
import useConvInfo from "../messageArea/useConvInfo";
import { useUserProfileModal } from "../../contexts/UserProfileModalContext";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { getRandomAvatar } from "../../utils/avatarUtils";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { RiVolumeMuteLine, RiVolumeUpLine, RiTimerLine, RiUserAddLine, RiUserUnfollowLine, RiGroupLine } from "react-icons/ri";

const DISAPPEAR_OPTIONS = [
  { label: "Выкл", value: 0 },
  { label: "30 сек", value: 30 },
  { label: "5 мин", value: 300 },
  { label: "1 час", value: 3600 },
  { label: "24 часа", value: 86400 },
  { label: "7 дней", value: 604800 },
];

function ProfileSideBar({ friend }) {
  const { avatar_url, fullname, username, bio } = friend ?? {};
  const { closeFriendSidebar, isFriendsSidebarOpen } = useUi();
  const { convInfo } = useConvInfo();
  const { openUserProfile } = useUserProfileModal();
  const onlineUsers = useOnlineUsers();
  const queryClient = useQueryClient();
  const roomId = convInfo?.id;
  const isGroup = convInfo?.isGroup;
  const members = convInfo?.members || [];

  const [muted, setMuted] = useState(false);
  const [disappearing, setDisappearing] = useState(0);

  // Contact state for private chats
  const [isContact, setIsContact] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  // Fetch mute & disappearing status
  useEffect(() => {
    if (!roomId || !isFriendsSidebarOpen) return;
    apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/mute`)
      .then((d) => setMuted(!!d?.muted))
      .catch(() => {});
    if (convInfo?.disappearingSeconds !== undefined) {
      setDisappearing(convInfo.disappearingSeconds);
    }
  }, [roomId, isFriendsSidebarOpen, convInfo?.disappearingSeconds]);

  // Fetch isContact for private chats
  useEffect(() => {
    if (!username || !isFriendsSidebarOpen || isGroup) return;
    fetchUserProfile(username)
      .then((p) => setIsContact(!!p?.isContact))
      .catch(() => {});
  }, [username, isFriendsSidebarOpen, isGroup]);

  async function handleToggleContact() {
    if (contactLoading || !username) return;
    setContactLoading(true);
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
      toast.error("Ошибка");
    } finally {
      setContactLoading(false);
    }
  }

  async function toggleMute() {
    if (!roomId) return;
    try {
      if (muted) {
        await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/mute`, { method: "DELETE" });
        setMuted(false);
        toast.success("Уведомления включены");
      } else {
        await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/mute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        setMuted(true);
        toast.success("Чат замьючен");
      }
    } catch {
      toast.error("Ошибка");
    }
  }

  async function handleDisappearing(seconds) {
    if (!roomId) return;
    try {
      await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/disappearing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
      });
      setDisappearing(seconds);
      toast.success(seconds === 0 ? "Исчезающие выключены" : "Таймер установлен");
    } catch {
      toast.error("Ошибка");
    }
  }

  function handleCloseBar() {
    isFriendsSidebarOpen && closeFriendSidebar();
  }

  return (
    <ToggleableContent isOpen={isFriendsSidebarOpen} toggle={handleCloseBar}>
      <div
        className={`${
          isFriendsSidebarOpen
            ? "visible right-0 opacity-100"
            : "invisible -right-full opacity-0"
        } absolute top-0 z-30 grid h-screen-safe w-4/5 grid-rows-[auto_1fr] overflow-hidden bg-bgPrimary opacity-0 shadow-[-10px_0px_15px_-3px_rgba(0,0,0,0.1),-10px_0px_6px_-2px_rgba(0,0,0,0.05)] transition-all duration-500 ease-[cubic-bezier(.15,.72,.08,.99)] dark:bg-bgPrimary-dark sm:w-[21rem]`}
      >
        <div className="flex h-16 items-center justify-start gap-4 bg-LightShade/10 p-2">
          <IconButton onClick={handleCloseBar}>
            <IconButton.Close />
          </IconButton>
          <p className="select-none font-bold tracking-wider">Profile</p>
        </div>

        <div className="h-full overflow-scroll p-10">
          <div className="mx-auto mt-4 h-52 w-52 overflow-hidden rounded-full border-2 border-bgAccent dark:border-bgAccent-dark">
            {avatar_url ? (
              <img
                className="pointer-events-none h-full w-full object-cover object-center"
                src={avatar_url}
                alt={fullname}
              />
            ) : (
              <HiOutlineUserCircle
                className="h-full w-full opacity-50"
                strokeWidth="1"
              />
            )}
          </div>

          <div className="mt-8">
            <p className="select-none  text-sm font-bold tracking-wider text-textAccent opacity-80 dark:text-textAccent-dark">
              Name
            </p>
            <p className="truncate text-base">{fullname}</p>
          </div>

          <div className="mt-4">
            <p className="select-none text-sm font-bold tracking-wider text-textAccent  opacity-80 dark:text-textAccent-dark">
              Username
            </p>
            <p className="truncate text-base">{username}</p>
          </div>

          {bio && (
            <div className="mt-4">
              <p className="select-none text-sm font-bold tracking-wider text-textAccent  opacity-80 dark:text-textAccent-dark">
                Bio
              </p>
              <p className="break-all text-base">{bio}</p>
            </div>
          )}

          {/* Add / Remove contact — private chat only */}
          {!isGroup && username && (
            <button
              onClick={handleToggleContact}
              disabled={contactLoading}
              data-testid="toggle-contact-btn"
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 ${
                isContact
                  ? "bg-red-500/10 text-red-500 dark:bg-red-500/20"
                  : "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400"
              }`}
            >
              {isContact ? (
                <>
                  <RiUserUnfollowLine className="text-base" />
                  Удалить из контактов
                </>
              ) : (
                <>
                  <RiUserAddLine className="text-base" />
                  Добавить в контакты
                </>
              )}
            </button>
          )}

          {/* Group members list */}
          {isGroup && members.length > 0 && (
            <div className="mt-6 border-t border-LightShade/20 pt-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <RiGroupLine className="text-lg" />
                <span>Участники ({members.length})</span>
              </div>
              <div className="space-y-1">
                {members.map((memberUsername) => (
                  <button
                    key={memberUsername}
                    onClick={() => openUserProfile(memberUsername)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-LightShade/10"
                  >
                    <div className="relative h-9 w-9 flex-shrink-0">
                      <img
                        src={getRandomAvatar(memberUsername)}
                        alt={memberUsername}
                        className="h-full w-full rounded-full object-cover"
                      />
                      {onlineUsers.has(memberUsername) && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bgPrimary bg-green-500 dark:border-bgPrimary-dark" />
                      )}
                    </div>
                    <span className="truncate">{memberUsername}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mute toggle */}
          {roomId && (
            <div className="mt-6 space-y-3 border-t border-LightShade/20 pt-4">
              <button
                onClick={toggleMute}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-LightShade/10"
              >
                {muted ? (
                  <RiVolumeMuteLine className="text-lg text-red-400" />
                ) : (
                  <RiVolumeUpLine className="text-lg" />
                )}
                <span>{muted ? "Включить уведомления" : "Замьютить чат"}</span>
              </button>

              {/* Disappearing messages */}
              <div className="rounded-xl bg-LightShade/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <RiTimerLine className="text-lg" />
                  Исчезающие сообщения
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DISAPPEAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleDisappearing(opt.value)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        disappearing === opt.value
                          ? "bg-bgAccent text-textPrimary-dark dark:bg-bgAccent-dark"
                          : "bg-LightShade/15 hover:bg-LightShade/25"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ToggleableContent>
  );
}

export default ProfileSideBar;
