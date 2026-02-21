package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.service.*;
import com.example.webrtcchat.types.MessageType;
import com.example.webrtcchat.types.RoomType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatWebSocketHandlerTest {

    @Mock private ChatService chatService;
    @Mock private JwtService jwtService;
    @Mock private RoomService roomService;
    @Mock private SchedulerService schedulerService;
    @Mock private TaskService taskService;
    @Mock private WebSocketSession session;

    private ChatWebSocketHandler handler;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        handler = new ChatWebSocketHandler(chatService, jwtService, roomService, schedulerService, taskService);
    }

    // === Connection ===

    @Test
    @DisplayName("afterConnectionEstablished - valid token connects user")
    void connect_validToken() throws Exception {
        setupSession("session1", "alice", "valid-token");
        when(jwtService.isTokenValid("valid-token")).thenReturn(true);
        when(jwtService.extractUsername("valid-token")).thenReturn("alice");

        RoomDto generalRoom = createRoom("general", RoomType.GENERAL);
        when(roomService.joinRoom("general", "alice")).thenReturn(generalRoom);
        when(roomService.getRoomById("general")).thenReturn(generalRoom);

        handler.afterConnectionEstablished(session);

        verify(chatService).addUser("alice");
        verify(roomService).joinRoom("general", "alice");
        verify(chatService).send(eq("general"), any(MessageDto.class));
    }

    @Test
    @DisplayName("afterConnectionEstablished - invalid token closes connection")
    void connect_invalidToken() throws Exception {
        when(session.getUri()).thenReturn(new URI("ws://localhost/ws/chat?token=bad-token"));
        when(jwtService.isTokenValid("bad-token")).thenReturn(false);

        handler.afterConnectionEstablished(session);

        verify(session).close(any(CloseStatus.class));
        verify(chatService, never()).addUser(anyString());
    }

    @Test
    @DisplayName("afterConnectionEstablished - no token closes connection")
    void connect_noToken() throws Exception {
        when(session.getUri()).thenReturn(new URI("ws://localhost/ws/chat"));

        handler.afterConnectionEstablished(session);

        verify(session).close(any(CloseStatus.class));
    }

    // === Chat messages ===

    @Test
    @DisplayName("handleTextMessage - sends chat message to room")
    void handleMessage_chat() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto incoming = new MessageDto();
        incoming.setContent("Hello world");
        incoming.setRoomId("general");
        incoming.setType(MessageType.CHAT);

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService).send(eq("general"), argThat(msg ->
                "Hello world".equals(msg.getContent()) &&
                "alice".equals(msg.getSender()) &&
                MessageType.CHAT == msg.getType()
        ));
    }

    @Test
    @DisplayName("handleTextMessage - rejects oversized payload")
    void handleMessage_oversized() throws Exception {
        setupConnectedSession("session1", "alice");

        // Create message > 50KB
        String bigPayload = "x".repeat(51_000);
        TextMessage bigMessage = new TextMessage(bigPayload);

        handler.handleTextMessage(session, bigMessage);

        verify(chatService, never()).send(anyString(), any());
    }

    @Test
    @DisplayName("handleTextMessage - rejects invalid JSON")
    void handleMessage_invalidJson() throws Exception {
        setupConnectedSession("session1", "alice");

        handler.handleTextMessage(session, new TextMessage("not json at all!!!"));

        verify(chatService, never()).send(anyString(), any());
    }

    @Test
    @DisplayName("handleTextMessage - truncates content exceeding 10000 chars")
    void handleMessage_truncatesLongContent() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto incoming = new MessageDto();
        incoming.setContent("a".repeat(15_000)); // exceeds MAX_MESSAGE_LENGTH
        incoming.setRoomId("general");
        incoming.setType(MessageType.CHAT);

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService).send(eq("general"), argThat(msg ->
                msg.getContent().length() == 10_000
        ));
    }

    // === Room membership check ===

    @Test
    @DisplayName("handleTextMessage - rejects message to room user is not member of")
    void handleMessage_nonMemberRejected() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("room1", RoomType.ROOM);
        room.setMembers(new CopyOnWriteArraySet<>(Set.of("bob"))); // alice is NOT a member
        when(roomService.getRoomById("room1")).thenReturn(room);

        MessageDto incoming = new MessageDto();
        incoming.setContent("Sneaky message");
        incoming.setRoomId("room1");
        incoming.setType(MessageType.CHAT);

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService, never()).send(anyString(), any());
    }

    @Test
    @DisplayName("handleTextMessage - allows message to general room for any user")
    void handleMessage_generalRoomAllowed() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto incoming = new MessageDto();
        incoming.setContent("Hello general");
        incoming.setRoomId("general");
        incoming.setType(MessageType.CHAT);

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService).send(eq("general"), any(MessageDto.class));
    }

    // === Edit ===

    @Test
    @DisplayName("handleTextMessage - edit message by original sender")
    void handleMessage_edit() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto original = new MessageDto();
        original.setId("msg-1");
        original.setSender("alice");
        original.setContent("Old content");
        when(chatService.findMessage("general", "msg-1")).thenReturn(original);

        MessageDto incoming = new MessageDto();
        incoming.setType(MessageType.EDIT);
        incoming.setId("msg-1");
        incoming.setRoomId("general");
        incoming.setContent("Edited content");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService).editMessage("general", "msg-1", "Edited content");
    }

    @Test
    @DisplayName("handleTextMessage - edit rejected for non-sender")
    void handleMessage_editRejectedNonSender() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto original = new MessageDto();
        original.setId("msg-1");
        original.setSender("bob"); // Not alice
        original.setContent("Bob's message");
        when(chatService.findMessage("general", "msg-1")).thenReturn(original);

        MessageDto incoming = new MessageDto();
        incoming.setType(MessageType.EDIT);
        incoming.setId("msg-1");
        incoming.setRoomId("general");
        incoming.setContent("Hacked");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService, never()).editMessage(anyString(), anyString(), anyString());
    }

    // === Delete ===

    @Test
    @DisplayName("handleTextMessage - delete message by original sender")
    void handleMessage_delete() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto original = new MessageDto();
        original.setId("msg-1");
        original.setSender("alice");
        when(chatService.findMessage("general", "msg-1")).thenReturn(original);

        MessageDto incoming = new MessageDto();
        incoming.setType(MessageType.DELETE);
        incoming.setId("msg-1");
        incoming.setRoomId("general");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService).deleteMessage("general", "msg-1");
    }

    // === Disconnect ===

    @Test
    @DisplayName("afterConnectionClosed - removes user and broadcasts leave")
    void disconnect_removesUser() throws Exception {
        // First connect
        setupSession("session1", "alice", "valid-token");
        when(jwtService.isTokenValid("valid-token")).thenReturn(true);
        when(jwtService.extractUsername("valid-token")).thenReturn("alice");

        RoomDto generalRoom = createRoom("general", RoomType.GENERAL);
        when(roomService.joinRoom("general", "alice")).thenReturn(generalRoom);
        when(roomService.getRoomById("general")).thenReturn(generalRoom);

        handler.afterConnectionEstablished(session);
        reset(chatService);

        // Reconnect roomService mock for disconnect broadcast
        when(roomService.getRoomById("general")).thenReturn(generalRoom);

        // Then disconnect
        handler.afterConnectionClosed(session, CloseStatus.NORMAL);

        verify(chatService).removeUser("alice");
        verify(chatService).send(eq("general"), argThat(msg ->
                msg.getType() == MessageType.LEAVE &&
                "alice".equals(msg.getSender())
        ));
    }

    // === Helpers ===

    private void setupSession(String sessionId, String username, String token) throws Exception {
        Map<String, Object> attrs = new HashMap<>();
        when(session.getId()).thenReturn(sessionId);
        when(session.getAttributes()).thenReturn(attrs);
        when(session.getUri()).thenReturn(new URI("ws://localhost/ws/chat?token=" + token));
        when(session.isOpen()).thenReturn(true);
    }

    private void setupConnectedSession(String sessionId, String username) throws Exception {
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("username", username);
        when(session.getId()).thenReturn(sessionId);
        when(session.getAttributes()).thenReturn(attrs);
        when(session.isOpen()).thenReturn(true);
    }

    private RoomDto createRoom(String id, RoomType type) {
        RoomDto room = new RoomDto(id, "Room", type, "system", "2026-01-01 12:00:00");
        room.setMembers(new CopyOnWriteArraySet<>(Set.of("alice", "bob")));
        return room;
    }
}
