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
