package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.repository.RoomRepository;
import com.example.webrtcchat.service.*;
import com.example.webrtcchat.types.MessageType;
import com.example.webrtcchat.types.RoomType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller-level performance tests:
 * F1 — lastMessage embedded in GET /api/rooms (eliminates N+1 API calls from frontend)
 */
@WebMvcTest(RoomController.class)
@AutoConfigureMockMvc(addFilters = false)
class PerformanceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean private RoomService roomService;
    @MockBean private ChatService chatService;
    @MockBean private JwtService jwtService;
    @MockBean private MessageRepository messageRepository;
    @MockBean private ChatWebSocketHandler wsHandler;
    @MockBean private RoomMuteService roomMuteService;
    @MockBean private ReadReceiptService readReceiptService;
    @MockBean private LinkPreviewService linkPreviewService;
    @MockBean private RoomRepository roomRepository;

    // ═══════════════════════════════════════════
    // F1: GET /api/rooms embeds lastMessage per room
    // ═══════════════════════════════════════════

    @Nested
    @DisplayName("F1: GET /api/rooms — embedded lastMessage")
    class EmbeddedLastMessage {

        @Test
        @DisplayName("rooms response includes lastMessage with content, created_at, sender_id")
        void includesLastMessage() throws Exception {
            RoomDto room1 = createRoom("room1", "Chat1", RoomType.PRIVATE, Set.of("alice", "bob"));
            RoomDto room2 = createRoom("room2", "Chat2", RoomType.ROOM, Set.of("alice", "charlie"));

            when(roomService.getUserRooms("alice")).thenReturn(List.of(room1, room2));
            when(roomMuteService.getMutedRoomIds("alice")).thenReturn(Set.of());

            MessageEntity msg1 = makeMsg("m1", "room1", "bob", "Hello!", "2026-01-01 12:00:00");
            MessageEntity msg2 = makeMsg("m2", "room2", "charlie", "Hi there", "2026-01-01 13:00:00");

            when(messageRepository.findLastMessagesByRoomIds(List.of("room1", "room2")))
                    .thenReturn(List.of(msg1, msg2));

            mockMvc.perform(get("/api/rooms").principal(() -> "alice"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].lastMessage.content").value("Hello!"))
                    .andExpect(jsonPath("$[0].lastMessage.created_at").value("2026-01-01 12:00:00"))
                    .andExpect(jsonPath("$[0].lastMessage.sender_id").value("bob"))
                    .andExpect(jsonPath("$[1].lastMessage.content").value("Hi there"))
                    .andExpect(jsonPath("$[1].lastMessage.created_at").value("2026-01-01 13:00:00"))
                    .andExpect(jsonPath("$[1].lastMessage.sender_id").value("charlie"));

            // Verify batch query called once (not N times)
            verify(messageRepository, times(1)).findLastMessagesByRoomIds(anyCollection());
        }

        @Test
        @DisplayName("rooms without messages have null lastMessage")
        void noMessages_nullLastMessage() throws Exception {
            RoomDto room = createRoom("room1", "Empty Room", RoomType.ROOM, Set.of("alice"));

            when(roomService.getUserRooms("alice")).thenReturn(List.of(room));
            when(roomMuteService.getMutedRoomIds("alice")).thenReturn(Set.of());
            when(messageRepository.findLastMessagesByRoomIds(List.of("room1")))
                    .thenReturn(List.of()); // no messages

            mockMvc.perform(get("/api/rooms").principal(() -> "alice"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].lastMessage").doesNotExist());
        }

        @Test
        @DisplayName("empty rooms list skips message query")
        void emptyRooms_skipsQuery() throws Exception {
            when(roomService.getUserRooms("alice")).thenReturn(List.of());
            when(roomMuteService.getMutedRoomIds("alice")).thenReturn(Set.of());

            mockMvc.perform(get("/api/rooms").principal(() -> "alice"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));

            // Should NOT call findLastMessagesByRoomIds at all
            verify(messageRepository, never()).findLastMessagesByRoomIds(anyCollection());
        }

        @Test
        @DisplayName("lastMessage handles null content fields gracefully")
        void nullContentFields() throws Exception {
            RoomDto room = createRoom("room1", "Chat", RoomType.PRIVATE, Set.of("alice", "bob"));
            when(roomService.getUserRooms("alice")).thenReturn(List.of(room));
            when(roomMuteService.getMutedRoomIds("alice")).thenReturn(Set.of());

            MessageEntity msg = new MessageEntity();
            msg.setId("m1");
            msg.setRoomId("room1");
            msg.setSender(null);
            msg.setContent(null);
            msg.setTimestamp(null);
            msg.setType(MessageType.CHAT);

            when(messageRepository.findLastMessagesByRoomIds(List.of("room1")))
                    .thenReturn(List.of(msg));

            mockMvc.perform(get("/api/rooms").principal(() -> "alice"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].lastMessage.content").value(""))
                    .andExpect(jsonPath("$[0].lastMessage.created_at").value(""))
                    .andExpect(jsonPath("$[0].lastMessage.sender_id").value(""));
        }

        @Test
        @DisplayName("muted rooms still include lastMessage")
        void mutedRooms_includeLastMessage() throws Exception {
            RoomDto room = createRoom("room1", "Muted", RoomType.ROOM, Set.of("alice"));
            when(roomService.getUserRooms("alice")).thenReturn(List.of(room));
            when(roomMuteService.getMutedRoomIds("alice")).thenReturn(Set.of("room1"));

            MessageEntity msg = makeMsg("m1", "room1", "bob", "New msg", "2026-01-01 12:00:00");
            when(messageRepository.findLastMessagesByRoomIds(List.of("room1")))
                    .thenReturn(List.of(msg));

            mockMvc.perform(get("/api/rooms").principal(() -> "alice"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].muted").value(true))
                    .andExpect(jsonPath("$[0].lastMessage.content").value("New msg"));
        }
    }

    // ═══════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════

    private RoomDto createRoom(String id, String name, RoomType type, Set<String> members) {
        RoomDto dto = new RoomDto(id, name, type, "system", "2026-01-01 12:00:00");
        dto.setMembers(new LinkedHashSet<>(members));
        return dto;
    }

    private MessageEntity makeMsg(String id, String roomId, String sender, String content, String ts) {
        MessageEntity e = new MessageEntity();
        e.setId(id);
        e.setRoomId(roomId);
        e.setSender(sender);
        e.setContent(content);
        e.setTimestamp(ts);
        e.setType(MessageType.CHAT);
        return e;
    }
}
