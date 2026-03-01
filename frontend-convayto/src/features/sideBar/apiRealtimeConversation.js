import { onWsMessage } from "../../services/wsService";
import { increment, getActiveRoom } from "../../utils/unreadStore";
import { showMessageToast } from "../../utils/showMessageToast";

export function subscribeRealtimeConversation({ myUserId, callback }) {
  // Listen for all incoming WebSocket messages to update the conversation list
  const unsubscribe = onWsMessage((msg) => {
    // Skip messages without a room
    if (!msg.roomId) return;

    // Don't echo our own messages
    const myUsername = localStorage.getItem("username");
    if (msg.sender === myUsername) return;

    // Handle CHAT/VOICE/VIDEO_CIRCLE — update last message preview in sidebar
    if (msg.type === "CHAT" || msg.type === "VOICE" || msg.type === "VIDEO_CIRCLE") {
      // Track unread count
      increment(msg.roomId);

      // Show notification toast if user is not viewing this chat
      if (getActiveRoom() !== msg.roomId) {
        showMessageToast({
          sender: msg.sender || "Сообщение",
          content: msg.content,
          timestamp: msg.timestamp,
          msgId: msg.id,
        });
      }

      callback({
        eventType: "UPDATE",
        new: {
          id: msg.roomId,
          last_message: {
            content: msg.content || "",
            created_at: msg.timestamp,
            sender_id: msg.sender,
          },
        },
      });
      return;
    }

    // Handle EDIT — update last message content in sidebar
    if (msg.type === "EDIT") {
      callback({
        eventType: "UPDATE",
        new: {
          id: msg.roomId,
          last_message: {
            content: msg.content || "",
            created_at: msg.timestamp,
            sender_id: msg.sender,
          },
        },
      });
      return;
    }

    // Handle DELETE — update sidebar (show previous message or empty)
    if (msg.type === "DELETE") {
      callback({
        eventType: "UPDATE",
        new: {
          id: msg.roomId,
          last_message: {
            content: "Сообщение удалено",
            created_at: msg.timestamp || new Date().toISOString(),
            sender_id: msg.sender,
          },
        },
      });
      return;
    }
  });

  return { unsubscribe };
}
