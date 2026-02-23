package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.service.ChatService;
import com.example.webrtcchat.service.JwtService;
import com.example.webrtcchat.service.RoomService;
import com.example.webrtcchat.types.RoomType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(RoomController.class)
@AutoConfigureMockMvc(addFilters = false)
class RoomControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RoomService roomService;

    @MockBean
    private ChatService chatService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private MessageRepository messageRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // === getUserRooms ===

    @Test
    @DisplayName("GET /api/rooms - returns user rooms")
    void getUserRooms_success() throws Exception {
        RoomDto room = createRoomDto("general", "Общий чат", RoomType.GENERAL, Set.of("alice"));
        when(roomService.getUserRooms("alice")).thenReturn(List.of(room));

        mockMvc.perform(get("/api/rooms").principal(() -> "alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("general"))
                .andExpect(jsonPath("$[0].name").value("Общий чат"));
    }

    // === createRoom ===

    @Test
    @DisplayName("POST /api/rooms/create - success")
    void createRoom_success() throws Exception {
        RoomDto room = createRoomDto("abc12345", "My Room", RoomType.ROOM, Set.of("alice"));
        when(roomService.createRoom(eq("My Room"), eq("alice"), any(), any())).thenReturn(room);

        mockMvc.perform(post("/api/rooms/create")
                        .principal(() -> "alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "My Room"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("abc12345"))
                .andExpect(jsonPath("$.name").value("My Room"));
    }

    @Test
    @DisplayName("POST /api/rooms/create - blank name returns 400")
    void createRoom_blankName() throws Exception {
        mockMvc.perform(post("/api/rooms/create")
                        .principal(() -> "alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", ""))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/rooms/create - name too long returns 400")
    void createRoom_nameTooLong() throws Exception {
        mockMvc.perform(post("/api/rooms/create")
                        .principal(() -> "alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "a".repeat(51)))))
                .andExpect(status().isBadRequest());
    }

    // === getRoom ===

    @Test
    @DisplayName("GET /api/rooms/{id} - returns room for member")
    void getRoom_asMember() throws Exception {
        RoomDto room = createRoomDto("room1", "Test Room", RoomType.ROOM, Set.of("alice", "bob"));
        when(roomService.getRoomById("room1")).thenReturn(room);

        mockMvc.perform(get("/api/rooms/room1").principal(() -> "alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("room1"));
    }

    @Test
    @DisplayName("GET /api/rooms/{id} - returns 403 for non-member of non-general room")
    void getRoom_nonMember() throws Exception {
        RoomDto room = createRoomDto("room1", "Private Room", RoomType.ROOM, Set.of("alice"));
        when(roomService.getRoomById("room1")).thenReturn(room);

        mockMvc.perform(get("/api/rooms/room1").principal(() -> "eve"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /api/rooms/{id} - general room accessible to everyone")
    void getRoom_generalAccessible() throws Exception {
        RoomDto room = createRoomDto("general", "Общий чат", RoomType.GENERAL, Set.of());
        when(roomService.getRoomById("general")).thenReturn(room);

        mockMvc.perform(get("/api/rooms/general").principal(() -> "anyone"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("general"));
    }

    @Test
    @DisplayName("GET /api/rooms/{id} - returns 404 for non-existent room")
    void getRoom_notFound() throws Exception {
        when(roomService.getRoomById("nonexistent")).thenReturn(null);

        mockMvc.perform(get("/api/rooms/nonexistent").principal(() -> "alice"))
                .andExpect(status().isNotFound());
    }

    // === getRoomHistory ===

    @Test
    @DisplayName("GET /api/rooms/{id}/history - returns paginated history")
    void getRoomHistory_success() throws Exception {
        RoomDto room = createRoomDto("general", "Общий чат", RoomType.GENERAL, Set.of());
        when(roomService.getRoomById("general")).thenReturn(room);

        MessageDto msg = new MessageDto("alice", "Hello", "2026-01-01 12:00:00", null);
        when(chatService.getHistory("general", 0, 100)).thenReturn(List.of(msg));

        mockMvc.perform(get("/api/rooms/general/history").principal(() -> "alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sender").value("alice"))
                .andExpect(jsonPath("$[0].content").value("Hello"));
    }

    @Test
    @DisplayName("GET /api/rooms/{id}/history - caps page size at 200")
    void getRoomHistory_capsPageSize() throws Exception {
        RoomDto room = createRoomDto("general", "Общий чат", RoomType.GENERAL, Set.of());
        when(roomService.getRoomById("general")).thenReturn(room);
        when(chatService.getHistory(anyString(), anyInt(), anyInt())).thenReturn(List.of());

        mockMvc.perform(get("/api/rooms/general/history?page=0&size=500")
                        .principal(() -> "alice"))
                .andExpect(status().isOk());

        verify(chatService).getHistory("general", 0, 200); // capped to 200
    }

    @Test
    @DisplayName("GET /api/rooms/{id}/history - returns 403 for non-member")
    void getRoomHistory_nonMember() throws Exception {
        RoomDto room = createRoomDto("room1", "Private", RoomType.ROOM, Set.of("alice"));
        when(roomService.getRoomById("room1")).thenReturn(room);

        mockMvc.perform(get("/api/rooms/room1/history").principal(() -> "eve"))
                .andExpect(status().isForbidden());
    }

    // === joinRoom ===

    @Test
    @DisplayName("POST /api/rooms/join/{id} - success")
    void joinRoom_success() throws Exception {
        RoomDto room = createRoomDto("room1", "Test Room", RoomType.ROOM, Set.of("alice", "bob"));
        when(roomService.joinRoom("room1", "bob")).thenReturn(room);

        mockMvc.perform(post("/api/rooms/join/room1").principal(() -> "bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("room1"));
    }

    @Test
    @DisplayName("POST /api/rooms/join/{id} - returns 404 for non-existent room")
    void joinRoom_notFound() throws Exception {
        when(roomService.joinRoom("nonexistent", "bob")).thenReturn(null);

        mockMvc.perform(post("/api/rooms/join/nonexistent").principal(() -> "bob"))
                .andExpect(status().isNotFound());
    }

    // === deleteRoom ===

    @Test
    @DisplayName("DELETE /api/rooms/{id} - success for creator")
    void deleteRoom_success() throws Exception {
        when(roomService.deleteRoom("room1", "alice")).thenReturn("deleted");

        mockMvc.perform(delete("/api/rooms/room1").principal(() -> "alice"))
                .andExpect(status().isOk());

        verify(chatService).clearHistory("room1");
    }

    @Test
    @DisplayName("DELETE /api/rooms/{id} - returns 403 for non-member")
    void deleteRoom_nonCreator() throws Exception {
        when(roomService.deleteRoom("room1", "bob")).thenReturn(null);

        mockMvc.perform(delete("/api/rooms/room1").principal(() -> "bob"))
                .andExpect(status().isForbidden());
    }

    // === getPrivateRoom ===

    @Test
    @DisplayName("POST /api/rooms/private/{username} - success")
    void getPrivateRoom_success() throws Exception {
        RoomDto room = createRoomDto("pm_alice_bob", "alice & bob", RoomType.PRIVATE, Set.of("alice", "bob"));
        when(roomService.getOrCreatePrivateRoom("alice", "bob")).thenReturn(room);

        mockMvc.perform(post("/api/rooms/private/bob").principal(() -> "alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("pm_alice_bob"));
    }

    @Test
    @DisplayName("POST /api/rooms/private/{username} - cannot message self")
    void getPrivateRoom_self() throws Exception {
        mockMvc.perform(post("/api/rooms/private/alice").principal(() -> "alice"))
                .andExpect(status().isBadRequest());
    }

    // === Helpers ===

    private RoomDto createRoomDto(String id, String name, RoomType type, Set<String> members) {
        RoomDto dto = new RoomDto(id, name, type, "system", "2026-01-01 12:00:00");
        dto.setMembers(new CopyOnWriteArraySet<>(members));
        return dto;
    }
}
