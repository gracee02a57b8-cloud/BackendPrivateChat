package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.entity.RoomEntity;
import com.example.webrtcchat.repository.RoomRepository;
import com.example.webrtcchat.types.RoomType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoomServiceTest {

    @Mock
    private RoomRepository roomRepository;

    @InjectMocks
    private RoomService roomService;

    @Test
    @DisplayName("init does NOT create general room (Bug 2)")
    void init_doesNotCreateGeneralRoom() {
        roomService.init();
        verify(roomRepository, never()).save(any(RoomEntity.class));
        verify(roomRepository, never()).findById("general");
    }

    @Test
    @DisplayName("getRoomById returns room when found")
    void getRoomById_found() {
        RoomEntity entity = createRoom("room1", "Test Room", RoomType.ROOM, "alice");
        when(roomRepository.findById("room1")).thenReturn(Optional.of(entity));

        RoomDto dto = roomService.getRoomById("room1");

        assertNotNull(dto);
        assertEquals("room1", dto.getId());
        assertEquals("Test Room", dto.getName());
        assertEquals(RoomType.ROOM, dto.getType());
    }

    @Test
    @DisplayName("getRoomById returns null when not found")
    void getRoomById_notFound() {
        when(roomRepository.findById("nonexistent")).thenReturn(Optional.empty());
        assertNull(roomService.getRoomById("nonexistent"));
    }

    @Test
    @DisplayName("createRoom saves room with creator as member")
    void createRoom_success() {
        when(roomRepository.save(any(RoomEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        RoomDto result = roomService.createRoom("New Room", "alice");

        assertNotNull(result);
        assertEquals("New Room", result.getName());
        assertEquals(RoomType.ROOM, result.getType());
        assertEquals("alice", result.getCreatedBy());
        assertTrue(result.getMembers().contains("alice"));

        ArgumentCaptor<RoomEntity> captor = ArgumentCaptor.forClass(RoomEntity.class);
        verify(roomRepository).save(captor.capture());
        assertTrue(captor.getValue().getMembers().contains("alice"));
    }

    @Test
    @DisplayName("getOrCreatePrivateRoom creates new room when not exists")
    void getOrCreatePrivateRoom_creates() {
        when(roomRepository.findById(anyString())).thenReturn(Optional.empty());
        when(roomRepository.save(any(RoomEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        RoomDto result = roomService.getOrCreatePrivateRoom("alice", "bob");

        assertNotNull(result);
        assertEquals(RoomType.PRIVATE, result.getType());
        assertTrue(result.getMembers().contains("alice"));
        assertTrue(result.getMembers().contains("bob"));
        verify(roomRepository).save(any(RoomEntity.class));
    }

    @Test
    @DisplayName("getOrCreatePrivateRoom returns existing room")
    void getOrCreatePrivateRoom_existing() {
        RoomEntity existing = createRoom("pm_alice_bob", "alice & bob", RoomType.PRIVATE, "alice");
        existing.getMembers().add("alice");
        existing.getMembers().add("bob");
        when(roomRepository.findById("pm_alice_bob")).thenReturn(Optional.of(existing));

        RoomDto result = roomService.getOrCreatePrivateRoom("alice", "bob");

        assertNotNull(result);
        assertEquals("pm_alice_bob", result.getId());
        verify(roomRepository, never()).save(any());
    }

    @Test
    @DisplayName("Private room ID is consistent regardless of order")
    void privateRoomId_isConsistent() {
        when(roomRepository.findById(anyString())).thenReturn(Optional.empty());
        when(roomRepository.save(any(RoomEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        roomService.getOrCreatePrivateRoom("bob", "alice");
        roomService.getOrCreatePrivateRoom("alice", "bob");

        // Both calls should use same room ID
        ArgumentCaptor<RoomEntity> captor = ArgumentCaptor.forClass(RoomEntity.class);
        verify(roomRepository, times(2)).save(captor.capture());
        assertEquals(captor.getAllValues().get(0).getId(), captor.getAllValues().get(1).getId());
    }

    @Test
    @DisplayName("joinRoom adds member to existing room")
    void joinRoom_addsMember() {
        RoomEntity room = createRoom("room1", "Test", RoomType.ROOM, "alice");
        when(roomRepository.findById("room1")).thenReturn(Optional.of(room));
        when(roomRepository.save(any(RoomEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        RoomDto result = roomService.joinRoom("room1", "bob");

        assertNotNull(result);
        assertTrue(room.getMembers().contains("bob"));
    }

    @Test
    @DisplayName("joinRoom returns null for non-existent room")
    void joinRoom_roomNotFound() {
        when(roomRepository.findById("nonexistent")).thenReturn(Optional.empty());
        assertNull(roomService.joinRoom("nonexistent", "bob"));
    }

    @Test
    @DisplayName("deleteRoom succeeds for room creator")
    void deleteRoom_byCreator() {
        RoomEntity room = createRoom("room1", "Test", RoomType.ROOM, "alice");
        when(roomRepository.findById("room1")).thenReturn(Optional.of(room));

        assertTrue(roomService.deleteRoom("room1", "alice"));
        verify(roomRepository).delete(room);
    }

    @Test
    @DisplayName("deleteRoom fails for non-creator")
    void deleteRoom_nonCreator() {
        RoomEntity room = createRoom("room1", "Test", RoomType.ROOM, "alice");
        when(roomRepository.findById("room1")).thenReturn(Optional.of(room));

        assertFalse(roomService.deleteRoom("room1", "bob"));
        verify(roomRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteRoom fails for general room")
    void deleteRoom_generalRoom() {
        RoomEntity room = createRoom("general", "General", RoomType.GENERAL, "system");
        when(roomRepository.findById("general")).thenReturn(Optional.of(room));

        assertFalse(roomService.deleteRoom("general", "system"));
        verify(roomRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteRoom returns false for non-existent room")
    void deleteRoom_notFound() {
        when(roomRepository.findById("nonexistent")).thenReturn(Optional.empty());
        assertFalse(roomService.deleteRoom("nonexistent", "alice"));
    }

    @Test
    @DisplayName("getUserRooms returns list of rooms")
    void getUserRooms_returnsList() {
        RoomEntity general = createRoom("general", "General", RoomType.GENERAL, "system");
        RoomEntity room1 = createRoom("room1", "My Room", RoomType.ROOM, "alice");
        when(roomRepository.findUserRooms("alice")).thenReturn(List.of(general, room1));

        List<RoomDto> result = roomService.getUserRooms("alice");

        assertEquals(2, result.size());
    }

    // === Helpers ===

    private RoomEntity createRoom(String id, String name, RoomType type, String createdBy) {
        RoomEntity entity = new RoomEntity(id, name, type, createdBy, "2026-01-01 12:00:00");
        return entity;
    }
}
