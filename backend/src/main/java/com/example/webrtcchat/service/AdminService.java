package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.AdminStatsDto;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.repository.RoomRepository;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.types.RoomType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class AdminService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final MessageRepository messageRepository;
    private final ChatService chatService;

    public AdminService(UserRepository userRepository,
                        RoomRepository roomRepository,
                        MessageRepository messageRepository,
                        ChatService chatService) {
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.chatService = chatService;
    }

    @Transactional(readOnly = true)
    public AdminStatsDto getStats() {
        long totalUsers = userRepository.count();
        long onlineUsers = chatService.getOnlineUsers().size();

        long directChats = roomRepository.countByType(RoomType.PRIVATE);
        long groupChats = roomRepository.countByType(RoomType.ROOM);
        long totalChats = directChats + groupChats;

        // Active chats: rooms that have messages in the last 24 hours
        String since = LocalDateTime.now().minusHours(24).format(FORMATTER);
        long activeChats = roomRepository.countActiveRoomsSince(since);

        return new AdminStatsDto(totalUsers, onlineUsers, totalChats, activeChats, groupChats, directChats);
    }
}
