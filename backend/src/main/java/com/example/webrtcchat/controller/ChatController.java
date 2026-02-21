package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.UserDto;
import com.example.webrtcchat.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/history")
    public ResponseEntity<List<MessageDto>> getHistory() {
        return ResponseEntity.ok(chatService.getHistory());
    }

    @GetMapping("/users")
    public ResponseEntity<?> getOnlineUsers(@RequestParam(required = false) String search) {
        if (search != null && !search.isBlank()) {
            List<UserDto> results = chatService.searchUsers(search).stream()
                    .map(u -> new UserDto(u, chatService.isUserOnline(u)))
                    .toList();
            return ResponseEntity.ok(results);
        }
        return ResponseEntity.ok(chatService.getOnlineUsers());
    }

    @GetMapping("/contacts")
    public ResponseEntity<List<UserDto>> getAllContacts() {
        List<UserDto> contacts = chatService.getAllUsers().stream()
                .map(u -> new UserDto(u, chatService.isUserOnline(u)))
                .toList();
        return ResponseEntity.ok(contacts);
    }
}
