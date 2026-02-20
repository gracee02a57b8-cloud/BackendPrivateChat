package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
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
    public ResponseEntity<List<String>> getOnlineUsers(@RequestParam(required = false) String search) {
        if (search != null && !search.isBlank()) {
            return ResponseEntity.ok(chatService.searchUsers(search));
        }
        return ResponseEntity.ok(chatService.getOnlineUsers());
    }
}
