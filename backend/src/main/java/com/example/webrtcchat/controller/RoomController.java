package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.service.ChatService;
import com.example.webrtcchat.service.RoomService;
import com.example.webrtcchat.types.RoomType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final ChatService chatService;
    private final MessageRepository messageRepository;

    public RoomController(RoomService roomService, ChatService chatService, MessageRepository messageRepository) {
        this.roomService = roomService;
        this.chatService = chatService;
        this.messageRepository = messageRepository;
    }

    @GetMapping
    public ResponseEntity<List<RoomDto>> getUserRooms(Principal principal) {
        return ResponseEntity.ok(roomService.getUserRooms(principal.getName()));
    }

    @PostMapping("/private/{username}")
    public ResponseEntity<RoomDto> getPrivateRoom(@PathVariable String username, Principal principal) {
        if (username.equals(principal.getName())) {
            return ResponseEntity.badRequest().build();
        }
        RoomDto room = roomService.getOrCreatePrivateRoom(principal.getName(), username);
        return ResponseEntity.ok(room);
    }

    @PostMapping("/create")
    public ResponseEntity<RoomDto> createRoom(@RequestBody Map<String, String> body, Principal principal) {
        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (name.trim().length() > 50) {
            return ResponseEntity.badRequest().build();
        }
        RoomDto room = roomService.createRoom(name.trim(), principal.getName());
        return ResponseEntity.ok(room);
    }

    @PostMapping("/join/{roomId}")
    public ResponseEntity<RoomDto> joinRoom(@PathVariable String roomId, Principal principal) {
        RoomDto room = roomService.joinRoom(roomId, principal.getName());
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(room);
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<RoomDto> getRoom(@PathVariable String roomId, Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        // Check membership (C8): non-general rooms require membership
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(room);
    }

    @GetMapping("/{roomId}/history")
    public ResponseEntity<List<MessageDto>> getRoomHistory(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size,
            Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        // Check membership (C8): non-general rooms require membership
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        int safeSize = Math.min(size, 200);
        return ResponseEntity.ok(chatService.getHistory(roomId, page, safeSize));
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteRoom(@PathVariable String roomId, Principal principal) {
        boolean deleted = roomService.deleteRoom(roomId, principal.getName());
        if (!deleted) {
            return ResponseEntity.status(403).build();
        }
        chatService.clearHistory(roomId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{roomId}/media-stats")
    public ResponseEntity<Map<String, Long>> getMediaStats(@PathVariable String roomId, Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        Map<String, Long> stats = Map.of(
                "photos", messageRepository.countPhotosByRoomId(roomId),
                "videos", messageRepository.countVideosByRoomId(roomId),
                "files", messageRepository.countFilesByRoomId(roomId),
                "links", messageRepository.countLinksByRoomId(roomId)
        );
        return ResponseEntity.ok(stats);
    }
}
