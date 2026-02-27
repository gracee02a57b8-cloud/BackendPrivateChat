import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../services/apiHelper";

async function getGroups() {
  const rooms = await apiFetch("/api/rooms");
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
    queryKey: ["groups"],
    queryFn: getGroups,
    staleTime: 60_000,
  });

  return { groups: data, isPending, error };
}
