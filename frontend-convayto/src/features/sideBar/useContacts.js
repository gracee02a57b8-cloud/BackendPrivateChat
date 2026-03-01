import { useQuery } from "@tanstack/react-query";
import { fetchContacts } from "../../services/apiContacts";

/**
 * Fetch the user's explicitly-added contacts via /api/contacts.
 */
export async function getContacts() {
  const raw = await fetchContacts();
  if (!Array.isArray(raw)) return [];

  return raw.map((c) => ({
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
