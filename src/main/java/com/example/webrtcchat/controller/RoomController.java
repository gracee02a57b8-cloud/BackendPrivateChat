package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.service.ChatService;
import com.example.webrtcchat.service.RoomService;
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

    public RoomController(RoomService roomService, ChatService chatService) {
        this.roomService = roomService;
        this.chatService = chatService;
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
    public ResponseEntity<RoomDto> getRoom(@PathVariable String roomId) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(room);
    }

    @GetMapping("/{roomId}/history")
    public ResponseEntity<List<MessageDto>> getRoomHistory(@PathVariable String roomId) {
        return ResponseEntity.ok(chatService.getHistory(roomId));
    }
}
