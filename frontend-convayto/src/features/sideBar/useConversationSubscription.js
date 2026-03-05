import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { subscribeRealtimeConversation } from "./apiRealtimeConversation";

const useConversationSubscription = (myUserId) => {
  const queryClient = useQueryClient();
  const subscriptionConversationRef = useRef(null);

  useEffect(
    function () {
      if (!myUserId || subscriptionConversationRef.current) return;

      const callback = (payload) => {
        // Perf F4: update shared ["rooms"] cache so derived conversations & groups auto-update
        queryClient.setQueryData(["rooms"], (prevRooms) => {
          if (!prevRooms) return prevRooms;

          if (payload?.eventType === "UPDATE") {
            return prevRooms.map((room) => {
              if (room.id === payload.new.id) {
                return {
                  ...room,
                  lastMessage: payload.new.last_message
                    ? {
                        content: payload.new.last_message.content || "",
                        created_at: payload.new.last_message.created_at || "",
                        sender_id: payload.new.last_message.sender_id || "",
                      }
                    : room.lastMessage,
                };
              }
              return room;
            });
          }

          if (payload?.eventType === "INSERT") {
            return [payload.new, ...prevRooms];
          }

          return prevRooms;
        });
      };

      subscriptionConversationRef.current = subscribeRealtimeConversation({
        myUserId,
        callback,
      });

      return () => {
        if (subscriptionConversationRef.current) {
          subscriptionConversationRef.current.unsubscribe();
          subscriptionConversationRef.current = null;

          // console.log("unsubscribed conversation");
        }
      };
    },

    [myUserId, queryClient],
  );
};

export default useConversationSubscription;
