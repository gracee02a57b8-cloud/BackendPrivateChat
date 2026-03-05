import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getConversationEntries, deriveConversations } from "./apiConversation";
import { getMessages } from "../messageArea/apiMessage";
import { useUser } from "../authentication/useUser";
import { useEffect, useRef, useMemo } from "react";
import { MAX_PREFETCHED_CONVERSATIONS } from "../../config";
import { getConvInfoById, getGroupConvInfo } from "../messageArea/apiConvInfo";
import useConversationSubscription from "./useConversationSubscription";

export function useConversations() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const myUserId = user?.id;

  // Perf F4: share ["rooms"] cache with useGroups — single /api/rooms fetch
  const { data: rooms, isPending, error } = useQuery({
    queryKey: ["rooms"],
    queryFn: getConversationEntries,
    enabled: !!myUserId,
    staleTime: 60_000,
  });

  // Derive conversations from rooms (synchronous — no extra API calls after F1)
  const data = useMemo(
    () => (rooms ? deriveConversations(rooms, myUserId) : undefined),
    [rooms, myUserId],
  );

  // Realtime Subscription
  useConversationSubscription(myUserId);

  /////////////
  // Prefetching
  /////////////
  const hasPrefetched = useRef(false);

  // Reset prefetch flag when user changes
  useEffect(() => {
    hasPrefetched.current = false;
  }, [myUserId]);

  useEffect(() => {
    if (!data || hasPrefetched.current) return;

    data?.slice(0, MAX_PREFETCHED_CONVERSATIONS).forEach((conv) => {
      const conversation_id = conv?.id;
      const friendUserId = conv?.friendInfo?.id;
      const isGroup = conv?.isGroup;

      if (!conversation_id || !friendUserId) return;

      // prefetch the messages
      queryClient.prefetchInfiniteQuery({
        queryKey: ["friend", friendUserId],
        queryFn: ({ pageParam }) => getMessages({ conversation_id, pageParam }),
        initialPageParam: 0,
        pages: 1,
      });

      // prefetch the convInfo (разные ключи для групп и приватных)
      if (isGroup) {
        queryClient.prefetchQuery({
          queryKey: ["convInfo", "room", conversation_id],
          queryFn: () => getGroupConvInfo({ roomId: conversation_id }),
        });
      } else {
        queryClient.prefetchQuery({
          queryKey: ["convInfo", friendUserId],
          queryFn: () => getConvInfoById({ myUserId, friendUserId }),
        });
      }
    });

    hasPrefetched.current = true;
  }, [data, queryClient, myUserId]);

  return { conversations: data, isPending, error };
}
