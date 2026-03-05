package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.repository.BlockedUserRepository;
import com.example.webrtcchat.repository.CallLogRepository;
import com.example.webrtcchat.service.*;
import com.example.webrtcchat.types.MessageType;
import com.example.webrtcchat.types.RoomType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for B3: async WS message processing via virtual thread executor.
 * Verifies PING stays on WS thread (fast path) and CHAT messages offload to virtual threads.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AsyncWebSocketTest {

    @Mock private ChatService chatService;
    @Mock private JwtService jwtService;
    @Mock private RoomService roomService;
    @Mock private SchedulerService schedulerService;
    @Mock private TaskService taskService;
    @Mock private ConferenceService conferenceService;
    @Mock private CallLogRepository callLogRepository;
    @Mock private WebPushService webPushService;
    @Mock private BlockedUserRepository blockedUserRepository;
    @Mock private StoryService storyService;
    @Mock private ReactionService reactionService;
    @Mock private WebSocketSession session;

    private ChatWebSocketHandler handler;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        handler = new ChatWebSocketHandler(chatService, jwtService, roomService,
                schedulerService, taskService, conferenceService, callLogRepository,
                webPushService, blockedUserRepository, storyService, reactionService);

        // Default session setup
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("username", "alice");
        when(session.getAttributes()).thenReturn(attrs);
        when(session.getId()).thenReturn("session1");
        when(session.isOpen()).thenReturn(true);
    }

    @Test
    @DisplayName("B3: PING is handled synchronously on WS thread (fast path)")
    void ping_handledSynchronously() throws Exception {
        String pingJson = objectMapper.writeValueAsString(Map.of("type", "PING"));
        TextMessage msg = new TextMessage(pingJson);

        handler.handleTextMessage(session, msg);

        // PONG should be sent immediately (synchronously, same thread)
        verify(session).sendMessage(argThat(m ->
                m instanceof TextMessage && ((TextMessage) m).getPayload().contains("PONG")));
    }

    @Test
    @DisplayName("B3: CHAT message offloaded to virtual thread (async)")
    void chatMessage_offloadedAsync() throws Exception {
        RoomDto room = new RoomDto("room1", "Test", RoomType.ROOM, "system", "2026-01-01 12:00:00");
        room.setMembers(new LinkedHashSet<>(Set.of("alice", "bob")));
        when(roomService.getRoomById("room1")).thenReturn(room);

        String chatJson = objectMapper.writeValueAsString(Map.of(
                "type", "CHAT",
                "content", "Hello",
                "roomId", "room1"
        ));

        handler.handleTextMessage(session, new TextMessage(chatJson));

        // Wait for virtual thread to process (async)
        Thread.sleep(500);

        verify(chatService).send(eq("room1"), argThat(m ->
                m.getSender().equals("alice") && m.getContent().equals("Hello")));
    }

    @Test
    @DisplayName("B3: submitToExecutor can be overridden for synchronous testing")
    void submitToExecutor_overrideForSync() throws Exception {
        ChatWebSocketHandler syncHandler = new ChatWebSocketHandler(chatService, jwtService, roomService,
                schedulerService, taskService, conferenceService, callLogRepository,
                webPushService, blockedUserRepository, storyService, reactionService) {
            @Override
            protected void submitToExecutor(Runnable task) {
                task.run(); // synchronous
            }
        };

        RoomDto room = new RoomDto("room1", "Test", RoomType.ROOM, "system", "2026-01-01 12:00:00");
        room.setMembers(new LinkedHashSet<>(Set.of("alice", "bob")));
        when(roomService.getRoomById("room1")).thenReturn(room);

        String chatJson = objectMapper.writeValueAsString(Map.of(
                "type", "CHAT",
                "content", "Sync test",
                "roomId", "room1"
        ));

        syncHandler.handleTextMessage(session, new TextMessage(chatJson));

        // No Thread.sleep needed — verify immediately
        verify(chatService).send(eq("room1"), argThat(m ->
                m.getContent().equals("Sync test")));
    }

    @Test
    @DisplayName("B3: null username messages are ignored immediately")
    void nullUsername_ignoredImmediately() throws Exception {
        Map<String, Object> noUserAttrs = new HashMap<>();
        when(session.getAttributes()).thenReturn(noUserAttrs);

        handler.handleTextMessage(session, new TextMessage("{\"type\":\"CHAT\",\"content\":\"test\",\"roomId\":\"r1\"}"));

        // Should not even try to parse or process
        Thread.sleep(100);
        verify(chatService, never()).send(anyString(), any());
    }

    @Test
    @DisplayName("B3: oversized messages rejected before async offload")
    void oversizedMessage_rejectedSynchronously() throws Exception {
        // Create a message > 50,000 bytes
        char[] large = new char[51_000];
        Arrays.fill(large, 'x');
        TextMessage bigMsg = new TextMessage(new String(large));

        handler.handleTextMessage(session, bigMsg);

        Thread.sleep(100);
        verify(chatService, never()).send(anyString(), any());
    }

    @Test
    @DisplayName("B3: TYPING offloaded to virtual thread correctly")
    void typing_offloadedAsync() throws Exception {
        RoomDto room = new RoomDto("room1", "Test", RoomType.ROOM, "system", "2026-01-01 12:00:00");
        room.setMembers(new LinkedHashSet<>(Set.of("alice", "bob")));
        when(roomService.getRoomById("room1")).thenReturn(room);

        String typingJson = objectMapper.writeValueAsString(Map.of(
                "type", "TYPING",
                "roomId", "room1"
        ));

        handler.handleTextMessage(session, new TextMessage(typingJson));

        // TYPING is processed asynchronously now — no errors expected
        Thread.sleep(200);
        // TYPING doesn't call chatService.send, it broadcasts
        verify(chatService, never()).send(anyString(), any());
    }

    @Test
    @DisplayName("B3: invalid JSON handled gracefully in virtual thread")
    void invalidJson_handledGracefully() throws Exception {
        handler.handleTextMessage(session, new TextMessage("{invalid-json}"));

        // Should not throw — error logged in virtual thread
        Thread.sleep(100);
        verify(chatService, never()).send(anyString(), any());
    }
}
