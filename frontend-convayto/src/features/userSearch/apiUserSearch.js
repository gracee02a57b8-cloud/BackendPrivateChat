import { apiFetch } from "../../services/apiHelper";

export async function searchPeople(query) {
  if (!query || query.length < 2) return [];

  const users = await apiFetch(`/api/chat/users?search=${encodeURIComponent(query)}`);

  if (!users || !Array.isArray(users)) return [];

  const myUsername = localStorage.getItem("username");

  // Transform backend UserDto → frontend user format, filter out self
  return users
    .filter((u) => u.username !== myUsername)
    .map((u) => ({
      id: u.username,
      fullname: u.username,
      username: u.username,
      avatar_url: u.avatarUrl || "",
      bio: "",
      tag: u.tag || "",
      online: u.online || false,
    }));
}

export async function searchGroups(query) {
  if (!query || query.length < 2) return [];

  const rooms = await apiFetch("/api/rooms");
  if (!rooms || !Array.isArray(rooms)) return [];

  const q = query.toLowerCase();

  return rooms
    .filter(
      (r) =>
        r.type === "ROOM" &&
        (r.name?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)),
    )
    .map((r) => ({
      id: r.id,
      name: r.name || "Группа",
      description: r.description || "",
      avatarUrl: r.avatarUrl || "",
      members: r.members || [],
      type: "group",
    }));
}
