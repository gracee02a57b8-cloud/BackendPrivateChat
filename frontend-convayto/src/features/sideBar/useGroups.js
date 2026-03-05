import { useQuery } from "@tanstack/react-query";
import { getConversationEntries } from "./apiConversation";

// Perf F4: reuse shared "rooms" query to avoid duplicate /api/rooms fetches
function extractGroups(rooms) {
  if (!rooms || !Array.isArray(rooms)) return [];

  // Фильтруем только групповые комнаты (type === "ROOM")
  return rooms
    .filter((r) => r.type === "ROOM")
    .map((r) => ({
      id: r.id,
      name: r.name || "Группа",
      description: r.description || "",
      avatarUrl: r.avatarUrl || "",
      members: r.members || [],
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));
}

export function useGroups() {
  const { data, isPending, error } = useQuery({
    queryKey: ["rooms"],
    queryFn: getConversationEntries,
    staleTime: 60_000,
    select: extractGroups,
  });

  return { groups: data, isPending, error };
}
