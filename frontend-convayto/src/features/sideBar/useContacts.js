import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../services/apiHelper";

async function getContacts() {
  const contacts = await apiFetch("/api/chat/contacts");
  if (!contacts || !Array.isArray(contacts)) return [];

  return contacts.map((c) => ({
    id: c.contact, // username — используется для навигации /chat/:userId
    fullname: c.firstName && c.lastName
      ? `${c.firstName} ${c.lastName}`
      : c.firstName || c.contact,
    username: c.contact,
    avatar_url: c.avatarUrl || "",
    tag: c.tag || "",
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
