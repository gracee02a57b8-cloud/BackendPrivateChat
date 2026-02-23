package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.repository.CallLogRepository;
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
    @Mock private ConferenceService conferenceService;
    @Mock private CallLogRepository callLogRepository;
    @Mock private WebPushService webPushService;
    @Mock private WebSocketSession session;

    private ChatWebSocketHandler handler;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        handler = new ChatWebSocketHandler(chatService, jwtService, roomService, schedulerService, taskService, conferenceService, callLogRepository, webPushService);
    }

    // === Connection ===

    @Test
    @DisplayName("afterConnectionEstablished - valid token connects user")
    void connect_validToken() throws Exception {
        setupSession("session1", "alice", "valid-token");
        when(jwtService.isTokenValid("valid-token")).thenReturn(true);
        when(jwtService.extractUsername("valid-token")).thenReturn("alice");

        handler.afterConnectionEstablished(session);

        verify(chatService).addUser("alice");
    }

    @Test
    @DisplayName("afterConnectionEstablished - does NOT auto-join general room (Bug 2)")
    void connect_doesNotJoinGeneral() throws Exception {
        setupSession("session1", "alice", "valid-token");
        when(jwtService.isTokenValid("valid-token")).thenReturn(true);
        when(jwtService.extractUsername("valid-token")).thenReturn("alice");

        handler.afterConnectionEstablished(session);

        verify(roomService, never()).joinRoom(eq("general"), anyString());
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

    // === VOICE message type preservation ===

    @Test
    @DisplayName("handleTextMessage - preserves VOICE type from frontend")
    void handleMessage_voiceTypePreserved() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto incoming = new MessageDto();
        incoming.setContent(null);
        incoming.setRoomId("general");
        incoming.setType(MessageType.VOICE);
        incoming.setFileUrl("/uploads/voice_123.webm");
        incoming.setDuration(15);
        incoming.setWaveform("[0.1,0.5,0.8]");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService).send(eq("general"), argThat(msg ->
                MessageType.VOICE == msg.getType() &&
                "alice".equals(msg.getSender()) &&
                Integer.valueOf(15).equals(msg.getDuration()) &&
                "[0.1,0.5,0.8]".equals(msg.getWaveform())
        ));
    }

    // === VIDEO_CIRCLE message type preservation ===

    @Test
    @DisplayName("handleTextMessage - preserves VIDEO_CIRCLE type from frontend")
    void handleMessage_videoCircleTypePreserved() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto incoming = new MessageDto();
        incoming.setContent(null);
        incoming.setRoomId("general");
        incoming.setType(MessageType.VIDEO_CIRCLE);
        incoming.setFileUrl("/uploads/video_circle_123.webm");
        incoming.setDuration(25);
        incoming.setThumbnailUrl("/uploads/thumb_123.jpg");

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService).send(eq("general"), argThat(msg ->
                MessageType.VIDEO_CIRCLE == msg.getType() &&
                "alice".equals(msg.getSender()) &&
                Integer.valueOf(25).equals(msg.getDuration()) &&
                "/uploads/thumb_123.jpg".equals(msg.getThumbnailUrl())
        ));
    }

    @Test
    @DisplayName("handleTextMessage - non-VOICE/VIDEO_CIRCLE type forced to CHAT")
    void handleMessage_unknownTypeForcedToChat() throws Exception {
        setupConnectedSession("session1", "alice");

        RoomDto room = createRoom("general", RoomType.GENERAL);
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto incoming = new MessageDto();
        incoming.setContent("Hello");
        incoming.setRoomId("general");
        incoming.setType(MessageType.JOIN); // trying to send JOIN from frontend

        handler.handleTextMessage(session, new TextMessage(objectMapper.writeValueAsString(incoming)));

        verify(chatService).send(eq("general"), argThat(msg ->
                MessageType.CHAT == msg.getType()
        ));
    }

    @Test
    @DisplayName("afterConnectionClosed - removes user and broadcasts leave")
    void disconnect_removesUser() throws Exception {
        // First connect
        setupSession("session1", "alice", "valid-token");
        when(jwtService.isTokenValid("valid-token")).thenReturn(true);
        when(jwtService.extractUsername("valid-token")).thenReturn("alice");

        handler.afterConnectionEstablished(session);
        reset(chatService);

        // Then disconnect
        handler.afterConnectionClosed(session, CloseStatus.NORMAL);

        verify(chatService).removeUser("alice");
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

    // ──── Helper: connect two users so both are in userSessions ────

    private WebSocketSession connectUser(String sessionId, String username, String token) throws Exception {
        WebSocketSession s = mock(WebSocketSession.class);
        Map<String, Object> attrs = new HashMap<>();
        when(s.getId()).thenReturn(sessionId);
        when(s.getAttributes()).thenReturn(attrs);
        when(s.getUri()).thenReturn(new URI("ws://localhost/ws/chat?token=" + token));
        when(s.isOpen()).thenReturn(true);
        when(jwtService.isTokenValid(token)).thenReturn(true);
        when(jwtService.extractUsername(token)).thenReturn(username);

        handler.afterConnectionEstablished(s);
        return s;
    }

    // === CALL SIGNALING TESTS ===

    @Test
    @DisplayName("CALL_OFFER - relays offer to target user")
    void callOffer_relaysToTarget() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        // Alice sends CALL_OFFER to Bob
        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "audio");
        extra.put("sdp", "{\"type\":\"offer\",\"sdp\":\"v=0...\"}");
        offer.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Bob should receive the offer
        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_OFFER\"")
                    && payload.contains("\"sender\":\"alice\"")
                    && payload.contains("\"sdp\"");
        }));

        // Alice should NOT receive the offer
        verify(aliceSession, never()).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_OFFER\"");
        }));
    }

    @Test
    @DisplayName("CALL_OFFER - returns CALL_END when target is offline")
    void callOffer_targetOffline_sendsEnd() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        // Bob is NOT connected

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "video");
        extra.put("sdp", "{\"type\":\"offer\"}");
        offer.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Alice should receive CALL_END with reason "unavailable"
        verify(aliceSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_END\"")
                    && payload.contains("\"reason\":\"unavailable\"");
        }));
    }

    @Test
    @DisplayName("CALL_ANSWER - relays answer to caller")
    void callAnswer_relaysToCaller() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        // Bob sends CALL_ANSWER to Alice
        MessageDto answer = new MessageDto();
        answer.setType(MessageType.CALL_ANSWER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "alice");
        extra.put("sdp", "{\"type\":\"answer\",\"sdp\":\"v=0...\"}");
        answer.setExtra(extra);

        handler.handleTextMessage(bobSession, new TextMessage(objectMapper.writeValueAsString(answer)));

        // Alice should receive the answer
        verify(aliceSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_ANSWER\"")
                    && payload.contains("\"sender\":\"bob\"");
        }));
    }

    @Test
    @DisplayName("ICE_CANDIDATE - relays candidate to target")
    void iceCandidate_relaysToTarget() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        MessageDto ice = new MessageDto();
        ice.setType(MessageType.ICE_CANDIDATE);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("candidate", "{\"candidate\":\"candidate:...\"}");
        ice.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(ice)));

        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"ICE_CANDIDATE\"")
                    && payload.contains("\"candidate\"");
        }));
    }

    @Test
    @DisplayName("CALL_REJECT - relays reject to caller")
    void callReject_relaysToCaller() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        MessageDto reject = new MessageDto();
        reject.setType(MessageType.CALL_REJECT);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "alice");
        reject.setExtra(extra);

        handler.handleTextMessage(bobSession, new TextMessage(objectMapper.writeValueAsString(reject)));

        verify(aliceSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_REJECT\"")
                    && payload.contains("\"sender\":\"bob\"");
        }));
    }

    @Test
    @DisplayName("CALL_END - relays end to peer")
    void callEnd_relaysToPeer() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        MessageDto end = new MessageDto();
        end.setType(MessageType.CALL_END);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("reason", "hangup");
        end.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(end)));

        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_END\"")
                    && payload.contains("\"reason\":\"hangup\"");
        }));
    }

    @Test
    @DisplayName("CALL_BUSY - relays busy to caller")
    void callBusy_relaysToCaller() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        MessageDto busy = new MessageDto();
        busy.setType(MessageType.CALL_BUSY);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "alice");
        busy.setExtra(extra);

        handler.handleTextMessage(bobSession, new TextMessage(objectMapper.writeValueAsString(busy)));

        verify(aliceSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_BUSY\"");
        }));
    }

    @Test
    @DisplayName("Call signaling - missing extra field is ignored")
    void callSignaling_noExtra_ignored() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        // No extra → should not crash

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));
        // No exception is success
    }

    @Test
    @DisplayName("Call signaling - missing target in extra is ignored")
    void callSignaling_noTarget_ignored() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        offer.setExtra(new HashMap<>());  // extra exists but no "target"

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));
        // No exception is success
    }

    @Test
    @DisplayName("CALL_OFFER with video callType - relays correctly")
    void callOffer_video_relaysCorrectly() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "video");
        extra.put("sdp", "{\"type\":\"offer\"}");
        offer.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"callType\":\"video\"");
        }));
    }

    @Test
    @DisplayName("CALL_OFFER with large video SDP payload (E2E encrypted) - relays successfully")
    void callOffer_largeVideoPayload_relaysSuccessfully() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        // Simulate a video CALL_OFFER with E2E encrypted SDP (~12KB payload)
        // This is the exact scenario that failed with default 8KB buffer
        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        // Simulate E2E encrypted signaling fields (base64-encoded, large)
        extra.put("sig_enc", "A".repeat(8000)); // ~8KB encrypted SDP (video is larger than audio)
        extra.put("sig_iv", "iv-base64-data");
        extra.put("sig_rk", "ratchetKey-base64-data");
        extra.put("sig_n", "42");
        extra.put("sig_pn", "3");
        offer.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Bob should receive the entire large payload intact
        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_OFFER\"")
                    && payload.contains("\"sender\":\"alice\"")
                    && payload.contains("\"sig_enc\"")
                    && payload.length() > 8000; // Must be >8KB to test the fix
        }));
    }

    @Test
    @DisplayName("CALL_ANSWER with large video SDP payload - relays successfully")
    void callAnswer_largeVideoPayload_relaysSuccessfully() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        MessageDto answer = new MessageDto();
        answer.setType(MessageType.CALL_ANSWER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "alice");
        extra.put("sig_enc", "B".repeat(8000));
        extra.put("sig_iv", "iv-data");
        extra.put("sig_rk", "rk-data");
        answer.setExtra(extra);

        handler.handleTextMessage(bobSession, new TextMessage(objectMapper.writeValueAsString(answer)));

        verify(aliceSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_ANSWER\"")
                    && payload.contains("\"sender\":\"bob\"")
                    && payload.length() > 8000;
        }));
    }

    @Test
    @DisplayName("CALL_OFFER audio vs video - both relay with all extra fields preserved")
    void callOffer_audioAndVideo_bothPreserveAllFields() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        // Audio call offer (small SDP)
        MessageDto audioOffer = new MessageDto();
        audioOffer.setType(MessageType.CALL_OFFER);
        Map<String, String> audioExtra = new HashMap<>();
        audioExtra.put("target", "bob");
        audioExtra.put("callType", "audio");
        audioExtra.put("sdp", "{\"type\":\"offer\",\"sdp\":\"v=0\\r\\no=- audio\"}");
        audioExtra.put("mediaKey", "audio-media-key-base64");
        audioOffer.setExtra(audioExtra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(audioOffer)));

        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"callType\":\"audio\"")
                    && payload.contains("\"mediaKey\":\"audio-media-key-base64\"");
        }));

        reset(bobSession);
        when(bobSession.isOpen()).thenReturn(true);

        // Video call offer (large SDP)
        MessageDto videoOffer = new MessageDto();
        videoOffer.setType(MessageType.CALL_OFFER);
        Map<String, String> videoExtra = new HashMap<>();
        videoExtra.put("target", "bob");
        videoExtra.put("callType", "video");
        videoExtra.put("sdp", "{\"type\":\"offer\",\"sdp\":\"v=0\\r\\nm=audio\\r\\nm=video\\r\\n" + "x".repeat(3000) + "\"}");
        videoExtra.put("mediaKey", "video-media-key-base64");
        videoOffer.setExtra(videoExtra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(videoOffer)));

        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"callType\":\"video\"")
                    && payload.contains("\"mediaKey\":\"video-media-key-base64\"")
                    && payload.contains("m=video");
        }));
    }

    // === GROUP_KEY RELAY TESTS ===

    @Test
    @DisplayName("GROUP_KEY - relays encrypted group key to target user")
    void groupKey_relaysToTarget() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        // Alice sends GROUP_KEY to Bob (distributing group encryption key)
        MessageDto groupKeyMsg = new MessageDto();
        groupKeyMsg.setType(MessageType.GROUP_KEY);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("roomId", "group-room-1");
        groupKeyMsg.setExtra(extra);
        // E2E encrypted payload (group key encrypted with pairwise Double Ratchet)
        groupKeyMsg.setEncryptedContent("base64-encrypted-group-key");
        groupKeyMsg.setIv("base64-iv");
        groupKeyMsg.setRatchetKey("base64-rk");

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(groupKeyMsg)));

        // Bob should receive the GROUP_KEY
        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"GROUP_KEY\"")
                    && payload.contains("\"sender\":\"alice\"")
                    && payload.contains("\"roomId\":\"group-room-1\"");
        }));

        // Alice should NOT receive the GROUP_KEY
        verify(aliceSession, never()).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"GROUP_KEY\"");
        }));
    }

    @Test
    @DisplayName("GROUP_KEY - target offline does not crash")
    void groupKey_targetOffline_noCrash() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        // Bob is NOT connected

        MessageDto groupKeyMsg = new MessageDto();
        groupKeyMsg.setType(MessageType.GROUP_KEY);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("roomId", "group-room-2");
        groupKeyMsg.setExtra(extra);

        // Should not throw
        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(groupKeyMsg)));
    }

    @Test
    @DisplayName("GROUP_KEY - preserves E2E encryption fields during relay")
    void groupKey_preservesE2eFields() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        MessageDto groupKeyMsg = new MessageDto();
        groupKeyMsg.setType(MessageType.GROUP_KEY);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("roomId", "group-room-3");
        groupKeyMsg.setExtra(extra);
        groupKeyMsg.setEncryptedContent("enc-payload");
        groupKeyMsg.setIv("iv-data");
        groupKeyMsg.setRatchetKey("rk-data");
        groupKeyMsg.setMessageNumber(5);
        groupKeyMsg.setPreviousChainLength(2);
        groupKeyMsg.setEphemeralKey("ek-data");
        groupKeyMsg.setSenderIdentityKey("sik-data");

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(groupKeyMsg)));

        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"encryptedContent\":\"enc-payload\"")
                    && payload.contains("\"iv\":\"iv-data\"")
                    && payload.contains("\"ratchetKey\":\"rk-data\"");
        }));
    }

    @Test
    @DisplayName("GROUP_KEY - missing extra field is handled gracefully")
    void groupKey_noExtra_ignored() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");

        MessageDto groupKeyMsg = new MessageDto();
        groupKeyMsg.setType(MessageType.GROUP_KEY);
        // No extra → should not crash

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(groupKeyMsg)));
        // No exception is success
    }

    @Test
    @DisplayName("GROUP_KEY - missing target in extra is handled gracefully")
    void groupKey_noTarget_ignored() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");

        MessageDto groupKeyMsg = new MessageDto();
        groupKeyMsg.setType(MessageType.GROUP_KEY);
        groupKeyMsg.setExtra(new HashMap<>()); // extra exists but no "target"

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(groupKeyMsg)));
        // No exception is success
    }

    // ======================================================================
    // ===                    CALL PUSH & LOGGING TESTS                   ===
    // ======================================================================

    @Test
    @DisplayName("CALL_OFFER - always sends push notification to target (online or offline)")
    void callOffer_alwaysSendsPush() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "audio");
        extra.put("sdp", "{\"type\":\"offer\"}");
        offer.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Push should be sent even though Bob is online
        verify(webPushService).sendPushToUserAsync(eq("bob"),
                eq("📞 Входящий звонок"),
                eq("alice звонит вам"),
                eq("call"), isNull());
    }

    @Test
    @DisplayName("CALL_OFFER - sends push when target is offline")
    void callOffer_sendsPushWhenOffline() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        // Bob is NOT connected

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "video");
        extra.put("sdp", "{\"type\":\"offer\"}");
        offer.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Push should be sent for the call
        verify(webPushService).sendPushToUserAsync(eq("bob"),
                eq("📞 Входящий звонок"),
                eq("alice звонит вам"),
                eq("call"), isNull());
    }

    @Test
    @DisplayName("CALL_OFFER - saves call log when target is unavailable")
    void callOffer_unavailable_savesCallLog() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        // Bob not connected

        RoomDto privateRoom = createRoom("private-ab", RoomType.PRIVATE);
        when(roomService.getOrCreatePrivateRoom("alice", "bob")).thenReturn(privateRoom);

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "audio");
        offer.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Should save call log with status "unavailable"
        verify(callLogRepository).save(argThat(log ->
                "alice".equals(log.getCaller()) &&
                "bob".equals(log.getCallee()) &&
                "unavailable".equals(log.getStatus()) &&
                "audio".equals(log.getCallType()) &&
                log.getDuration() == 0
        ));
    }

    @Test
    @DisplayName("CALL_REJECT - saves call log with rejected status")
    void callReject_savesCallLog() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        RoomDto privateRoom = createRoom("private-ab", RoomType.PRIVATE);
        when(roomService.getOrCreatePrivateRoom(anyString(), anyString())).thenReturn(privateRoom);

        // Alice calls Bob first (CALL_OFFER to set up tracking)
        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "video");
        offer.setExtra(extra);
        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Bob rejects the call
        MessageDto reject = new MessageDto();
        reject.setType(MessageType.CALL_REJECT);
        Map<String, String> rejectExtra = new HashMap<>();
        rejectExtra.put("target", "alice");
        reject.setExtra(rejectExtra);
        handler.handleTextMessage(bobSession, new TextMessage(objectMapper.writeValueAsString(reject)));

        // Should save call log with status "rejected"
        verify(callLogRepository, atLeastOnce()).save(argThat(log ->
                "rejected".equals(log.getStatus())
        ));
    }

    @Test
    @DisplayName("CALL_BUSY - saves call log with busy status")
    void callBusy_savesCallLog() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        RoomDto privateRoom = createRoom("private-ab", RoomType.PRIVATE);
        when(roomService.getOrCreatePrivateRoom(anyString(), anyString())).thenReturn(privateRoom);

        // Alice calls Bob
        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "audio");
        offer.setExtra(extra);
        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Bob is busy
        MessageDto busy = new MessageDto();
        busy.setType(MessageType.CALL_BUSY);
        Map<String, String> busyExtra = new HashMap<>();
        busyExtra.put("target", "alice");
        busy.setExtra(busyExtra);
        handler.handleTextMessage(bobSession, new TextMessage(objectMapper.writeValueAsString(busy)));

        verify(callLogRepository, atLeastOnce()).save(argThat(log ->
                "busy".equals(log.getStatus())
        ));
    }

    @Test
    @DisplayName("CALL_END with hangup - saves call log with completed status")
    void callEnd_hangup_savesCompletedLog() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        RoomDto privateRoom = createRoom("private-ab", RoomType.PRIVATE);
        when(roomService.getOrCreatePrivateRoom(anyString(), anyString())).thenReturn(privateRoom);

        // Alice calls Bob
        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "video");
        offer.setExtra(extra);
        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Alice hangs up
        MessageDto end = new MessageDto();
        end.setType(MessageType.CALL_END);
        Map<String, String> endExtra = new HashMap<>();
        endExtra.put("target", "bob");
        endExtra.put("reason", "hangup");
        end.setExtra(endExtra);
        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(end)));

        verify(callLogRepository, atLeastOnce()).save(argThat(log ->
                "completed".equals(log.getStatus())
        ));
    }

    @Test
    @DisplayName("Call log saves CALL_LOG message to private room")
    void callLog_savesMessageToPrivateRoom() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        // Bob not connected

        RoomDto privateRoom = createRoom("private-ab", RoomType.PRIVATE);
        when(roomService.getOrCreatePrivateRoom("alice", "bob")).thenReturn(privateRoom);

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "audio");
        offer.setExtra(extra);
        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Should save a CALL_LOG message to the private room
        verify(chatService).send(eq("private-ab"), argThat(msg ->
                msg.getType() == MessageType.CALL_LOG &&
                "alice".equals(msg.getSender()) &&
                msg.getContent().contains("не в сети")
        ));
    }

    @Test
    @DisplayName("Call log message is broadcast to room members")
    void callLog_broadcastsToRoom() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        RoomDto privateRoom = createRoom("private-ab", RoomType.PRIVATE);
        when(roomService.getOrCreatePrivateRoom(anyString(), anyString())).thenReturn(privateRoom);
        when(roomService.getRoomById("private-ab")).thenReturn(privateRoom);

        // Alice calls Bob, Bob rejects
        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "audio");
        offer.setExtra(extra);
        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        MessageDto reject = new MessageDto();
        reject.setType(MessageType.CALL_REJECT);
        Map<String, String> rejectExtra = new HashMap<>();
        rejectExtra.put("target", "alice");
        reject.setExtra(rejectExtra);
        handler.handleTextMessage(bobSession, new TextMessage(objectMapper.writeValueAsString(reject)));

        // Both users should receive the CALL_LOG message broadcast
        verify(aliceSession, atLeastOnce()).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_LOG\"");
        }));
        verify(bobSession, atLeastOnce()).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CALL_LOG\"");
        }));
    }

    @Test
    @DisplayName("CALL_LOG message contains call details in extra")
    void callLog_containsCallDetails() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");

        RoomDto privateRoom = createRoom("private-ab", RoomType.PRIVATE);
        when(roomService.getOrCreatePrivateRoom("alice", "bob")).thenReturn(privateRoom);

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CALL_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("callType", "video");
        offer.setExtra(extra);
        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Verify the CALL_LOG message has proper extra fields
        verify(chatService).send(eq("private-ab"), argThat(msg -> {
            if (msg.getType() != MessageType.CALL_LOG) return false;
            Map<String, String> msgExtra = msg.getExtra();
            return msgExtra != null &&
                    "video".equals(msgExtra.get("callType")) &&
                    "unavailable".equals(msgExtra.get("status")) &&
                    "alice".equals(msgExtra.get("caller")) &&
                    "bob".equals(msgExtra.get("callee"));
        }));
    }

    // ======================================================================
    // ===                   CONFERENCE SIGNALING TESTS                   ===
    // ======================================================================

    @Test
    @DisplayName("CONF_JOIN - notifies existing participants")
    void confJoin_notifiesExistingParticipants() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        String confId = "conf-123";
        when(conferenceService.joinConference(confId, "bob")).thenReturn(true);
        when(conferenceService.getParticipants(confId)).thenReturn(Set.of("alice", "bob"));

        MessageDto joinMsg = new MessageDto();
        joinMsg.setType(MessageType.CONF_JOIN);
        Map<String, String> extra = new HashMap<>();
        extra.put("confId", confId);
        joinMsg.setExtra(extra);

        handler.handleTextMessage(bobSession, new TextMessage(objectMapper.writeValueAsString(joinMsg)));

        // Alice should receive CONF_JOIN broadcast
        verify(aliceSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_JOIN\"")
                    && payload.contains("\"sender\":\"bob\"");
        }));

        // Bob should receive CONF_PEERS
        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_PEERS\"")
                    && payload.contains("alice");
        }));
    }

    @Test
    @DisplayName("CONF_JOIN - conference full returns error")
    void confJoin_full_sendsError() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");

        String confId = "conf-full";
        when(conferenceService.joinConference(confId, "alice")).thenReturn(false);

        MessageDto joinMsg = new MessageDto();
        joinMsg.setType(MessageType.CONF_JOIN);
        Map<String, String> extra = new HashMap<>();
        extra.put("confId", confId);
        joinMsg.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(joinMsg)));

        // Alice should get CONF_LEAVE with reason "full"
        verify(aliceSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_LEAVE\"")
                    && payload.contains("\"reason\":\"full\"");
        }));
    }

    @Test
    @DisplayName("CONF_LEAVE - notifies remaining participants")
    void confLeave_notifiesRemaining() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        String confId = "conf-456";
        when(conferenceService.getUserConference("alice")).thenReturn(null);
        when(conferenceService.getParticipants(confId)).thenReturn(new java.util.LinkedHashSet<>(List.of("alice", "bob")));

        MessageDto leaveMsg = new MessageDto();
        leaveMsg.setType(MessageType.CONF_LEAVE);
        Map<String, String> extra = new HashMap<>();
        extra.put("confId", confId);
        leaveMsg.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(leaveMsg)));

        // Bob should receive CONF_LEAVE from Alice
        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_LEAVE\"")
                    && payload.contains("\"sender\":\"alice\"");
        }));
    }

    @Test
    @DisplayName("CONF_OFFER - relays to target within conference")
    void confOffer_relaysToTarget() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        String confId = "conf-789";
        when(conferenceService.isInConference(confId, "alice")).thenReturn(true);
        when(conferenceService.isInConference(confId, "bob")).thenReturn(true);

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CONF_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("confId", confId);
        extra.put("sdp", "{\"type\":\"offer\"}");
        extra.put("callType", "video");
        offer.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_OFFER\"")
                    && payload.contains("\"sender\":\"alice\"")
                    && payload.contains("\"sdp\"");
        }));
    }

    @Test
    @DisplayName("CONF_OFFER - rejected when user is not in conference")
    void confOffer_notInConference_rejected() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        String confId = "conf-789";
        when(conferenceService.isInConference(confId, "alice")).thenReturn(true);
        when(conferenceService.isInConference(confId, "bob")).thenReturn(false);

        MessageDto offer = new MessageDto();
        offer.setType(MessageType.CONF_OFFER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("confId", confId);
        extra.put("sdp", "{\"type\":\"offer\"}");
        offer.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(offer)));

        // Bob should NOT receive the offer
        verify(bobSession, never()).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_OFFER\"");
        }));
    }

    @Test
    @DisplayName("CONF_ANSWER - relays to target within conference")
    void confAnswer_relaysToTarget() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        String confId = "conf-789";
        when(conferenceService.isInConference(confId, "alice")).thenReturn(true);
        when(conferenceService.isInConference(confId, "bob")).thenReturn(true);

        MessageDto answer = new MessageDto();
        answer.setType(MessageType.CONF_ANSWER);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "alice");
        extra.put("confId", confId);
        extra.put("sdp", "{\"type\":\"answer\"}");
        answer.setExtra(extra);

        handler.handleTextMessage(bobSession, new TextMessage(objectMapper.writeValueAsString(answer)));

        verify(aliceSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_ANSWER\"")
                    && payload.contains("\"sender\":\"bob\"");
        }));
    }

    @Test
    @DisplayName("CONF_ICE - relays ICE candidate to target")
    void confIce_relaysToTarget() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        String confId = "conf-789";
        when(conferenceService.isInConference(confId, "alice")).thenReturn(true);
        when(conferenceService.isInConference(confId, "bob")).thenReturn(true);

        MessageDto ice = new MessageDto();
        ice.setType(MessageType.CONF_ICE);
        Map<String, String> extra = new HashMap<>();
        extra.put("target", "bob");
        extra.put("confId", confId);
        extra.put("candidate", "{\"candidate\":\"...\"}");
        ice.setExtra(extra);

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(ice)));

        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_ICE\"")
                    && payload.contains("\"candidate\"");
        }));
    }

    @Test
    @DisplayName("CONF_JOIN - missing confId is handled gracefully")
    void confJoin_noConfId_ignored() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");

        MessageDto joinMsg = new MessageDto();
        joinMsg.setType(MessageType.CONF_JOIN);
        joinMsg.setExtra(new HashMap<>()); // no confId

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(joinMsg)));
        // No exception is success
        verify(conferenceService, never()).joinConference(anyString(), anyString());
    }

    @Test
    @DisplayName("CONF_LEAVE - missing confId looks up user conference")
    void confLeave_noConfId_looksUp() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");

        when(conferenceService.getUserConference("alice")).thenReturn("conf-auto");
        when(conferenceService.getParticipants("conf-auto")).thenReturn(new java.util.LinkedHashSet<>(List.of("alice")));

        MessageDto leaveMsg = new MessageDto();
        leaveMsg.setType(MessageType.CONF_LEAVE);
        leaveMsg.setExtra(new HashMap<>()); // no confId → should look up

        handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(leaveMsg)));

        verify(conferenceService).leaveConference("alice");
    }

    @Test
    @DisplayName("CONF_OFFER/ANSWER/ICE - missing extra is handled gracefully")
    void confSignaling_noExtra_ignored() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");

        for (MessageType type : List.of(MessageType.CONF_OFFER, MessageType.CONF_ANSWER, MessageType.CONF_ICE)) {
            MessageDto msg = new MessageDto();
            msg.setType(type);
            // No extra

            handler.handleTextMessage(aliceSession, new TextMessage(objectMapper.writeValueAsString(msg)));
            // No exception is success
        }
    }

    @Test
    @DisplayName("Auto-leave conference on disconnect")
    void disconnect_autoLeavesConference() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");

        String confId = "conf-auto-leave";
        when(conferenceService.getUserConference("alice")).thenReturn(confId);
        when(conferenceService.getParticipants(confId)).thenReturn(new java.util.LinkedHashSet<>(List.of("alice", "bob")));

        handler.afterConnectionClosed(aliceSession, CloseStatus.NORMAL);

        // Should auto-leave conference
        verify(conferenceService).leaveConference("alice");

        // Bob should receive CONF_LEAVE
        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_LEAVE\"")
                    && payload.contains("\"sender\":\"alice\"");
        }));
    }

    @Test
    @DisplayName("Multiple participants conference - join sends CONF_PEERS with all existing peers")
    void confJoin_multipleParticipants_sendsPeersList() throws Exception {
        WebSocketSession aliceSession = connectUser("s1", "alice", "token-a");
        WebSocketSession bobSession = connectUser("s2", "bob", "token-b");
        WebSocketSession charlieSession = connectUser("s3", "charlie", "token-c");

        String confId = "conf-multi";
        when(conferenceService.joinConference(confId, "charlie")).thenReturn(true);
        when(conferenceService.getParticipants(confId)).thenReturn(Set.of("alice", "bob", "charlie"));

        MessageDto joinMsg = new MessageDto();
        joinMsg.setType(MessageType.CONF_JOIN);
        Map<String, String> extra = new HashMap<>();
        extra.put("confId", confId);
        joinMsg.setExtra(extra);

        handler.handleTextMessage(charlieSession, new TextMessage(objectMapper.writeValueAsString(joinMsg)));

        // Charlie should receive CONF_PEERS with alice and bob
        verify(charlieSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_PEERS\"")
                    && payload.contains("alice")
                    && payload.contains("bob");
        }));

        // Alice and Bob should receive CONF_JOIN from charlie
        verify(aliceSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_JOIN\"")
                    && payload.contains("\"sender\":\"charlie\"");
        }));
        verify(bobSession).sendMessage(argThat(msg -> {
            String payload = ((TextMessage) msg).getPayload();
            return payload.contains("\"type\":\"CONF_JOIN\"")
                    && payload.contains("\"sender\":\"charlie\"");
        }));
    }
}
