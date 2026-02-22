package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.AdminStatsDto;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.repository.RoomRepository;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.types.RoomType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RoomRepository roomRepository;
    @Mock private MessageRepository messageRepository;
    @Mock private ChatService chatService;

    private AdminService adminService;

    @BeforeEach
    void setUp() {
        adminService = new AdminService(userRepository, roomRepository, messageRepository, chatService);
    }

    @Test
    @DisplayName("getStats returns correct statistics")
    void getStats_returnsCorrectValues() {
        when(userRepository.count()).thenReturn(42L);
        when(chatService.getOnlineUsers()).thenReturn(List.of("alice", "bob", "charlie"));
        when(roomRepository.countByType(RoomType.PRIVATE)).thenReturn(12L);
        when(roomRepository.countByType(RoomType.ROOM)).thenReturn(3L);
        when(roomRepository.countActiveRoomsSince(anyString())).thenReturn(5L);

        AdminStatsDto stats = adminService.getStats();

        assertEquals(42, stats.getTotalUsers());
        assertEquals(3, stats.getOnlineUsers());
        assertEquals(15, stats.getTotalChats()); // 12 + 3
        assertEquals(5, stats.getActiveChats());
        assertEquals(3, stats.getGroupChats());
        assertEquals(12, stats.getDirectChats());
    }

    @Test
    @DisplayName("getStats returns zeros when no data")
    void getStats_noData() {
        when(userRepository.count()).thenReturn(0L);
        when(chatService.getOnlineUsers()).thenReturn(List.of());
        when(roomRepository.countByType(RoomType.PRIVATE)).thenReturn(0L);
        when(roomRepository.countByType(RoomType.ROOM)).thenReturn(0L);
        when(roomRepository.countActiveRoomsSince(anyString())).thenReturn(0L);

        AdminStatsDto stats = adminService.getStats();

        assertEquals(0, stats.getTotalUsers());
        assertEquals(0, stats.getOnlineUsers());
        assertEquals(0, stats.getTotalChats());
        assertEquals(0, stats.getActiveChats());
        assertEquals(0, stats.getGroupChats());
        assertEquals(0, stats.getDirectChats());
    }

    @Test
    @DisplayName("getStats totalChats is sum of direct + group")
    void getStats_totalChatsIsSum() {
        when(userRepository.count()).thenReturn(10L);
        when(chatService.getOnlineUsers()).thenReturn(List.of());
        when(roomRepository.countByType(RoomType.PRIVATE)).thenReturn(7L);
        when(roomRepository.countByType(RoomType.ROOM)).thenReturn(4L);
        when(roomRepository.countActiveRoomsSince(anyString())).thenReturn(2L);

        AdminStatsDto stats = adminService.getStats();

        assertEquals(11, stats.getTotalChats()); // 7 + 4
        assertEquals(7, stats.getDirectChats());
        assertEquals(4, stats.getGroupChats());
    }

    @Test
    @DisplayName("getStats onlineUsers reflects live WebSocket state")
    void getStats_onlineUsersReflectsWsState() {
        when(userRepository.count()).thenReturn(100L);
        when(chatService.getOnlineUsers()).thenReturn(
                List.of("user1", "user2", "user3", "user4", "user5", "user6", "user7"));
        when(roomRepository.countByType(RoomType.PRIVATE)).thenReturn(0L);
        when(roomRepository.countByType(RoomType.ROOM)).thenReturn(0L);
        when(roomRepository.countActiveRoomsSince(anyString())).thenReturn(0L);

        AdminStatsDto stats = adminService.getStats();

        assertEquals(100, stats.getTotalUsers());
        assertEquals(7, stats.getOnlineUsers());
    }
}
