package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.entity.RoomEntity;
import com.example.webrtcchat.repository.RoomRepository;
import com.example.webrtcchat.types.RoomType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArraySet;

@Service
public class RoomService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final RoomRepository roomRepository;

    public RoomService(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @PostConstruct
    @Transactional
    public void init() {
        // General room removed — no auto-creation needed
    }

    @Transactional(readOnly = true)
    public RoomDto getRoomById(String roomId) {
        return roomRepository.findById(roomId).map(this::toDto).orElse(null);
    }

    @Transactional
    public RoomDto getOrCreatePrivateRoom(String user1, String user2) {
        String key = privateRoomId(user1, user2);
        return roomRepository.findById(key)
                .map(this::toDto)
                .orElseGet(() -> {
                    RoomEntity room = new RoomEntity(key, user1 + " & " + user2, RoomType.PRIVATE, user1, now());
                    room.getMembers().add(user1);
                    room.getMembers().add(user2);
                    roomRepository.save(room);
                    return toDto(room);
                });
    }

    @Transactional
    public RoomDto getOrCreateSavedRoom(String username) {
        String id = "saved_" + username;
        return roomRepository.findById(id)
                .map(this::toDto)
                .orElseGet(() -> {
                    RoomEntity room = new RoomEntity(id, "Избранное", RoomType.SAVED_MESSAGES, username, now());
                    room.getMembers().add(username);
                    roomRepository.save(room);
                    return toDto(room);
                });
    }

    @Transactional
    public RoomDto createRoom(String name, String creator) {
        return createRoom(name, creator, null, null);
    }

    @Transactional
    public RoomDto createRoom(String name, String creator, String description, String avatarUrl) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        RoomEntity room = new RoomEntity(id, name, RoomType.ROOM, creator, now());
        room.getMembers().add(creator);
        if (description != null && !description.isBlank()) {
            room.setDescription(description.trim());
        }
        if (avatarUrl != null && !avatarUrl.isBlank()) {
            room.setAvatarUrl(avatarUrl.trim());
        }
        roomRepository.save(room);
        return toDto(room);
    }

    @Transactional
    public RoomDto joinRoom(String roomId, String username) {
        return roomRepository.findById(roomId)
                .map(room -> {
                    room.getMembers().add(username);
                    roomRepository.save(room);
                    return toDto(room);
                })
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<RoomDto> getUserRooms(String username) {
        return roomRepository.findUserRooms(username)
                .stream().map(this::toDto).toList();
    }

    /**
     * Delete or leave a room.
     * @return "deleted" if room was deleted, "left" if user left the group, null if forbidden/not found.
     */
    @Transactional
    public String deleteRoom(String roomId, String username) {
        return roomRepository.findById(roomId)
                .map(room -> {
                    if (room.getType() == RoomType.GENERAL) return (String) null;
                    if (room.getType() == RoomType.SAVED_MESSAGES) return (String) null; // Cannot delete saved messages
                    // Must be a member or the creator
                    boolean isMember = room.getMembers().contains(username);
                    boolean isCreator = username.equals(room.getCreatedBy());
                    if (!isMember && !isCreator) return (String) null;

                    if (room.getType() == RoomType.PRIVATE || isCreator) {
                        // Private chat: either side can delete
                        // Group: creator deletes entirely
                        roomRepository.delete(room);
                        return "deleted";
                    } else {
                        // Group member (not creator): leave the group
                        room.getMembers().remove(username);
                        roomRepository.save(room);
                        return "left";
                    }
                })
                .orElse(null);
    }

    private String privateRoomId(String u1, String u2) {
        return u1.compareTo(u2) < 0 ? "pm_" + u1 + "_" + u2 : "pm_" + u2 + "_" + u1;
    }

    private String now() {
        return LocalDateTime.now().format(FORMATTER);
    }

    private RoomDto toDto(RoomEntity entity) {
        RoomDto dto = new RoomDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setType(entity.getType());
        dto.setCreatedBy(entity.getCreatedBy());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setDescription(entity.getDescription());
        dto.setAvatarUrl(entity.getAvatarUrl());
        dto.setDisappearingSeconds(entity.getDisappearingSeconds());
        dto.setMembers(new CopyOnWriteArraySet<>(entity.getMembers()));
        return dto;
    }
}
