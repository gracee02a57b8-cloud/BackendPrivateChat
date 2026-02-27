package com.example.webrtcchat.controller;

import com.example.webrtcchat.service.ChatFolderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/folders")
public class ChatFolderController {

    private final ChatFolderService chatFolderService;

    public ChatFolderController(ChatFolderService chatFolderService) {
        this.chatFolderService = chatFolderService;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getFolders(Principal principal) {
        return ResponseEntity.ok(chatFolderService.getFolders(principal.getName()));
    }

    @PostMapping
    public ResponseEntity<?> createFolder(@RequestBody Map<String, String> body, Principal principal) {
        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "name is required"));
        }
        String emoji = body.get("emoji");
        Map<String, Object> folder = chatFolderService.createFolder(principal.getName(), name, emoji);
        return ResponseEntity.ok(folder);
    }

    @PutMapping("/{folderId}")
    public ResponseEntity<?> updateFolder(@PathVariable Long folderId, @RequestBody Map<String, String> body, Principal principal) {
        Map<String, Object> folder = chatFolderService.updateFolder(folderId, principal.getName(), body.get("name"), body.get("emoji"));
        if (folder == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(folder);
    }

    @DeleteMapping("/{folderId}")
    public ResponseEntity<?> deleteFolder(@PathVariable Long folderId, Principal principal) {
        boolean ok = chatFolderService.deleteFolder(folderId, principal.getName());
        if (!ok) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PostMapping("/{folderId}/rooms/{roomId}")
    public ResponseEntity<?> addRoom(@PathVariable Long folderId, @PathVariable String roomId, Principal principal) {
        Map<String, Object> folder = chatFolderService.addRoomToFolder(folderId, principal.getName(), roomId);
        if (folder == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(folder);
    }

    @DeleteMapping("/{folderId}/rooms/{roomId}")
    public ResponseEntity<?> removeRoom(@PathVariable Long folderId, @PathVariable String roomId, Principal principal) {
        Map<String, Object> folder = chatFolderService.removeRoomFromFolder(folderId, principal.getName(), roomId);
        if (folder == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(folder);
    }
}
