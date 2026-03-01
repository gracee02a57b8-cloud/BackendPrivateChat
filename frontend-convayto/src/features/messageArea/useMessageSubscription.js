import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { subscribeRealtimeMessage } from "./apiRealtimeMessage";
import { setActiveRoom } from "../../utils/unreadStore";

function useMessageSubscription({ conversation_id, friendUserId }) {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef(null);

  // Track active room for unread count management
  useEffect(() => {
    if (conversation_id) setActiveRoom(conversation_id);
    return () => setActiveRoom(null);
  }, [conversation_id]);

  useEffect(
    function () {
      if (!conversation_id) return;

      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();

      function callback(newData) {
        queryClient.setQueryData(["friend", friendUserId], (prevData) => {
          if (!prevData) return prevData;

          // Handle DELETE — remove message
          if (newData.type === "DELETE" && newData.deleted) {
            return {
              ...prevData,
              pages: prevData.pages.map((page) =>
                page.filter((m) => m.id !== newData.id),
              ),
            };
          }

          // Handle PIN / UNPIN — update pinned field on existing message
          if (newData.type === "PIN" || newData.type === "UNPIN") {
            return {
              ...prevData,
              pages: prevData.pages.map((page) =>
                page.map((m) =>
                  m.id === newData.id
                    ? { ...m, pinned: newData.pinned, pinnedBy: newData.pinnedBy }
                    : m,
                ),
              ),
            };
          }

          // Handle REACTION / REACTION_REMOVE — update reactions on existing message
          if (newData.type === "REACTION" || newData.type === "REACTION_REMOVE") {
            const myUsername = localStorage.getItem("username");
            // Skip if this is our own reaction (already handled optimistically)
            if (newData.sender_id === myUsername) return prevData;

            return {
              ...prevData,
              pages: prevData.pages.map((page) =>
                page.map((m) => {
                  if (m.id !== newData.id) return m;
                  let reactions = [...(m.reactions || [])];
                  const emoji = newData.emoji;
                  if (newData.type === "REACTION") {
                    const idx = reactions.findIndex((r) => r.emoji === emoji);
                    if (idx >= 0) {
                      const users = [...(reactions[idx].users || [])];
                      if (!users.includes(newData.sender_id)) users.push(newData.sender_id);
                      reactions[idx] = { ...reactions[idx], users, count: users.length };
                    } else {
                      reactions.push({ emoji, users: [newData.sender_id], count: 1 });
                    }
                  } else {
                    const idx = reactions.findIndex((r) => r.emoji === emoji);
                    if (idx >= 0) {
                      const users = (reactions[idx].users || []).filter((u) => u !== newData.sender_id);
                      if (users.length === 0) reactions.splice(idx, 1);
                      else reactions[idx] = { ...reactions[idx], users, count: users.length };
                    }
                  }
                  return { ...m, reactions };
                }),
              ),
            };
          }

          // Handle POLL_VOTE / POLL_CLOSE — update poll data on existing message
          if (newData.type === "POLL_VOTE" || newData.type === "POLL_CLOSE") {
            if (newData.pollData) {
              return {
                ...prevData,
                pages: prevData.pages.map((page) =>
                  page.map((m) => {
                    if (m.id === newData.id || m.pollData?.pollId === newData.pollData?.pollId) {
                      return { ...m, pollData: newData.pollData };
                    }
                    return m;
                  }),
                ),
              };
            }
            return prevData;
          }

          // Check ALL pages for existing message (optimistic update or edit)
          const existsInAnyPage = prevData?.pages?.some((page) =>
            page?.some((message) => message?.id === newData.id),
          );

          if (existsInAnyPage) {
            // Replace existing message in whichever page it's in
            return {
              ...prevData,
              pages: prevData.pages.map((page) =>
                page.map((message) =>
                  message.id === newData.id
                    ? newData.edited
                      ? { ...message, ...newData }
                      : newData
                    : message,
                ),
              ),
            };
          } else {
            return {
              ...prevData,
              // add the new message to the first page's data
              pages: prevData.pages.slice().map((page, index) => {
                return index === 0 ? [...page, newData] : page;
              }),
            };
          }
        });
      }

      subscriptionRef.current = subscribeRealtimeMessage({
        conversation_id,
        callback,
      });

      return () => {
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = null;
        // console.log("unsubscribed message");
      };
    },
    [conversation_id, friendUserId, queryClient],
  );
}

export default useMessageSubscription;
