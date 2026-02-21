package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.dto.TaskDto;
import com.example.webrtcchat.service.ChatService;
import com.example.webrtcchat.service.JwtService;
import com.example.webrtcchat.service.RoomService;
import com.example.webrtcchat.service.SchedulerService;
import com.example.webrtcchat.service.TaskService;
import com.example.webrtcchat.types.MessageType;
import com.example.webrtcchat.types.RoomType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int MAX_MESSAGE_LENGTH = 10_000;

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    private final ChatService chatService;
    private final JwtService jwtService;
    private final RoomService roomService;
    private final SchedulerService schedulerService;
    private final TaskService taskService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatWebSocketHandler(ChatService chatService, JwtService jwtService, RoomService roomService,
                                SchedulerService schedulerService, TaskService taskService) {
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.roomService = roomService;
        this.schedulerService = schedulerService;
        this.taskService = taskService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String token = extractToken(session);
        if (token == null || !jwtService.isTokenValid(token)) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
            return;
        }

        String username = jwtService.extractUsername(token);
        session.getAttributes().put("username", username);

        // Session cleanup (I7): close existing session for same user
        WebSocketSession oldSession = userSessions.get(username);
        if (oldSession != null && oldSession.isOpen() && !oldSession.getId().equals(session.getId())) {
            try {
                oldSession.close(CloseStatus.POLICY_VIOLATION.withReason("New session opened"));
            } catch (Exception e) {
                log.debug("Failed to close old session for user '{}'", username);
            }
            sessions.remove(oldSession.getId());
        }

        sessions.put(session.getId(), session);
        userSessions.put(username, session);
        chatService.addUser(username);
        roomService.joinRoom("general", username);

        MessageDto joinMsg = new MessageDto();
        joinMsg.setId(UUID.randomUUID().toString());
        joinMsg.setSender(username);
        joinMsg.setContent(username + " присоединился к чату");
        joinMsg.setTimestamp(now());
        joinMsg.setType(MessageType.JOIN);
        joinMsg.setRoomId("general");
        chatService.send("general", joinMsg);
        broadcastToRoom("general", joinMsg);

        log.info("User '{}' connected. Online: {}", username, chatService.getOnlineUsers().size());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String username = (String) session.getAttributes().get("username");
        if (username == null) return;

        // Input validation (I8): limit raw payload size
        if (message.getPayloadLength() > 50_000) {
            log.warn("Oversized message from '{}': {} bytes", username, message.getPayloadLength());
            return;
        }

        MessageDto incoming;
        try {
            incoming = objectMapper.readValue(message.getPayload(), MessageDto.class);
        } catch (Exception e) {
            log.warn("Invalid JSON from '{}': {}", username, e.getMessage());
            return;
        }

        // Input validation (I8): limit content length
        if (incoming.getContent() != null && incoming.getContent().length() > MAX_MESSAGE_LENGTH) {
            incoming.setContent(incoming.getContent().substring(0, MAX_MESSAGE_LENGTH));
        }

        // Handle READ_RECEIPT
        if (incoming.getType() == MessageType.READ_RECEIPT) {
            handleReadReceipt(username, incoming.getRoomId());
            return;
        }

        // Handle TYPING - broadcast to room members except sender
        if (incoming.getType() == MessageType.TYPING) {
            handleTyping(username, incoming.getRoomId());
            return;
        }

        // Handle EDIT
        if (incoming.getType() == MessageType.EDIT) {
            handleEdit(username, incoming);
            return;
        }

        // Handle DELETE
        if (incoming.getType() == MessageType.DELETE) {
            handleDelete(username, incoming);
            return;
        }

        // Handle SCHEDULED
        if (incoming.getType() == MessageType.SCHEDULED) {
            handleScheduled(username, incoming);
            return;
        }

        // Regular CHAT message
        incoming.setSender(username);
        incoming.setTimestamp(now());
        incoming.setType(MessageType.CHAT);
        incoming.setId(UUID.randomUUID().toString());
        incoming.setStatus("SENT");

        String roomId = incoming.getRoomId();
        if (roomId == null) roomId = "general";
        incoming.setRoomId(roomId);

        // Room membership check (C9)
        if (!isUserInRoom(username, roomId)) {
            log.warn("User '{}' tried to send to room '{}' without membership", username, roomId);
            return;
        }

        chatService.send(roomId, incoming);
        broadcastToRoom(roomId, incoming);

        // Check if any recipient is online → mark as DELIVERED
        sendDeliveryStatus(username, incoming, roomId);
    }

    /**
     * Check if user is a member of the room (C9).
     */
    private boolean isUserInRoom(String username, String roomId) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return false;
        if (room.getType() == RoomType.GENERAL) return true;
        return room.getMembers().contains(username);
    }

    private void handleEdit(String username, MessageDto incoming) {
        String roomId = incoming.getRoomId();
        String msgId = incoming.getId();
        if (roomId == null || msgId == null) return;
        if (!isUserInRoom(username, roomId)) return;

        MessageDto original = chatService.findMessage(roomId, msgId);
        if (original == null || !original.getSender().equals(username)) return;

        // Validate edit content length (I8)
        String newContent = incoming.getContent();
        if (newContent != null && newContent.length() > MAX_MESSAGE_LENGTH) {
            newContent = newContent.substring(0, MAX_MESSAGE_LENGTH);
        }

        chatService.editMessage(roomId, msgId, newContent);

        MessageDto broadcast = new MessageDto();
        broadcast.setType(MessageType.EDIT);
        broadcast.setId(msgId);
        broadcast.setRoomId(roomId);
        broadcast.setContent(newContent);
        broadcast.setSender(username);
        broadcast.setEdited(true);
        broadcastToRoom(roomId, broadcast);
    }

    private void handleDelete(String username, MessageDto incoming) {
        String roomId = incoming.getRoomId();
        String msgId = incoming.getId();
        if (roomId == null || msgId == null) return;
        if (!isUserInRoom(username, roomId)) return;

        MessageDto original = chatService.findMessage(roomId, msgId);
        if (original == null || !original.getSender().equals(username)) return;

        chatService.deleteMessage(roomId, msgId);

        MessageDto broadcast = new MessageDto();
        broadcast.setType(MessageType.DELETE);
        broadcast.setId(msgId);
        broadcast.setRoomId(roomId);
        broadcast.setSender(username);
        broadcastToRoom(roomId, broadcast);
    }

    private void handleScheduled(String username, MessageDto incoming) {
        String roomId = incoming.getRoomId();
        if (roomId == null) roomId = "general";
        if (!isUserInRoom(username, roomId)) return;
        String scheduledAt = incoming.getScheduledAt();
        if (scheduledAt == null) return;

        incoming.setSender(username);
        incoming.setId(UUID.randomUUID().toString());
        incoming.setRoomId(roomId);

        final String finalRoomId = roomId;
        schedulerService.schedule(incoming.getId(), scheduledAt, () -> {
            incoming.setType(MessageType.CHAT);
            incoming.setTimestamp(now());
            incoming.setStatus("SENT");
            incoming.setScheduledAt(null);
            chatService.send(finalRoomId, incoming);
            broadcastToRoom(finalRoomId, incoming);
            sendDeliveryStatus(incoming.getSender(), incoming, finalRoomId);
        });

        // Send confirmation back to sender
        MessageDto confirm = new MessageDto();
        confirm.setType(MessageType.SCHEDULED);
        confirm.setId(incoming.getId());
        confirm.setContent(incoming.getContent());
        confirm.setScheduledAt(scheduledAt);
        confirm.setRoomId(roomId);
        confirm.setSender(username);
        confirm.setTimestamp(now());
        WebSocketSession senderSession = userSessions.get(username);
        if (senderSession != null) {
            sendSafe(senderSession, serialize(confirm));
        }
    }

    public void broadcastTaskNotification(MessageType type, TaskDto task) {
        MessageDto notification = new MessageDto();
        notification.setType(type);
        notification.setId(task.getId());
        notification.setSender(task.getCreatedBy());
        notification.setContent(task.getTitle());
        notification.setRoomId(task.getRoomId());
        notification.setTimestamp(now());

        // Notify creator
        WebSocketSession creatorSession = userSessions.get(task.getCreatedBy());
        if (creatorSession != null) {
            sendSafe(creatorSession, serialize(notification));
        }

        // Notify assignee
        if (task.getAssignedTo() != null && !task.getAssignedTo().equals(task.getCreatedBy())) {
            WebSocketSession assigneeSession = userSessions.get(task.getAssignedTo());
            if (assigneeSession != null) {
                sendSafe(assigneeSession, serialize(notification));
            }
        }
    }

    private void handleTyping(String username, String roomId) {
        if (roomId == null) return;
        MessageDto typing = new MessageDto();
        typing.setType(MessageType.TYPING);
        typing.setSender(username);
        typing.setRoomId(roomId);

        String json = serialize(typing);
        if (json == null) return;

        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return;

        if (room.getType() == RoomType.GENERAL) {
            userSessions.forEach((user, s) -> {
                if (!user.equals(username)) sendSafe(s, json);
            });
        } else {
            room.getMembers().forEach(member -> {
                if (!member.equals(username)) {
                    WebSocketSession s = userSessions.get(member);
                    if (s != null) sendSafe(s, json);
                }
            });
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String username = (String) session.getAttributes().get("username");
        sessions.remove(session.getId());

        if (username != null) {
            // Only remove from userSessions if this IS the current session (I7)
            WebSocketSession current = userSessions.get(username);
            if (current != null && current.getId().equals(session.getId())) {
                userSessions.remove(username);
                chatService.removeUser(username);

                MessageDto leaveMsg = new MessageDto();
                leaveMsg.setId(UUID.randomUUID().toString());
                leaveMsg.setSender(username);
                leaveMsg.setContent(username + " покинул чат");
                leaveMsg.setTimestamp(now());
                leaveMsg.setType(MessageType.LEAVE);
                leaveMsg.setRoomId("general");
                chatService.send("general", leaveMsg);
                broadcastToRoom("general", leaveMsg);

                log.info("User '{}' disconnected. Online: {}", username, chatService.getOnlineUsers().size());
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("Transport error for session {}: {}", session.getId(), exception.getMessage());
        session.close(CloseStatus.SERVER_ERROR);
    }

    private void broadcastToRoom(String roomId, MessageDto message) {
        String json;
        try {
            json = objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            log.error("Failed to serialize message", e);
            return;
        }

        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return;

        if (room.getType() == RoomType.GENERAL) {
            userSessions.values().forEach(s -> sendSafe(s, json));
        } else {
            room.getMembers().forEach(member -> {
                WebSocketSession s = userSessions.get(member);
                if (s != null) sendSafe(s, json);
            });
        }
    }

    /**
     * Thread-safe send (I6): synchronized per session to prevent concurrent writes.
     */
    private void sendSafe(WebSocketSession session, String json) {
        if (json == null || session == null) return;
        try {
            if (session.isOpen()) {
                synchronized (session) {
                    session.sendMessage(new TextMessage(json));
                }
            }
        } catch (Exception e) {
            log.error("Failed to send message to session {}", session.getId(), e);
        }
    }

    private String serialize(MessageDto msg) {
        try {
            return objectMapper.writeValueAsString(msg);
        } catch (Exception e) {
            log.error("Failed to serialize message", e);
            return null;
        }
    }

    private void sendDeliveryStatus(String sender, MessageDto message, String roomId) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return;

        boolean hasOnlineRecipient;
        if (room.getType() == RoomType.GENERAL) {
            hasOnlineRecipient = userSessions.entrySet().stream()
                    .anyMatch(e -> !e.getKey().equals(sender) && e.getValue().isOpen());
        } else {
            hasOnlineRecipient = room.getMembers().stream()
                    .filter(m -> !m.equals(sender))
                    .anyMatch(m -> {
                        WebSocketSession s = userSessions.get(m);
                        return s != null && s.isOpen();
                    });
        }

        if (hasOnlineRecipient) {
            message.setStatus("DELIVERED");
            MessageDto update = new MessageDto();
            update.setType(MessageType.STATUS_UPDATE);
            update.setId(message.getId());
            update.setStatus("DELIVERED");
            update.setRoomId(roomId);

            WebSocketSession senderSession = userSessions.get(sender);
            if (senderSession != null) {
                sendSafe(senderSession, serialize(update));
            }
        }
    }

    private void handleReadReceipt(String reader, String roomId) {
        if (roomId == null) return;

        Map<String, List<String>> senderToMsgIds = chatService.markMessagesAsRead(roomId, reader);

        for (Map.Entry<String, List<String>> entry : senderToMsgIds.entrySet()) {
            WebSocketSession senderSession = userSessions.get(entry.getKey());
            if (senderSession != null && senderSession.isOpen()) {
                for (String msgId : entry.getValue()) {
                    MessageDto update = new MessageDto();
                    update.setType(MessageType.STATUS_UPDATE);
                    update.setId(msgId);
                    update.setStatus("READ");
                    update.setRoomId(roomId);
                    sendSafe(senderSession, serialize(update));
                }
            }
        }
    }

    private String extractToken(WebSocketSession session) {
        String query = session.getUri() != null ? session.getUri().getQuery() : null;
        if (query != null) {
            for (String param : query.split("&")) {
                if (param.startsWith("token=")) {
                    return param.substring(6);
                }
            }
        }
        return null;
    }

    private String now() {
        return LocalDateTime.now().format(FORMATTER);
    }
}
