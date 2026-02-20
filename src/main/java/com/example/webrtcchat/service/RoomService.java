package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.types.RoomType;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoomService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final Map<String, RoomDto> rooms = new ConcurrentHashMap<>();

    public RoomService() {
        RoomDto general = new RoomDto("general", "Общий чат", RoomType.GENERAL, "system", now());
        rooms.put("general", general);
    }

    public RoomDto getRoomById(String roomId) {
        return rooms.get(roomId);
    }

    public RoomDto getOrCreatePrivateRoom(String user1, String user2) {
        String key = privateRoomId(user1, user2);
        return rooms.computeIfAbsent(key, k -> {
            RoomDto room = new RoomDto(key, user1 + " & " + user2, RoomType.PRIVATE, user1, now());
            room.getMembers().add(user1);
            room.getMembers().add(user2);
            return room;
        });
    }

    public RoomDto createRoom(String name, String creator) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        RoomDto room = new RoomDto(id, name, RoomType.ROOM, creator, now());
        room.getMembers().add(creator);
        rooms.put(id, room);
        return room;
    }

    public RoomDto joinRoom(String roomId, String username) {
        RoomDto room = rooms.get(roomId);
        if (room != null) {
            room.getMembers().add(username);
        }
        return room;
    }

    public List<RoomDto> getUserRooms(String username) {
        return rooms.values().stream()
                .filter(r -> r.getType() == RoomType.GENERAL || r.getMembers().contains(username))
                .toList();
    }

    private String privateRoomId(String u1, String u2) {
        return u1.compareTo(u2) < 0 ? "pm_" + u1 + "_" + u2 : "pm_" + u2 + "_" + u1;
    }

    private String now() {
        return LocalDateTime.now().format(FORMATTER);
    }
}
