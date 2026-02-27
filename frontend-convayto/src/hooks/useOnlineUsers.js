// ==========================================
// Online Presence — track who's online via WS + REST
// ==========================================
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../services/apiHelper";
import { onWsMessage } from "../services/wsService";

// Fetch initial online users list
async function fetchOnlineUsers() {
  const list = await apiFetch("/api/chat/online");
  return new Set(list || []);
}

/**
 * Hook that returns a Set of online usernames, updated in real-time via WebSocket PRESENCE events.
 */
export function useOnlineUsers() {
  const queryClient = useQueryClient();

  const { data: initialOnline } = useQuery({
    queryKey: ["onlineUsers"],
    queryFn: fetchOnlineUsers,
    staleTime: 30_000,
    refetchInterval: 60_000, // refresh every 60s as fallback
  });

  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const onlineRef = useRef(onlineUsers);

  // Sync initial data
  useEffect(() => {
    if (initialOnline) {
      setOnlineUsers(initialOnline);
      onlineRef.current = initialOnline;
    }
  }, [initialOnline]);

  // Listen for PRESENCE ws events
  useEffect(() => {
    const unsubscribe = onWsMessage((msg) => {
      if (msg.type !== "PRESENCE") return;

      const username = msg.sender;
      const isOnline = msg.content === "online";

      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(username);
        } else {
          next.delete(username);
        }
        onlineRef.current = next;
        return next;
      });

      // Also invalidate contacts to update lastSeen
      if (!isOnline) {
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      }
    });

    return unsubscribe;
  }, [queryClient]);

  return onlineUsers;
}

/**
 * Check if a specific user is online.
 */
export function isUserOnline(onlineSet, username) {
  return onlineSet?.has?.(username) || false;
}
