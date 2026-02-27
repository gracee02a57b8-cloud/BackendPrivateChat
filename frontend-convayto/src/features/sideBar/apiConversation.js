import { apiFetch } from "../../services/apiHelper";

export async function getConversationEntries() {
  // Fetch all rooms the user belongs to
  const rooms = await apiFetch("/api/rooms");
  return rooms || [];
}

//////////////
/////////////

export async function getConversations({ myUserId }) {
  const rooms = await getConversationEntries();

  // Filter to PRIVATE rooms and build conversation objects
  const privateRooms = rooms.filter((room) => room.type === "PRIVATE");

  // Fetch last message for each room in parallel (1 message per room)
  const conversations = await Promise.all(
    privateRooms.map(async (room) => {
      const friendUsername = room.members?.find((m) => m !== myUserId) || "";

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

  // Sort by last message time (newest first)
  conversations.sort((a, b) => {
    const timeA = a.last_message?.created_at || a.created_at || "";
    const timeB = b.last_message?.created_at || b.created_at || "";
    return timeB.localeCompare(timeA);
  });

  return conversations;
}
