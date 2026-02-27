import { onWsMessage } from "../../services/wsService";

export function subscribeRealtimeMessage({ conversation_id, callback }) {
  if (!conversation_id) return { unsubscribe: () => {} };

  // Listen for WebSocket messages that belong to this room
  const unsubscribe = onWsMessage((msg) => {
    // Only process CHAT-type messages for this room
    if (msg.roomId === conversation_id && (msg.type === "CHAT" || msg.type === "VOICE" || msg.type === "VIDEO_CIRCLE")) {
      // Don't echo back our own messages (already added optimistically)
      const myUsername = localStorage.getItem("username");
      if (msg.sender === myUsername) return;

      callback({
        id: msg.id,
        conversation_id: msg.roomId,
        content: msg.content || "",
        sender_id: msg.sender,
        created_at: msg.timestamp,
        type: msg.type,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
      });
    }
  });

  return { unsubscribe };
}
