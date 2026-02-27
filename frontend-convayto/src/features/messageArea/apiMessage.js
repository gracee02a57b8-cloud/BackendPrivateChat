import { MAX_MESSAGES_PER_PAGE } from "../../config";
import { apiFetch } from "../../services/apiHelper";
import { sendWsMessage } from "../../services/wsService";

export async function getMessages({ conversation_id, pageParam = 0 }) {
  if (!conversation_id) return [];

  const size = MAX_MESSAGES_PER_PAGE;
  const page = pageParam;

  const messages = await apiFetch(
    `/api/rooms/${encodeURIComponent(conversation_id)}/history?page=${page}&size=${size}`,
  );

  if (!messages || !Array.isArray(messages)) return [];

  // Transform backend MessageDto → frontend message format
  // Backend returns newest first, we need oldest first for display
  const transformed = messages.map((msg) => ({
    id: msg.id,
    conversation_id: conversation_id,
    content: msg.content || "",
    sender_id: msg.sender,
    created_at: msg.timestamp,
    type: msg.type || "CHAT",
    fileUrl: msg.fileUrl,
    fileName: msg.fileName,
    edited: msg.edited || false,
  }));

  // Backend returns newest-first; reverse so oldest is first
  return transformed.reverse();
}

////////////////
export async function getMessageById(messageId) {
  // Not directly supported by backend — return null
  return null;
}

//////////////////

export async function openConversation(friendUsername) {
  // Create or get private room via REST
  const room = await apiFetch(`/api/rooms/private/${encodeURIComponent(friendUsername)}`, {
    method: "POST",
  });
  return room?.id;
}

////////////////////

export async function sendMessage({
  id,
  conversation_id,
  content,
  friendUserId,
}) {
  let roomId = conversation_id;

  // If no conversation exists yet, create it
  if (!roomId) {
    roomId = await openConversation(friendUserId);
  }

  // Send message via WebSocket
  const wsMessage = {
    type: "CHAT",
    roomId: roomId,
    content: content,
    id: id,
  };

  const sent = sendWsMessage(wsMessage);
  if (!sent) {
    throw new Error("Не удалось отправить сообщение. Проверьте подключение.");
  }

  // Return the optimistic message shape
  return {
    id: id,
    conversation_id: roomId,
    content: content,
    sender_id: localStorage.getItem("username"),
    created_at: new Date().toISOString(),
    type: "CHAT",
  };
}
