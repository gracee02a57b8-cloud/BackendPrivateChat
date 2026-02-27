package com.example.webrtcchat.controller;

import com.example.webrtcchat.service.ReactionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reactions")
public class ReactionController {

    private final ReactionService reactionService;

    public ReactionController(ReactionService reactionService) {
        this.reactionService = reactionService;
    }

    @PostMapping
    public ResponseEntity<?> addReaction(@RequestBody Map<String, String> body, Principal principal) {
        String messageId = body.get("messageId");
        String roomId = body.get("roomId");
        String emoji = body.get("emoji");
        if (messageId == null || roomId == null || emoji == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "messageId, roomId and emoji are required"));
        }
        reactionService.addReaction(messageId, roomId, principal.getName(), emoji);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @DeleteMapping
    public ResponseEntity<?> removeReaction(@RequestBody Map<String, String> body, Principal principal) {
        String messageId = body.get("messageId");
        String emoji = body.get("emoji");
        if (messageId == null || emoji == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "messageId and emoji are required"));
        }
        reactionService.removeReaction(messageId, principal.getName(), emoji);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @GetMapping("/{messageId}")
    public ResponseEntity<List<Map<String, Object>>> getReactions(@PathVariable String messageId) {
        return ResponseEntity.ok(reactionService.getReactionsForMessage(messageId));
    }

    @PostMapping("/batch")
    public ResponseEntity<Map<String, List<Map<String, Object>>>> getBatchReactions(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<String> messageIds = (List<String>) body.get("messageIds");
        if (messageIds == null) return ResponseEntity.ok(Map.of());
        return ResponseEntity.ok(reactionService.getReactionsForMessages(messageIds));
    }
}
