import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getConversations } from "./apiConversation";
import { getMessages } from "../messageArea/apiMessage";
import { useUser } from "../authentication/useUser";
import { useEffect, useRef } from "react";
import { MAX_PREFETCHED_CONVERSATIONS } from "../../config";
import { getConvInfoById, getGroupConvInfo } from "../messageArea/apiConvInfo";
import useConversationSubscription from "./useConversationSubscription";

export function useConversations() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const myUserId = user.id;

  const { data, isPending, error } = useQuery({
    queryKey: ["conversations", myUserId],
    queryFn: () => getConversations({ myUserId }),
  });

  // Realtime Subscription
  useConversationSubscription(myUserId);

  /////////////
  // Prefetching
  /////////////
  const hasPrefetched = useRef(false);

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
