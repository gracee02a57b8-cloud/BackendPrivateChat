package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.service.ChatService;
import com.example.webrtcchat.service.JwtService;
import com.example.webrtcchat.service.RoomService;
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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    private final ChatService chatService;
    private final JwtService jwtService;
    private final RoomService roomService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatWebSocketHandler(ChatService chatService, JwtService jwtService, RoomService roomService) {
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.roomService = roomService;
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
        sessions.put(session.getId(), session);
        userSessions.put(username, session);
        chatService.addUser(username);
        roomService.joinRoom("general", username);

        MessageDto joinMsg = new MessageDto();
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

        MessageDto incoming = objectMapper.readValue(message.getPayload(), MessageDto.class);
        incoming.setSender(username);
        incoming.setTimestamp(now());
        incoming.setType(MessageType.CHAT);

        String roomId = incoming.getRoomId();
        if (roomId == null) roomId = "general";
        incoming.setRoomId(roomId);

        chatService.send(roomId, incoming);
        broadcastToRoom(roomId, incoming);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String username = (String) session.getAttributes().get("username");
        sessions.remove(session.getId());

        if (username != null) {
            userSessions.remove(username);
            chatService.removeUser(username);

            MessageDto leaveMsg = new MessageDto();
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

    private void sendSafe(WebSocketSession session, String json) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (Exception e) {
            log.error("Failed to send message to session {}", session.getId(), e);
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
