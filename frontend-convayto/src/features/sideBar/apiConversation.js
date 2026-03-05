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
  return deriveConversations(rooms, myUserId);
}

/**
 * Perf F4: pure synchronous transform — can be used with React Query `select`
 * to share the ["rooms"] cache between useConversations and useGroups.
 */
export function deriveConversations(rooms, myUserId) {
  // Включаем PRIVATE и ROOM (групповые) комнаты
  const chatRooms = (rooms || []).filter(
    (room) => room.type === "PRIVATE" || room.type === "ROOM",
  );

  const conversations = chatRooms.map((room) => {
      const isGroup = room.type === "ROOM";
      const friendUsername = isGroup
        ? null
        : room.members?.find((m) => m !== myUserId) || "";

      // Perf F1: use lastMessage embedded in /api/rooms response (no N+1 API calls)
      let lastMsg = null;
      if (room.lastMessage) {
        lastMsg = {
          content: room.lastMessage.content || "",
          created_at: room.lastMessage.created_at || room.createdAt,
          sender_id: room.lastMessage.sender_id || "",
        };
      }

      if (isGroup) {
        return {
          id: room.id,
          isGroup: true,
          last_message: lastMsg,
          created_at: room.createdAt,
          muted: !!room.muted,
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
        muted: !!room.muted,
        friendInfo: {
          id: friendUsername,
          fullname: friendUsername,
          username: friendUsername,
          avatar_url: room.avatarUrl || "",
          bio: "",
        },
      };
  });

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
