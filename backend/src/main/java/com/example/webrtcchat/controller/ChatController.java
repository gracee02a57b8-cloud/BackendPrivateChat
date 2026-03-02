package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.UserDto;
import com.example.webrtcchat.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    // P1-5: /api/chat/history removed — use /api/rooms/{roomId}/history instead

    @GetMapping("/users")
    public ResponseEntity<?> getOnlineUsers(@RequestParam(required = false) String search,
                                            Principal principal) {
        if (search != null && !search.isBlank()) {
            List<UserDto> results = chatService.searchUsers(search).stream()
                    .map(u -> new UserDto(u, chatService.isUserOnline(u), chatService.getLastSeen(u), chatService.getAvatarUrl(u), chatService.getUserTag(u)))
                    .toList();
            return ResponseEntity.ok(results);
        }
        return ResponseEntity.ok(chatService.getOnlineUsers());
    }

    @GetMapping("/contacts")
    public ResponseEntity<List<UserDto>> getAllContacts(Principal principal) {
        List<UserDto> contacts = chatService.getAllUsers().stream()
                .map(u -> new UserDto(u, chatService.isUserOnline(u), chatService.getLastSeen(u), chatService.getAvatarUrl(u), chatService.getUserTag(u)))
                .toList();
        return ResponseEntity.ok(contacts);
    }

    @GetMapping("/online")
    public ResponseEntity<List<String>> getOnlineUsersList(Principal principal) {
        return ResponseEntity.ok(chatService.getOnlineUsers());
    }
}
