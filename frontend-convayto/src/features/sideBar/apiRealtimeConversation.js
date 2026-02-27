import { onWsMessage } from "../../services/wsService";

export function subscribeRealtimeConversation({ myUserId, callback }) {
  // Listen for all incoming WebSocket messages to update the conversation list
  const unsubscribe = onWsMessage((msg) => {
    // Only handle CHAT messages (new messages that update conversation list)
    if (msg.type !== "CHAT" && msg.type !== "VOICE" && msg.type !== "VIDEO_CIRCLE") return;

    // Skip messages without a room
    if (!msg.roomId) return;

    // Don't echo our own messages
    const myUsername = localStorage.getItem("username");
    if (msg.sender === myUsername) return;

    // Build an UPDATE payload that the conversation subscription handler expects
    const updatedPayload = {
      eventType: "UPDATE",
      new: {
        id: msg.roomId,
        last_message: {
          content: msg.content || "",
          created_at: msg.timestamp,
          sender_id: msg.sender,
        },
      },
    };

    callback(updatedPayload);
  });

  return { unsubscribe };
}
