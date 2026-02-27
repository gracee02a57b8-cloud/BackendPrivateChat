import { apiFetch } from "../../services/apiHelper";
import { getUserById } from "../authentication/apiAuth";

export async function getConvInfoById({ myUserId, friendUserId }) {
  if (!friendUserId) return null;

  // Get friend profile
  const friend = await getUserById(friendUserId);

  // Create or get private room for this friend
  let room = null;
  try {
    room = await apiFetch(`/api/rooms/private/${encodeURIComponent(friendUserId)}`, {
      method: "POST",
    });
  } catch {
    // Room may not exist yet — that's okay
  }

  return {
    id: room?.id || null, // Room ID (e.g. "pm_alice_bob") — null if not created yet
    user1_id: myUserId,
    user2_id: friendUserId,
    friendInfo: friend,
    created_at: room?.createdAt || null,
  };
}
