import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { RiCloseLine, RiSearchLine, RiUserAddLine, RiCheckLine, RiGroupLine, RiMessage3Line, RiContactsBookLine } from "react-icons/ri";
import { useContacts } from "../features/sideBar/useContacts";
import { addContact } from "../services/apiContacts";
import { apiFetch } from "../services/apiHelper";
import { useOnlineUsers } from "../hooks/useOnlineUsers";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Loader from "./Loader";
import CreateGroupModal from "./CreateGroupModal";

function ContactsModal({ isOpen, onClose }) {
  const [view, setView] = useState("main"); // "main" | "add" | "list"
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingUser, setAddingUser] = useState(null);
  const { contacts, isPending: contactsLoading } = useContacts();
  const onlineUsers = useOnlineUsers();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleClose = useCallback(() => {
    setView("main");
    setSearchQuery("");
    setSearchResults([]);
    onClose();
  }, [onClose]);

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await apiFetch(`/api/chat/users?search=${encodeURIComponent(query.trim())}`);
      const myUsername = localStorage.getItem("username");
      setSearchResults((results || []).filter((u) => u.username !== myUsername));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleAddContact = useCallback(async (username) => {
    setAddingUser(username);
    try {
      await addContact(username);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`${username} добавлен в контакты`);
    } catch (err) {
      toast.error(err.message || "Ошибка добавления");
    } finally {
      setAddingUser(null);
    }
  }, [queryClient]);

  const handleWriteMessage = useCallback((username) => {
    navigate(`/chat/${username}`);
    handleClose();
  }, [navigate, handleClose]);

  const handleCreateGroup = useCallback(() => {
    handleClose();
    setShowCreateGroup(true);
  }, [handleClose]);

  if (!isOpen && !showCreateGroup) return null;

  const isContact = (username) => contacts?.some((c) => c.username === username || c.id === username);

  return (
    <>
      {isOpen && createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-bgPrimary shadow-2xl dark:bg-bgPrimary-dark" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-LightShade/10 px-5 py-4">
          <h2 className="text-lg font-semibold">
            {view === "main" && "Контакты"}
            {view === "add" && "Добавить контакт"}
            {view === "list" && "Мои контакты"}
          </h2>
          <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-LightShade/20">
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        {/* Main view — action buttons */}
        {view === "main" && (
          <div className="space-y-1 p-3">
            <button onClick={() => setView("add")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-LightShade/10">
              <RiUserAddLine className="text-xl text-bgAccent dark:text-bgAccent-dark" />
              <div>
                <p className="text-sm font-medium">Добавить контакт</p>
                <p className="text-xs opacity-50">Поиск по имени или тегу</p>
              </div>
            </button>
            <button onClick={handleCreateGroup} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-LightShade/10">
              <RiGroupLine className="text-xl text-bgAccent dark:text-bgAccent-dark" />
              <div>
                <p className="text-sm font-medium">Создать группу</p>
                <p className="text-xs opacity-50">Новый групповой чат</p>
              </div>
            </button>
            <button onClick={() => setView("list")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-LightShade/10">
              <RiContactsBookLine className="text-xl text-bgAccent dark:text-bgAccent-dark" />
              <div>
                <p className="text-sm font-medium">Мои контакты</p>
                <p className="text-xs opacity-50">{contacts?.length || 0} контактов</p>
              </div>
            </button>
          </div>
        )}

        {/* Add contact view — search */}
        {view === "add" && (
          <div className="p-3">
            <div className="relative mb-3">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-lg opacity-40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Имя или @тег..."
                autoFocus
                className="w-full rounded-xl border border-LightShade/10 bg-LightShade/[0.04] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-bgAccent/40 focus:ring-1 focus:ring-bgAccent/20"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {searching && <div className="flex justify-center py-4"><Loader size="small" /></div>}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="py-4 text-center text-sm opacity-50">Никого не найдено</p>
              )}
              {searchResults.map((user) => (
                <div key={user.username} className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-LightShade/[0.06]">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-bgAccent/20 text-sm font-bold uppercase">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      user.username?.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.firstName || user.username}</p>
                    <p className="truncate text-xs opacity-50">@{user.tag || user.username}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleWriteMessage(user.username)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-bgAccent transition hover:bg-bgAccent/10 dark:text-bgAccent-dark"
                      title="Написать"
                    >
                      <RiMessage3Line className="text-lg" />
                    </button>
                    {isContact(user.username) ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-green-500">
                        <RiCheckLine className="text-lg" />
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddContact(user.username)}
                        disabled={addingUser === user.username}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-bgAccent transition hover:bg-bgAccent/10 disabled:opacity-50 dark:text-bgAccent-dark"
                        title="Добавить в контакты"
                      >
                        {addingUser === user.username ? <Loader size="small" /> : <RiUserAddLine className="text-lg" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setView("main")} className="mt-2 w-full rounded-xl py-2 text-center text-sm font-medium text-bgAccent transition hover:bg-bgAccent/10 dark:text-bgAccent-dark">
              ← Назад
            </button>
          </div>
        )}

        {/* Contact list view */}
        {view === "list" && (
          <div className="p-3">
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {contactsLoading && <div className="flex justify-center py-4"><Loader size="small" /></div>}
              {!contactsLoading && (!contacts || contacts.length === 0) && (
                <div className="flex flex-col items-center gap-2 py-6">
                  <span className="text-3xl">📇</span>
                  <p className="text-sm opacity-50">Нет контактов</p>
                </div>
              )}
              {contacts?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleWriteMessage(c.username || c.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-LightShade/[0.06]"
                >
                  <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-bgAccent/20 text-sm font-bold uppercase">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      (c.fullname || c.username)?.charAt(0)
                    )}
                    {onlineUsers.has(c.username || c.id) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bgPrimary bg-green-500 dark:border-bgPrimary-dark" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.fullname}</p>
                    <p className="truncate text-xs opacity-50">
                      {onlineUsers.has(c.username || c.id) ? "в сети" : c.tag || `@${c.username}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setView("main")} className="mt-2 w-full rounded-xl py-2 text-center text-sm font-medium text-bgAccent transition hover:bg-bgAccent/10 dark:text-bgAccent-dark">
              ← Назад
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
      )}

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />
    </>
  );
}

export default ContactsModal;
