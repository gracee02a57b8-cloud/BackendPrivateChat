// ==========================================
// InviteConferenceModal — invite participants via link or contacts
// ==========================================
import { useState, useMemo } from "react";
import { useConference, MAX_PARTICIPANTS } from "../contexts/ConferenceContext";
import { useContacts } from "../features/sideBar/useContacts";
import {
  RiCloseLine,
  RiLinkM,
  RiCheckLine,
  RiSearchLine,
  RiUserAddLine,
  RiFileCopyLine,
} from "react-icons/ri";
import toast from "react-hot-toast";

function InviteConferenceModal({ onClose }) {
  const {
    getInviteLink,
    inviteUser,
    participants,
  } = useConference();

  const { contacts = [], isPending } = useContacts();
  const [search, setSearch] = useState("");
  const [invitedSet, setInvitedSet] = useState(new Set());
  const [tab, setTab] = useState("contacts"); // "contacts" | "link"

  const myUsername = localStorage.getItem("username");
  const totalNow = participants.length + 1; // peers + me
  const slotsLeft = MAX_PARTICIPANTS - totalNow;

  // Filter contacts: exclude self, already in conference, match search
  const filteredContacts = useMemo(() => {
    const inConf = new Set(participants);
    inConf.add(myUsername);
    return contacts.filter((c) => {
      if (inConf.has(c.username)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.username?.toLowerCase().includes(q) ||
        c.fullname?.toLowerCase().includes(q)
      );
    });
  }, [contacts, participants, myUsername, search]);

  const handleCopyLink = () => {
    const link = getInviteLink();
    if (link) {
      navigator.clipboard.writeText(link).then(() => {
        toast.success("Ссылка скопирована!");
      });
    }
  };

  const handleInvite = (username) => {
    if (slotsLeft <= 0) {
      toast.error(`Максимум ${MAX_PARTICIPANTS} участников`);
      return;
    }
    inviteUser(username);
    setInvitedSet((prev) => new Set(prev).add(username));
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-gray-800 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold">Пригласить в конференцию</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
          >
            <RiCloseLine />
          </button>
        </div>

        {/* Participant count */}
        <div className="px-5 pt-3 text-sm text-gray-400">
          Участников: {totalNow} / {MAX_PARTICIPANTS}
          {slotsLeft <= 0 && (
            <span className="ml-2 text-red-400">— конференция заполнена</span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-5 pt-3">
          <button
            onClick={() => setTab("contacts")}
            className={`flex-1 pb-2 text-sm font-medium transition ${
              tab === "contacts"
                ? "border-b-2 border-blue-400 text-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <RiUserAddLine className="mr-1 inline" />
            Контакты
          </button>
          <button
            onClick={() => setTab("link")}
            className={`flex-1 pb-2 text-sm font-medium transition ${
              tab === "link"
                ? "border-b-2 border-blue-400 text-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <RiLinkM className="mr-1 inline" />
            Ссылка
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "contacts" && (
            <div className="flex flex-col">
              {/* Search */}
              <div className="sticky top-0 bg-gray-800 px-5 py-3">
                <div className="relative">
                  <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск контактов..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Contact list */}
              {isPending ? (
                <div className="px-5 py-6 text-center text-sm text-gray-400">
                  Загрузка контактов...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-gray-400">
                  {search ? "Никого не найдено" : "Все контакты уже в конференции"}
                </div>
              ) : (
                <div className="flex flex-col px-2 pb-3">
                  {filteredContacts.map((contact) => {
                    const alreadyInvited = invitedSet.has(contact.username);
                    return (
                      <div
                        key={contact.username}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/5"
                      >
                        {/* Avatar */}
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-600 text-sm font-bold uppercase">
                          {contact.avatar_url ? (
                            <img
                              src={contact.avatar_url}
                              alt=""
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            contact.username?.[0] || "?"
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium">{contact.fullname}</div>
                          <div className="truncate text-xs text-gray-400">@{contact.username}</div>
                        </div>

                        {/* Online indicator */}
                        {contact.online && (
                          <span className="h-2 w-2 rounded-full bg-green-400" title="Онлайн" />
                        )}

                        {/* Invite button */}
                        <button
                          onClick={() => handleInvite(contact.username)}
                          disabled={alreadyInvited || slotsLeft <= 0}
                          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                            alreadyInvited
                              ? "bg-green-600/30 text-green-400 cursor-default"
                              : slotsLeft <= 0
                                ? "bg-gray-600/30 text-gray-500 cursor-not-allowed"
                                : "bg-blue-500/80 text-white hover:bg-blue-600"
                          }`}
                        >
                          {alreadyInvited ? (
                            <>
                              <RiCheckLine /> Отправлено
                            </>
                          ) : (
                            <>
                              <RiUserAddLine /> Пригласить
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "link" && (
            <div className="flex flex-col items-center gap-4 px-5 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20">
                <RiLinkM className="text-3xl text-blue-400" />
              </div>
              <p className="text-center text-sm text-gray-300">
                Поделитесь ссылкой, чтобы пригласить участников.
                <br />
                <span className="text-xs text-gray-500">
                  Незарегистрированные пользователи смогут создать аккаунт и присоединиться.
                </span>
              </p>

              {/* Link display */}
              <div className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-center text-xs text-gray-300 break-all select-all">
                {getInviteLink() || "—"}
              </div>

              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 active:scale-95"
              >
                <RiFileCopyLine />
                Скопировать ссылку
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InviteConferenceModal;
