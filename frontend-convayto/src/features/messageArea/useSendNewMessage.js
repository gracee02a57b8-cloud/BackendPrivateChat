import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendMessage } from "./apiMessage";
import useConvInfo from "./useConvInfo";
import toast from "react-hot-toast";

export function useSendNewMessage() {
  const queryClient = useQueryClient();
  const { convInfo } = useConvInfo();
  const conversationId = convInfo?.id;

  const friendUserId = convInfo?.friendInfo?.id;

  const { mutate: sendNewMessage, isPending: isSending } = useMutation({
    mutationFn: sendMessage,

    // When mutate is called:
    onMutate: async (newMessage) => {
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({
        queryKey: ["friend", friendUserId],
      });

      // Check whether the cache already has real messages.
      // If the initial fetch hasn't completed yet the cache will be empty;
      // we track this so onSuccess can trigger a refetch.
      const prev = queryClient.getQueryData(["friend", friendUserId]);
      const hadData = prev?.pages?.some((p) => p?.length > 0);

      // Optimistically update to the new value
      queryClient.setQueryData(["friend", friendUserId], (oldMessages) => {
        if (!oldMessages?.pages) {
          return { pages: [[newMessage]], pageParams: [0] };
        }
        return {
          ...oldMessages,
          pages: oldMessages.pages
            .slice()
            .map((page, index) =>
              index === 0
                ? !page
                  ? [newMessage]
                  : [...page, newMessage]
                : page,
            ),
        };
      });

      // Return context — we only need hadData and the message id for rollback
      return { hadData, optimisticId: newMessage.id };
    },

    onSuccess: (serverMessage, _vars, context) => {
      // Settle the optimistic message with server data
      queryClient.setQueryData(["friend", friendUserId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) =>
              m.id === serverMessage.id
                ? { ...m, ...serverMessage, optimistic: false }
                : m,
            ),
          ),
        };
      });

      // When conversation id was null, the conversation is new.
      // Update convInfo and force a refetch to load server-side history.
      if (!conversationId) {
        queryClient.setQueryData(["convInfo", friendUserId], (prevData) => {
          return {
            ...prevData,
            id: serverMessage.conversation_id,
          };
        });
      }

      // If the initial history fetch was cancelled by onMutate
      // (cache was empty), refetch so the full history appears.
      if (!context?.hadData) {
        queryClient.invalidateQueries({
          queryKey: ["friend", friendUserId],
        });
      }
    },

    onError: (error, newMessage) => {
      toast.error(error.message);
      // Remove only the failed optimistic message.
      // This preserves any messages delivered via WebSocket
      // between onMutate and onError.
      queryClient.setQueryData(["friend", friendUserId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.filter((m) => m.id !== newMessage.id),
          ),
        };
      });
    },
  });

  return { isSending, sendNewMessage };
}
