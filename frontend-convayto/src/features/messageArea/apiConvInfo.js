import { apiFetch } from "../../services/apiHelper";
import { getUserById } from "../authentication/apiAuth";

export async function getConvInfoById({ myUserId, friendUserId }) {
  if (!friendUserId) return null;

  // Get friend profile
  const friend = await getUserById(friendUserId);

  // Create or get private room for this friend.
  // The backend creates the room on demand (getOrCreate), so any error
  // here is a genuine failure (network/server). We let it propagate so
  // React Query retries and — on background refetch — preserves the
  // stale cache that already has the valid room ID.
  const room = await apiFetch(`/api/rooms/private/${encodeURIComponent(friendUserId)}`, {
    method: "POST",
  });

  return {
    id: room?.id || null, // Room ID (e.g. "pm_alice_bob") — null if not created yet
    user1_id: myUserId,
    user2_id: friendUserId,
    friendInfo: friend,
    created_at: room?.createdAt || null,
  };
}

// Получить информацию о групповой комнате
export async function getGroupConvInfo({ roomId }) {
  if (!roomId) return null;

  const room = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}`);
  if (!room) return null;

  return {
    id: room.id,
    isGroup: true,
    friendInfo: {
      id: room.id,
      fullname: room.name || "Группа",
      username: room.name || room.id,
      avatar_url: room.avatarUrl || "",
      bio: room.description || "",
    },
    members: room.members || [],
    createdBy: room.createdBy,
    created_at: room.createdAt,
    description: room.description,
  };
}
