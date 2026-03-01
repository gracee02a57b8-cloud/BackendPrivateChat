import { onWsMessage } from "../../services/wsService";

export function subscribeRealtimeMessage({ conversation_id, callback }) {
  if (!conversation_id) return { unsubscribe: () => {} };

  // Listen for WebSocket messages that belong to this room
  const unsubscribe = onWsMessage((msg) => {
    // Process CHAT/VOICE/VIDEO_CIRCLE messages for this room
    if (msg.roomId === conversation_id && (msg.type === "CHAT" || msg.type === "VOICE" || msg.type === "VIDEO_CIRCLE")) {
      // Don't echo back our own messages (already added optimistically),
      // BUT allow forwarded messages through since they have no optimistic update
      const myUsername = localStorage.getItem("username");
      const isForwarded = msg.content?.startsWith("↪ Переслано от");
      if (msg.sender === myUsername && !isForwarded) return;

      callback({
        id: msg.id,
        conversation_id: msg.roomId,
        content: msg.content || "",
        sender_id: msg.sender,
        created_at: msg.timestamp,
        type: msg.type,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        fileType: msg.fileType,
        duration: msg.duration,
        waveform: msg.waveform,
        thumbnailUrl: msg.thumbnailUrl,
      });
    }

    // Handle message edits
    if (msg.roomId === conversation_id && msg.type === "EDIT") {
      const myUsername = localStorage.getItem("username");
      if (msg.sender === myUsername) return;

      callback({
        id: msg.id,
        conversation_id: msg.roomId,
        content: msg.content || "",
        sender_id: msg.sender,
        created_at: msg.timestamp,
        type: "CHAT",
        edited: true,
        // Preserve file/media fields from the original message
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        fileType: msg.fileType,
        duration: msg.duration,
        waveform: msg.waveform,
        thumbnailUrl: msg.thumbnailUrl,
      });
    }

    // Handle message deletes
    if (msg.roomId === conversation_id && msg.type === "DELETE") {
      callback({
        id: msg.id,
        conversation_id: msg.roomId,
        deleted: true,
        type: "DELETE",
      });
    }

    // Handle PIN / UNPIN
    if (msg.roomId === conversation_id && (msg.type === "PIN" || msg.type === "UNPIN")) {
      callback({
        id: msg.id,
        conversation_id: msg.roomId,
        type: msg.type,
        pinned: msg.type === "PIN",
        pinnedBy: msg.pinnedBy || msg.sender || null,
        content: msg.content,
      });
    }

    // Handle REACTION / REACTION_REMOVE
    if (msg.roomId === conversation_id && (msg.type === "REACTION" || msg.type === "REACTION_REMOVE")) {
      callback({
        id: msg.id,
        conversation_id: msg.roomId,
        type: msg.type,
        sender_id: msg.sender,
        emoji: msg.extra?.emoji || msg.emoji,
      });
    }

    // Handle POLL (new poll created)
    if (msg.roomId === conversation_id && msg.type === "POLL") {
      callback({
        id: msg.id,
        conversation_id: msg.roomId,
        content: msg.content || "",
        sender_id: msg.sender,
        created_at: msg.timestamp,
        type: "POLL",
        pollData: msg.pollData || msg.extra,
      });
    }

    // Handle POLL_VOTE / POLL_CLOSE (poll state updates)
    if (msg.roomId === conversation_id && (msg.type === "POLL_VOTE" || msg.type === "POLL_CLOSE")) {
      callback({
        id: msg.id,
        conversation_id: msg.roomId,
        type: msg.type,
        pollData: msg.pollData || msg.extra,
      });
    }

    // Handle DISAPPEARING_SET
    if (msg.roomId === conversation_id && msg.type === "DISAPPEARING_SET") {
      callback({
        id: msg.id,
        conversation_id: msg.roomId,
        content: msg.content || "",
        sender_id: msg.sender,
        created_at: msg.timestamp,
        type: "DISAPPEARING_SET",
      });
    }
  });

  return { unsubscribe };
}
