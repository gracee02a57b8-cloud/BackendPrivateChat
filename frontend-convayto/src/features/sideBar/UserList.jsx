import ShortTextMessage from "../../components/ShortTextMessage";
import { useConversations } from "./useConversations";
import { useUi } from "../../contexts/UiContext";
import Loader from "../../components/Loader";
import UserItem from "../../components/UserItem";
import GroupItem from "./GroupItem";
import { useOnlineUsers } from "../../hooks/useOnlineUsers";
import { useState, useEffect } from "react";
import { apiFetch } from "../../services/apiHelper";
import { RiVolumeMuteLine } from "react-icons/ri";
import { getCounts, subscribe } from "../../utils/unreadStore";

function useUnreadCounts() {
  const [counts, setCounts] = useState(() => getCounts());
  useEffect(() => subscribe((c) => setCounts(c)), []);
  return counts;
}

function UserList({ filter = "all", folderId = null }) {
  const { conversations, isPending, error } = useConversations();
  const { closeSidebar } = useUi();
  const onlineUsers = useOnlineUsers();
  const unreadCounts = useUnreadCounts();
  const [folderRoomIds, setFolderRoomIds] = useState(null);

  // Load folder rooms when folderId changes
  useEffect(() => {
    if (!folderId) { setFolderRoomIds(null); return; }
    apiFetch(`/api/folders`).then((folders) => {
      if (Array.isArray(folders)) {
        const folder = folders.find((f) => f.id === folderId);
        setFolderRoomIds(folder?.roomIds || []);
      }
    }).catch(() => setFolderRoomIds([]));
  }, [folderId]);

  if (isPending)
    return (
      <ShortTextMessage opacity={100}>
        <Loader size="medium" text="Загрузка чатов" />
      </ShortTextMessage>
    );

  if (error) return <ShortTextMessage>⚠️ {error.message}</ShortTextMessage>;

  // Apply filter: "all" = everything, "private" = only 1-1 chats
  let filtered = conversations?.filter((conv) => {
    if (filter === "private") return !conv.isGroup;
    return true; // "all" — show everything
  });

  // Filter by folder if active
  if (folderId && folderRoomIds) {
    filtered = filtered?.filter((conv) => folderRoomIds.includes(conv.id));
  }

  if (!filtered?.length)
    return (
      <div className="empty-state mt-8 flex flex-col items-center gap-3 px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-LightShade/[0.05] text-3xl">
          💬
        </span>
        <p className="text-sm opacity-40">
          {filter === "private"
            ? "Нет личных переписок. Найди собеседника через поиск!"
            : "Нет чатов. Найди собеседника через поиск!"}
        </p>
      </div>
    );

  return filtered.map((conv) => {
    // Групповой чат
    if (conv?.isGroup) {
      return (
        <GroupItem
          key={conv.id}
          group={{
            id: conv.id,
            name: conv.friendInfo?.fullname || "Группа",
            description: conv.friendInfo?.bio || "",
            avatarUrl: conv.friendInfo?.avatar_url || "",
            members: conv.members || [],
          }}
          handler={closeSidebar}
        />
      );
    }

    // Приватный чат
    const id = conv?.friendInfo?.id;
    if (!id) return null;

    const avatar_url = conv?.friendInfo?.avatar_url;
    const fullname = conv?.friendInfo?.fullname;
    const lastMessage = conv?.last_message?.content;

    return (
      <UserItem
        key={id}
        id={id}
        avatar={avatar_url}
        name={fullname}
        subtext={lastMessage}
        handler={closeSidebar}
        roomId={conv?.id}
        online={onlineUsers.has(conv?.friendInfo?.username || id)}
        muted={!!conv?.muted}
        unreadCount={unreadCounts[conv?.id] || 0}
      />
    );
  });
}

export default UserList;
