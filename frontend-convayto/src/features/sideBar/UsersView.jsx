import { useState, useEffect, useRef } from "react";
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
  const tabsRef = useRef([]);
  const indicatorRef = useRef(null);

  // Load folders
  useEffect(() => {
    apiFetch("/api/folders").then((data) => {
      if (Array.isArray(data)) setFolders(data);
    }).catch(() => {});
  }, []);

  // Animate tab pill indicator
  useEffect(() => {
    const idx = TABS.findIndex((t) => t.key === activeTab);
    const el = tabsRef.current[idx];
    const indicator = indicatorRef.current;
    if (el && indicator) {
      const { offsetLeft, offsetWidth } = el;
      indicator.style.transform = `translateX(${offsetLeft}px)`;
      indicator.style.width = `${offsetWidth}px`;
    }
  }, [activeTab]);

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
    <div className="flex h-full flex-col">
      {/* ── Premium Pill Tabs ── */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative flex rounded-xl bg-LightShade/[0.06] p-1">
          {/* Animated pill background */}
          <div
            ref={indicatorRef}
            className="tab-pill-bg absolute top-1 bottom-1 left-0 rounded-lg bg-gradient-to-r from-bgAccent to-bgAccent/80 dark:from-bgAccent-dark dark:to-bgAccent-dark/80"
            style={{ width: 0 }}
          />
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key && !activeFolder;
            return (
              <button
                key={tab.key}
                ref={(el) => (tabsRef.current[i] = el)}
                onClick={() => { setActiveTab(tab.key); setActiveFolder(null); }}
                className={`tab-pill flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors duration-250 ${
                  isActive
                    ? "tab-pill-active"
                    : "text-textPrimary/50 hover:text-textPrimary/80 dark:text-textPrimary-dark/50 dark:hover:text-textPrimary-dark/80"
                }`}
              >
                <Icon className="text-[15px]" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Premium Folder Strip ── */}
      <div className="folder-scroll flex items-center gap-1.5 overflow-x-auto px-3 py-2">
        {/* Saved messages */}
        <button
          onClick={handleSavedMessages}
          className="folder-chip flex flex-shrink-0 items-center gap-1.5 rounded-full border border-bgAccent/20 bg-bgAccent/[0.07] px-3 py-1.5 text-xs font-medium text-bgAccent transition-all hover:border-bgAccent/30 hover:bg-bgAccent/[0.12] dark:text-bgAccent-dark dark:border-bgAccent-dark/20 dark:bg-bgAccent-dark/[0.07] dark:hover:bg-bgAccent-dark/[0.12]"
        >
          <RiBookmarkLine className="text-sm" /> Избранное
        </button>

        {/* Folder chips */}
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => { setActiveFolder(f.id === activeFolder ? null : f.id); setActiveTab("private"); }}
            className={`folder-chip group flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              activeFolder === f.id
                ? "border-bgAccent/40 bg-bgAccent text-white shadow-lg shadow-bgAccent/20 dark:border-bgAccent-dark/40 dark:bg-bgAccent-dark dark:shadow-bgAccent-dark/20"
                : "border-LightShade/[0.08] bg-LightShade/[0.04] hover:border-LightShade/[0.15] hover:bg-LightShade/[0.08]"
            }`}
          >
            <span className="text-sm">{f.emoji || "📁"}</span>
            <span>{f.name}</span>
            <span
              onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }}
              className="ml-0.5 hidden cursor-pointer rounded-full p-0.5 text-[10px] opacity-50 transition-all hover:bg-white/20 hover:opacity-100 group-hover:inline-flex"
            >
              <RiCloseLine />
            </span>
          </button>
        ))}

        {/* Add folder */}
        {showFolderInput ? (
          <form onSubmit={(e) => { e.preventDefault(); handleCreateFolder(); }} className="flex flex-shrink-0 items-center gap-1.5">
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Имя папки"
              autoFocus
              className="w-24 rounded-full border border-LightShade/[0.12] bg-transparent px-3 py-1 text-xs outline-none transition-all focus:border-bgAccent/40 focus:ring-1 focus:ring-bgAccent/20"
            />
            <button type="submit" className="flex h-6 w-6 items-center justify-center rounded-full bg-bgAccent/20 text-xs text-bgAccent transition hover:bg-bgAccent/30 dark:text-bgAccent-dark">✓</button>
            <button type="button" onClick={() => setShowFolderInput(false)} className="flex h-6 w-6 items-center justify-center rounded-full bg-LightShade/10 text-xs opacity-60 transition hover:opacity-100">✕</button>
          </form>
        ) : (
          <button
            onClick={() => setShowFolderInput(true)}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-LightShade/[0.12] text-sm opacity-40 transition-all hover:border-bgAccent/30 hover:text-bgAccent hover:opacity-80 dark:hover:text-bgAccent-dark"
          >
            <RiAddLine />
          </button>
        )}
      </div>

      {/* ── Tab Content ── */}
      <div tabIndex={-1} className="premium-scroll flex-1 overflow-auto px-2 pb-2">
        {activeTab === "private" && <UserList filter="private" folderId={activeFolder} />}
        {activeTab === "groups" && <GroupList />}
        {activeTab === "contacts" && <ContactList />}
      </div>
    </div>
  );
}

export default UsersView;
