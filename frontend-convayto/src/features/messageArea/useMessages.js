import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getMessages } from "./apiMessage";
import { useEffect } from "react";
import useConvInfo from "./useConvInfo";
import useMessageSubscription from "./useMessageSubscription";
import { MAX_MESSAGES_PER_PAGE } from "../../config";

export function useMessages() {
  const {
    convInfo,
    isPending: isPendingConvInfo,
    error: convError,
  } = useConvInfo();

  const conversation_id = convInfo?.id;
  const friendUserId = convInfo?.friendInfo?.id;

  const queryClient = useQueryClient();

  // Clear older pages when the user switches to a different chat.
  // Only friendUserId matters here — it identifies the chat.
  // Also strips empty trailing pages left by exhausted pagination.
  useEffect(() => {
    queryClient.setQueryData(["friend", friendUserId], (prev) => {
      if (!prev || prev.pages.length <= 1) return;

      // Always trim to page 0 + remove empty trailing pages
      const trimmed = prev.pages.slice(0, 1);
      const params = prev.pageParams.slice(0, 1);
      return { pages: trimmed, pageParams: params };
    });
  }, [friendUserId, queryClient]);

  const {
    data: { pages } = {},
    error: messagesError,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isPending,
    isLoading: isLoadingMessages,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["friend", friendUserId],
    queryFn: ({ pageParam }) => getMessages({ conversation_id, pageParam }),

    select: (data) => {
      if (!data || data.pages.length < 2) return data;
      // Filter out empty trailing pages so reversal never puts an empty
      // page at index 0 (which would trigger "Нет сообщений").
      let pages = [...data.pages];
      let params = [...data.pageParams];
      while (pages.length > 1 && pages[pages.length - 1]?.length === 0) {
        pages.pop();
        params.pop();
      }
      if (pages.length < 2) return { ...data, pages, pageParams: params };
      return {
        pages: pages.reverse(),
        pageParams: params.reverse(),
      };
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      // If the page is empty OR has fewer items than a full page,
      // there are no more messages to load.
      if (!lastPage || lastPage.length < MAX_MESSAGES_PER_PAGE) return undefined;
      return lastPageParam + 1;
    },
    initialPageParam: 0,
    // Both IDs must be present: friendUserId for the cache key,
    // conversation_id for the actual API call. They come from the same
    // convInfo object but conversation_id can be null if the room POST
    // in getConvInfoById failed — in that case we must NOT fetch
    // (getMessages would return [] and poison the cache for 5 min).
    enabled: !!friendUserId && !!conversation_id,
    staleTime: 5 * 60 * 1000, // 5 min — WS handles realtime updates
    refetchOnWindowFocus: false,
  });

  // Realtime subscription
  useMessageSubscription({ conversation_id, friendUserId });

  const isLoading = isPendingConvInfo || isLoadingMessages;

  return {
    pages,
    isFetching,
    isPending,
    isLoading,
    error: convError || messagesError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
}
