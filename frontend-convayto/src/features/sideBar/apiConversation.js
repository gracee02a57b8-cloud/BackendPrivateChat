import { apiFetch } from "../../services/apiHelper";
import { getPinnedChats } from "../../utils/pinnedChats";

export async function getConversationEntries() {
  // Fetch all rooms the user belongs to
  const rooms = await apiFetch("/api/rooms");
  return rooms || [];
}

//////////////
/////////////

export async function getConversations({ myUserId }) {
  const rooms = await getConversationEntries();

  // Включаем PRIVATE и ROOM (групповые) комнаты
  const chatRooms = rooms.filter(
    (room) => room.type === "PRIVATE" || room.type === "ROOM",
  );

  // Fetch last message for each room in parallel (1 message per room)
  const conversations = await Promise.all(
    chatRooms.map(async (room) => {
      const isGroup = room.type === "ROOM";
      const friendUsername = isGroup
        ? null
        : room.members?.find((m) => m !== myUserId) || "";

      // Get last message from room history (page 0, size 1)
      let lastMsg = null;
      try {
        const history = await apiFetch(
          `/api/rooms/${encodeURIComponent(room.id)}/history?page=0&size=1`,
        );
        if (history && history.length > 0) {
          lastMsg = {
            content: history[0].content || "",
            created_at: history[0].timestamp || room.createdAt,
            sender_id: history[0].sender || "",
          };
        }
      } catch {
        // No messages yet
      }

      if (isGroup) {
        return {
          id: room.id,
          isGroup: true,
          last_message: lastMsg,
          created_at: room.createdAt,
          friendInfo: {
            id: room.id,
            fullname: room.name || "Группа",
            username: room.name || room.id,
            avatar_url: room.avatarUrl || "",
            bio: room.description || "",
          },
          members: room.members,
        };
      }

      return {
        id: room.id,
        user1_id: myUserId,
        user2_id: friendUsername,
        last_message: lastMsg,
        created_at: room.createdAt,
        friendInfo: {
          id: friendUsername,
          fullname: friendUsername,
          username: friendUsername,
          avatar_url: room.avatarUrl || "",
          bio: "",
        },
      };
    }),
  );

  // Sort: pinned chats first, then by last message time
  const pinned = getPinnedChats();
  conversations.sort((a, b) => {
    const aPinned = pinned.includes(a.id);
    const bPinned = pinned.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    const timeA = a.last_message?.created_at || a.created_at || "";
    const timeB = b.last_message?.created_at || b.created_at || "";
    return timeB.localeCompare(timeA);
  });

  return conversations;
}
