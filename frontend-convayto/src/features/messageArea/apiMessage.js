import { MAX_MESSAGES_PER_PAGE } from "../../config";
import { apiFetch } from "../../services/apiHelper";
import { sendWsMessage, isWsConnected } from "../../services/wsService";

/**
 * Send a message via WS if connected, otherwise fall back to REST POST.
 * Returns true on success.
 */
async function sendViaWsOrRest(wsMsg) {
  const sent = sendWsMessage(wsMsg);
  if (sent) return true;

  // REST fallback — POST /api/rooms/{roomId}/messages
  await apiFetch(`/api/rooms/${encodeURIComponent(wsMsg.roomId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(wsMsg),
  });
  return true;
}

export async function getMessages({ conversation_id, pageParam = 0 }) {
  if (!conversation_id) return [];

  const size = MAX_MESSAGES_PER_PAGE;
  const page = pageParam;

  const messages = await apiFetch(
    `/api/rooms/${encodeURIComponent(conversation_id)}/history?page=${page}&size=${size}`,
  );

  if (!messages || !Array.isArray(messages)) return [];

  // Transform backend MessageDto → frontend message format
  const transformed = messages.map((msg) => ({
    id: msg.id,
    conversation_id: conversation_id,
    content: msg.content || "",
    sender_id: msg.sender,
    created_at: msg.timestamp,
    type: msg.type || "CHAT",
    fileUrl: msg.fileUrl || null,
    fileName: msg.fileName || null,
    fileSize: msg.fileSize || 0,
    fileType: msg.fileType || null,
    duration: msg.duration || null,
    waveform: msg.waveform || null,
    thumbnailUrl: msg.thumbnailUrl || null,
    edited: msg.edited || false,
    pinned: msg.pinned || false,
    pinnedBy: msg.pinnedBy || null,
    replyToId: msg.replyToId || null,
    replyToSender: msg.replyToSender || null,
    replyToContent: msg.replyToContent || null,
    pollData: msg.pollData || null,
  }));

  // Batch-fetch reactions for all messages
  try {
    const ids = transformed.map((m) => m.id).filter(Boolean);
    if (ids.length > 0) {
      const reactionsMap = await apiFetch(`/api/reactions/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: ids }),
      });
      if (reactionsMap && typeof reactionsMap === "object") {
        transformed.forEach((m) => {
          if (reactionsMap[m.id]) m.reactions = reactionsMap[m.id];
        });
      }
    }
  } catch {
    // Reactions are optional; don't fail the message load
  }

  // Backend returns newest-first; reverse so oldest is first
  return transformed.reverse();
}

////////////////
export async function getMessageById(messageId) {
  return null;
}

export async function getPinnedMessages(roomId) {
  if (!roomId) return [];
  const msgs = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/pinned`);
  if (!Array.isArray(msgs)) return [];
  return msgs.map((msg) => ({
    id: msg.id,
    conversation_id: roomId,
    content: msg.content || "",
    sender_id: msg.sender,
    created_at: msg.timestamp,
    type: msg.type || "CHAT",
    pinned: true,
    pinnedBy: msg.pinnedBy,
  }));
}

//////////////////

export async function openConversation(friendUsername) {
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
  replyToId,
  replyToSender,
  replyToContent,
}) {
  let roomId = conversation_id;

  if (!roomId) {
    roomId = await openConversation(friendUserId);
  }

  const wsMessage = {
    type: "CHAT",
    roomId: roomId,
    content: content,
    id: id,
    ...(replyToId ? { replyToId, replyToSender, replyToContent } : {}),
  };

  await sendViaWsOrRest(wsMessage);

  return {
    id: id,
    conversation_id: roomId,
    content: content,
    sender_id: localStorage.getItem("username"),
    created_at: new Date().toISOString(),
    type: "CHAT",
    ...(replyToId ? { replyToId, replyToSender, replyToContent } : {}),
  };
}

////////////////////
// Отправка файла
////////////////////

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const result = await apiFetch("/api/upload/file", {
    method: "POST",
    body: formData,
  });

  return result; // { url, filename, originalName, size, contentType }
}

export async function sendFileMessage({ id, conversation_id, friendUserId, file }) {
  let roomId = conversation_id;
  if (!roomId) {
    roomId = await openConversation(friendUserId);
  }

  // Загрузить файл на сервер
  const uploaded = await uploadFile(file);

  const wsMessage = {
    type: "CHAT",
    roomId: roomId,
    content: `📎 ${uploaded.originalName || file.name}`,
    id: id,
    fileUrl: uploaded.url,
    fileName: uploaded.originalName || file.name,
    fileSize: uploaded.size || file.size,
    fileType: uploaded.contentType || file.type,
  };

  await sendViaWsOrRest(wsMessage);

  return {
    id,
    conversation_id: roomId,
    content: wsMessage.content,
    sender_id: localStorage.getItem("username"),
    created_at: new Date().toISOString(),
    type: "CHAT",
    fileUrl: uploaded.url,
    fileName: wsMessage.fileName,
    fileSize: wsMessage.fileSize,
    fileType: wsMessage.fileType,
  };
}

////////////////////
// Голосовое сообщение
////////////////////

export async function sendVoiceMessage({ id, conversation_id, friendUserId, blob, duration }) {
  let roomId = conversation_id;
  if (!roomId) {
    roomId = await openConversation(friendUserId);
  }

  const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type || "audio/webm" });
  const uploaded = await uploadFile(file);

  const wsMessage = {
    type: "VOICE",
    roomId: roomId,
    content: "🎤 Голосовое сообщение",
    id: id,
    fileUrl: uploaded.url,
    fileName: uploaded.originalName || file.name,
    fileSize: uploaded.size || blob.size,
    fileType: uploaded.contentType || "audio/webm",
    duration: Math.round(duration),
  };

  await sendViaWsOrRest(wsMessage);

  return {
    id,
    conversation_id: roomId,
    content: wsMessage.content,
    sender_id: localStorage.getItem("username"),
    created_at: new Date().toISOString(),
    type: "VOICE",
    fileUrl: uploaded.url,
    fileName: wsMessage.fileName,
    duration: wsMessage.duration,
  };
}

////////////////////
// Видеокружок
////////////////////

export async function sendVideoCircle({ id, conversation_id, friendUserId, blob, duration }) {
  let roomId = conversation_id;
  if (!roomId) {
    roomId = await openConversation(friendUserId);
  }

  const file = new File([blob], `video_circle_${Date.now()}.webm`, { type: blob.type || "video/webm" });
  const uploaded = await uploadFile(file);

  const wsMessage = {
    type: "VIDEO_CIRCLE",
    roomId: roomId,
    content: "🎥 Видеокружок",
    id: id,
    fileUrl: uploaded.url,
    fileName: uploaded.originalName || file.name,
    fileSize: uploaded.size || blob.size,
    fileType: uploaded.contentType || "video/webm",
    duration: Math.round(duration),
  };

  await sendViaWsOrRest(wsMessage);

  return {
    id,
    conversation_id: roomId,
    content: wsMessage.content,
    sender_id: localStorage.getItem("username"),
    created_at: new Date().toISOString(),
    type: "VIDEO_CIRCLE",
    fileUrl: uploaded.url,
    fileName: wsMessage.fileName,
    duration: wsMessage.duration,
  };
}

////////////////////
// Поиск сообщений
////////////////////

export async function searchMessages(roomId, query, page = 0, size = 50) {
  if (!roomId || !query) return [];
  const data = await apiFetch(
    `/api/rooms/${encodeURIComponent(roomId)}/search?q=${encodeURIComponent(query)}&page=${page}&size=${size}`
  );
  return data?.content || data || [];
}

export async function searchMessagesGlobal(query, page = 0, size = 50) {
  if (!query) return [];
  const data = await apiFetch(
    `/api/rooms/search/global?q=${encodeURIComponent(query)}&page=${page}&size=${size}`
  );
  return data?.content || data || [];
}

////////////////////
// Реакции
////////////////////

export async function getReactions(messageId) {
  return apiFetch(`/api/reactions/${encodeURIComponent(messageId)}`);
}

export async function getReactionsBatch(messageIds) {
  return apiFetch(`/api/reactions/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageIds }),
  });
}

////////////////////
// Опросы
////////////////////

export async function createPoll(roomId, { question, options, multiChoice = false, anonymous = false }) {
  return apiFetch(`/api/polls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, question, options, multiChoice, anonymous }),
  });
}

export async function votePoll(pollId, optionId) {
  return apiFetch(`/api/polls/${pollId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionId }),
  });
}

export async function closePoll(pollId) {
  return apiFetch(`/api/polls/${pollId}/close`, { method: "POST" });
}

export async function getPollData(pollId) {
  return apiFetch(`/api/polls/${pollId}`);
}

////////////////////
// Папки
////////////////////

export async function getFolders() {
  return apiFetch(`/api/folders`);
}

export async function createFolder(name, emoji) {
  return apiFetch(`/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, emoji }),
  });
}

export async function updateFolder(folderId, name, emoji) {
  return apiFetch(`/api/folders/${folderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, emoji }),
  });
}

export async function deleteFolder(folderId) {
  return apiFetch(`/api/folders/${folderId}`, { method: "DELETE" });
}

export async function addRoomToFolder(folderId, roomId) {
  return apiFetch(`/api/folders/${folderId}/rooms/${encodeURIComponent(roomId)}`, { method: "POST" });
}

export async function removeRoomFromFolder(folderId, roomId) {
  return apiFetch(`/api/folders/${folderId}/rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" });
}

////////////////////
// Мьют
////////////////////

export async function muteRoom(roomId, mutedUntil) {
  return apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/mute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mutedUntil: mutedUntil || null }),
  });
}

export async function unmuteRoom(roomId) {
  return apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/mute`, { method: "DELETE" });
}

export async function getMuteStatus(roomId) {
  return apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/mute`);
}

////////////////////
// Исчезающие сообщения
////////////////////

export async function setDisappearing(roomId, seconds) {
  return apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/disappearing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seconds }),
  });
}

////////////////////
// Прочтение
////////////////////

export async function getMessageReaders(roomId, messageId) {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/readers`
  );
}

export async function markMessageRead(roomId, messageId) {
  return apiFetch(
    `/api/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/read`,
    { method: "POST" }
  );
}

////////////////////
// Link preview
////////////////////

export async function fetchLinkPreview(url) {
  return apiFetch(`/api/rooms/link-preview?url=${encodeURIComponent(url)}`);
}

////////////////////
// Saved Messages
////////////////////

export async function getOrCreateSavedMessages() {
  return apiFetch(`/api/rooms/saved`, { method: "POST" });
}
