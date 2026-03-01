import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../services/apiHelper";

/**
 * Fetch contacts = users from private conversations.
 * Combines /api/chat/contacts (all users with profile info) and /api/rooms
 * to filter only those the current user has a private chat with.
 */
export async function getContacts() {
  const myUsername = localStorage.getItem("username");

  // Fetch all users (for profile info) and rooms (for private conversations) in parallel
  const [allUsers, rooms] = await Promise.all([
    apiFetch("/api/chat/contacts").catch(() => []),
    apiFetch("/api/rooms").catch(() => []),
  ]);

  // Get usernames from private rooms — these are the user's contacts
  const contactUsernames = new Set();
  if (Array.isArray(rooms)) {
    rooms
      .filter((r) => r.type === "PRIVATE")
      .forEach((r) => {
        const other = r.members?.find((m) => m !== myUsername);
        if (other) contactUsernames.add(other);
      });
  }

  if (!Array.isArray(allUsers) || contactUsernames.size === 0) return [];

  return allUsers
    .filter((c) => contactUsernames.has(c.contact))
    .map((c) => ({
      id: c.contact,
      fullname:
        c.firstName && c.lastName
          ? `${c.firstName} ${c.lastName}`
          : c.firstName || c.contact,
      username: c.contact,
      avatar_url: c.avatarUrl || "",
      tag: c.tag || "",
      online: !!c.online,
      lastSeen: c.lastSeen || null,
    }));
}

export function useContacts() {
  const { data, isPending, error } = useQuery({
    queryKey: ["contacts"],
    queryFn: getContacts,
    staleTime: 60_000,
  });

  return { contacts: data, isPending, error };
}
