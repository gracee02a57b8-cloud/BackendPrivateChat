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
import java.util.List;
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

    // === TYPING ===

    @Test
    @DisplayName("handleTextMessage - TYPING broadcasts to room members except sender")
    void handleMessage_typing() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("room1", RoomType.ROOM);
        room.setMembers(new CopyOnWriteArraySet<>(Set.of("alice", "bob")));
        when(roomService.getRoomById("room1")).thenReturn(room);

        // Bob's session must exist for broadcast
        WebSocketSession bobSession = mock(WebSocketSession.class);
        when(bobSession.isOpen()).thenReturn(true);
        when(bobSession.getId()).thenReturn("session-bob");
        Map<String, Object> bobAttrs = new HashMap<>();
        bobAttrs.put("username", "bob");
        when(bobSession.getAttributes()).thenReturn(bobAttrs);

        // Connect bob
        when(bobSession.getUri()).thenReturn(new URI("ws://localhost/ws/chat?token=bob-token"));
        when(jwtService.isTokenValid("bob-token")).thenReturn(true);
        when(jwtService.extractUsername("bob-token")).thenReturn("bob");
        when(roomService.joinRoom("general", "bob")).thenReturn(createRoom("general", RoomType.GENERAL));
        handler.afterConnectionEstablished(bobSession);

        MessageDto typing = new MessageDto();
        typing.setType(MessageType.TYPING);
        typing.setRoomId("room1");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(typing)));

        // TYPING should NOT persist
        verify(chatService, never()).send(anyString(), argThat(msg ->
                msg.getType() == MessageType.TYPING));

        // Bob should receive the typing notification
        verify(bobSession, atLeastOnce()).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"TYPING\"") && payload.contains("\"sender\":\"alice\"");
        }));
    }

    // === SCHEDULED ===

    @Test
    @DisplayName("handleTextMessage - SCHEDULED message triggers scheduler")
    void handleMessage_scheduled() throws Exception {
        // Need full connection flow so session is in userSessions map
        setupSession("session1", "alice", "valid-token");
        when(jwtService.isTokenValid("valid-token")).thenReturn(true);
        when(jwtService.extractUsername("valid-token")).thenReturn("alice");

        RoomDto generalRoom = createRoom("general", RoomType.GENERAL);
        when(roomService.joinRoom("general", "alice")).thenReturn(generalRoom);
        when(roomService.getRoomById("general")).thenReturn(generalRoom);
        handler.afterConnectionEstablished(session);

        MessageDto scheduled = new MessageDto();
        scheduled.setType(MessageType.SCHEDULED);
        scheduled.setContent("Future message");
        scheduled.setRoomId("general");
        scheduled.setScheduledAt("2099-12-31 23:59:59");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(scheduled)));

        // Verify scheduler was called
        verify(schedulerService).schedule(anyString(), eq("2099-12-31 23:59:59"), any(Runnable.class));

        // Verify confirmation sent back to sender
        verify(session, atLeastOnce()).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"SCHEDULED\"") && payload.contains("Future message");
        }));
    }

    @Test
    @DisplayName("handleTextMessage - SCHEDULED without scheduledAt is ignored")
    void handleMessage_scheduled_noDate() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto scheduled = new MessageDto();
        scheduled.setType(MessageType.SCHEDULED);
        scheduled.setContent("No date message");
        scheduled.setRoomId("general");
        // scheduledAt is null

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(scheduled)));

        verify(schedulerService, never()).schedule(anyString(), anyString(), any());
    }

    // === READ_RECEIPT ===

    @Test
    @DisplayName("handleTextMessage - READ_RECEIPT marks messages and sends status updates")
    void handleMessage_readReceipt() throws Exception {
        setupConnectedSession("session1", "alice");

        // Setup bob's session (alice reads bob's messages → bob gets status updates)
        WebSocketSession bobSession = mock(WebSocketSession.class);
        when(bobSession.isOpen()).thenReturn(true);
        when(bobSession.getId()).thenReturn("session-bob");
        Map<String, Object> bobAttrs = new HashMap<>();
        bobAttrs.put("username", "bob");
        when(bobSession.getAttributes()).thenReturn(bobAttrs);
        when(bobSession.getUri()).thenReturn(new URI("ws://localhost/ws/chat?token=bob-token"));
        when(jwtService.isTokenValid("bob-token")).thenReturn(true);
        when(jwtService.extractUsername("bob-token")).thenReturn("bob");

        RoomDto generalRoom = createRoom("general", RoomType.GENERAL);
        when(roomService.joinRoom("general", "bob")).thenReturn(generalRoom);
        when(roomService.getRoomById("general")).thenReturn(generalRoom);
        handler.afterConnectionEstablished(bobSession);

        // Mock markMessagesAsRead
        when(chatService.markMessagesAsRead("general", "alice"))
                .thenReturn(java.util.Map.of("bob", List.of("msg-1", "msg-2")));

        MessageDto readReceipt = new MessageDto();
        readReceipt.setType(MessageType.READ_RECEIPT);
        readReceipt.setRoomId("general");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(readReceipt)));

        verify(chatService).markMessagesAsRead("general", "alice");

        // Bob should get STATUS_UPDATE for each message
        verify(bobSession, atLeast(2)).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"STATUS_UPDATE\"") && payload.contains("\"status\":\"READ\"");
        }));
    }

    // === Session Replacement ===

    @Test
    @DisplayName("afterConnectionEstablished - replaces existing session with code 4001")
    void connect_sessionReplacement() throws Exception {
        // First connection
        WebSocketSession firstSession = mock(WebSocketSession.class);
        Map<String, Object> firstAttrs = new HashMap<>();
        when(firstSession.getId()).thenReturn("first-session");
        when(firstSession.getAttributes()).thenReturn(firstAttrs);
        when(firstSession.getUri()).thenReturn(new URI("ws://localhost/ws/chat?token=alice-token"));
        when(firstSession.isOpen()).thenReturn(true);

        when(jwtService.isTokenValid("alice-token")).thenReturn(true);
        when(jwtService.extractUsername("alice-token")).thenReturn("alice");

        RoomDto generalRoom = createRoom("general", RoomType.GENERAL);
        when(roomService.joinRoom("general", "alice")).thenReturn(generalRoom);
        when(roomService.getRoomById("general")).thenReturn(generalRoom);

        handler.afterConnectionEstablished(firstSession);

        // Second connection (same user)
        WebSocketSession secondSession = mock(WebSocketSession.class);
        Map<String, Object> secondAttrs = new HashMap<>();
        when(secondSession.getId()).thenReturn("second-session");
        when(secondSession.getAttributes()).thenReturn(secondAttrs);
        when(secondSession.getUri()).thenReturn(new URI("ws://localhost/ws/chat?token=alice-token"));
        when(secondSession.isOpen()).thenReturn(true);

        handler.afterConnectionEstablished(secondSession);

        // First session should be closed with code 4001
        verify(firstSession).close(argThat(status ->
                status.getCode() == 4001
        ));
    }

    // === Reply Notification ===

    @Test
    @DisplayName("handleTextMessage - CHAT with replyToSender sends REPLY_NOTIFICATION")
    void handleMessage_replyNotification() throws Exception {
        setupConnectedSession("session1", "alice");

        // Bob's session
        WebSocketSession bobSession = mock(WebSocketSession.class);
        when(bobSession.isOpen()).thenReturn(true);
        when(bobSession.getId()).thenReturn("session-bob");
        Map<String, Object> bobAttrs = new HashMap<>();
        bobAttrs.put("username", "bob");
        when(bobSession.getAttributes()).thenReturn(bobAttrs);
        when(bobSession.getUri()).thenReturn(new URI("ws://localhost/ws/chat?token=bob-token"));
        when(jwtService.isTokenValid("bob-token")).thenReturn(true);
        when(jwtService.extractUsername("bob-token")).thenReturn("bob");

        RoomDto generalRoom = createRoom("general", RoomType.GENERAL);
        when(roomService.joinRoom("general", "bob")).thenReturn(generalRoom);
        when(roomService.getRoomById("general")).thenReturn(generalRoom);
        handler.afterConnectionEstablished(bobSession);

        // Alice sends a reply to Bob's message
        MessageDto reply = new MessageDto();
        reply.setType(MessageType.CHAT);
        reply.setContent("I agree!");
        reply.setRoomId("general");
        reply.setReplyToId("bob-msg-1");
        reply.setReplyToSender("bob");
        reply.setReplyToContent("What do you think?");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(reply)));

        // Bob should get REPLY_NOTIFICATION
        verify(bobSession, atLeastOnce()).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("REPLY_NOTIFICATION");
        }));
    }

    // === Mention Notification ===

    @Test
    @DisplayName("handleTextMessage - CHAT with mentions sends MENTION_NOTIFICATION")
    void handleMessage_mentionNotification() throws Exception {
        setupConnectedSession("session1", "alice");

        // Bob's session
        WebSocketSession bobSession = mock(WebSocketSession.class);
        when(bobSession.isOpen()).thenReturn(true);
        when(bobSession.getId()).thenReturn("session-bob");
        Map<String, Object> bobAttrs = new HashMap<>();
        bobAttrs.put("username", "bob");
        when(bobSession.getAttributes()).thenReturn(bobAttrs);
        when(bobSession.getUri()).thenReturn(new URI("ws://localhost/ws/chat?token=bob-token"));
        when(jwtService.isTokenValid("bob-token")).thenReturn(true);
        when(jwtService.extractUsername("bob-token")).thenReturn("bob");

        RoomDto generalRoom = createRoom("general", RoomType.GENERAL);
        when(roomService.joinRoom("general", "bob")).thenReturn(generalRoom);
        when(roomService.getRoomById("general")).thenReturn(generalRoom);
        handler.afterConnectionEstablished(bobSession);

        // Alice mentions Bob
        MessageDto msg = new MessageDto();
        msg.setType(MessageType.CHAT);
        msg.setContent("Hey @bob check this out");
        msg.setRoomId("general");
        msg.setMentions("[\"bob\"]");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(msg)));

        // Bob should get MENTION_NOTIFICATION
        verify(bobSession, atLeastOnce()).sendMessage(argThat(m -> {
            String payload = ((TextMessage) m).getPayload();
            return payload.contains("MENTION_NOTIFICATION");
        }));
    }

    // === E2E Field Propagation via WebSocket ===

    @Test
    @DisplayName("handleTextMessage - E2E encrypted message fields are saved and broadcast")
    void handleMessage_e2eFieldsBroadcast() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto encrypted = new MessageDto();
        encrypted.setType(MessageType.CHAT);
        encrypted.setContent("[encrypted]");
        encrypted.setRoomId("general");
        encrypted.setEncrypted(true);
        encrypted.setEncryptedContent("cipher-base64");
        encrypted.setIv("iv-base64");
        encrypted.setRatchetKey("ratchet-key-base64");
        encrypted.setMessageNumber(1);
        encrypted.setPreviousChainLength(0);
        encrypted.setEphemeralKey("eph-key-base64");
        encrypted.setSenderIdentityKey("sender-ik-base64");
        encrypted.setOneTimeKeyId(5);

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(encrypted)));

        // Verify E2E fields are passed to chatService.send
        ArgumentCaptor<MessageDto> captor = ArgumentCaptor.forClass(MessageDto.class);
        verify(chatService).send(eq("general"), captor.capture());
        MessageDto saved = captor.getValue();

        assertTrue(saved.isEncrypted());
        assertEquals("cipher-base64", saved.getEncryptedContent());
        assertEquals("iv-base64", saved.getIv());
        assertEquals("ratchet-key-base64", saved.getRatchetKey());
        assertEquals(1, saved.getMessageNumber());
        assertEquals(0, saved.getPreviousChainLength());
        assertEquals("eph-key-base64", saved.getEphemeralKey());
        assertEquals("sender-ik-base64", saved.getSenderIdentityKey());
        assertEquals(5, saved.getOneTimeKeyId());
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
