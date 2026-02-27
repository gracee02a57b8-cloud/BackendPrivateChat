import { useState, useEffect } from "react";
import UserList from "./UserList";
import GroupList from "./GroupList";
import ContactList from "./ContactList";
import { RiUserLine, RiGroupLine, RiContactsBookLine, RiBookmarkLine, RiFolderLine, RiAddLine, RiCloseLine } from "react-icons/ri";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../services/apiHelper";
import toast from "react-hot-toast";

const TABS = [
  { key: "private", label: "Личные", icon: RiUserLine },
  { key: "groups", label: "Группы", icon: RiGroupLine },
  { key: "contacts", label: "Контакты", icon: RiContactsBookLine },
];

function UsersView() {
  const [activeTab, setActiveTab] = useState("private");
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderName, setFolderName] = useState("");
  const navigate = useNavigate();

  // Load folders
  useEffect(() => {
    apiFetch("/api/folders").then((data) => {
      if (Array.isArray(data)) setFolders(data);
    }).catch(() => {});
  }, []);

  async function handleSavedMessages() {
    try {
      const room = await apiFetch("/api/rooms/saved", { method: "POST" });
      if (room?.id) navigate(`/chat/${room.id}`);
    } catch {
      toast.error("Ошибка");
    }
  }

  async function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) return;
    try {
      const f = await apiFetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emoji: "📁" }),
      });
      setFolders((prev) => [...prev, f]);
      setFolderName("");
      setShowFolderInput(false);
    } catch {
      toast.error("Ошибка создания папки");
    }
  }

  async function handleDeleteFolder(folderId) {
    try {
      await apiFetch(`/api/folders/${folderId}`, { method: "DELETE" });
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (activeFolder === folderId) setActiveFolder(null);
    } catch {
      toast.error("Ошибка удаления");
    }
  }

  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr]">
      {/* Main Tabs */}
      <div className="flex border-b border-t border-LightShade/20">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setActiveFolder(null); }}
              className={`flex flex-1 items-center justify-center gap-1 px-1.5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.key && !activeFolder
                  ? "border-b-2 border-bgAccent text-bgAccent dark:border-bgAccent-dark dark:text-bgAccent-dark"
                  : "text-textPrimary/60 hover:text-textPrimary dark:text-textPrimary-dark/60 dark:hover:text-textPrimary-dark"
              }`}
            >
              <Icon className="text-base" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Folder chips + Saved Messages */}
      <div className="flex flex-wrap items-center gap-1 border-b border-LightShade/10 px-2 py-1.5">
        <button
          onClick={handleSavedMessages}
          className="flex items-center gap-1 rounded-full bg-bgAccent/10 px-2.5 py-1 text-xs font-medium text-bgAccent transition hover:bg-bgAccent/20 dark:text-bgAccent-dark"
        >
          <RiBookmarkLine className="text-sm" /> Избранное
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => { setActiveFolder(f.id === activeFolder ? null : f.id); setActiveTab("private"); }}
            className={`group flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
              activeFolder === f.id
                ? "bg-bgAccent text-textPrimary-dark dark:bg-bgAccent-dark"
                : "bg-LightShade/10 hover:bg-LightShade/20"
            }`}
          >
            <span>{f.emoji || "📁"}</span> {f.name}
            <span
              onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }}
              className="ml-0.5 hidden cursor-pointer text-xs opacity-60 hover:opacity-100 group-hover:inline"
            >
              ×
            </span>
          </button>
        ))}
        {showFolderInput ? (
          <form onSubmit={(e) => { e.preventDefault(); handleCreateFolder(); }} className="flex items-center gap-1">
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Имя папки"
              autoFocus
              className="w-20 rounded bg-transparent px-1 text-xs outline-none ring-1 ring-LightShade/30"
            />
            <button type="submit" className="text-xs text-bgAccent dark:text-bgAccent-dark">✓</button>
            <button type="button" onClick={() => setShowFolderInput(false)} className="text-xs opacity-50">✕</button>
          </form>
        ) : (
          <button
            onClick={() => setShowFolderInput(true)}
            className="flex items-center gap-0.5 rounded-full bg-LightShade/10 px-2 py-1 text-xs opacity-60 transition hover:opacity-100"
          >
            <RiAddLine className="text-sm" />
          </button>
        )}
      </div>

      {/* Tab content */}
      <div tabIndex={-1} className="h-full overflow-auto p-2">
        {activeTab === "private" && <UserList filter="private" folderId={activeFolder} />}
        {activeTab === "groups" && <GroupList />}
        {activeTab === "contacts" && <ContactList />}
      </div>
    </div>
  );
}

export default UsersView;
