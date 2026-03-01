import { onWsMessage } from "../../services/wsService";
import { increment, getActiveRoom } from "../../utils/unreadStore";
import toast from "react-hot-toast";

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
        const sender = msg.sender || "Сообщение";
        const preview = (msg.content || "").substring(0, 60);
        toast(`${sender}: ${preview || "📎 Вложение"}`, {
          position: "bottom-right",
          duration: 4000,
          icon: "💬",
          id: `msg-${msg.id || Date.now()}`,
          style: {
            background: "#1e293b",
            color: "#f1f5f9",
            borderRadius: "12px",
            padding: "12px 16px",
            fontSize: "14px",
            maxWidth: "360px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          },
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
