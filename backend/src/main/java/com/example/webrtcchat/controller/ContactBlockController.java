package com.example.webrtcchat.controller;

import com.example.webrtcchat.entity.BlockedUserEntity;
import com.example.webrtcchat.entity.ContactEntity;
import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.BlockedUserRepository;
import com.example.webrtcchat.repository.ContactRepository;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.service.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
public class ContactBlockController {

    private static final Logger log = LoggerFactory.getLogger(ContactBlockController.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ContactRepository contactRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public ContactBlockController(ContactRepository contactRepository,
                                  BlockedUserRepository blockedUserRepository,
                                  UserRepository userRepository,
                                  JwtService jwtService) {
        this.contactRepository = contactRepository;
        this.blockedUserRepository = blockedUserRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    // ════════════════════════════════════════════
    //  CONTACTS
    // ════════════════════════════════════════════

    @GetMapping("/api/contacts")
    public ResponseEntity<?> getContacts(@RequestHeader("Authorization") String authHeader) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        List<ContactEntity> contacts = contactRepository.findByOwner(username);
        List<Map<String, Object>> result = contacts.stream().map(c -> {
            Map<String, Object> map = new HashMap<>();
            map.put("contact", c.getContact());
            map.put("createdAt", c.getCreatedAt());
            // Enrich with user info
            userRepository.findByUsername(c.getContact()).ifPresent(u -> {
                map.put("avatarUrl", u.getAvatarUrl() != null ? u.getAvatarUrl() : "");
                map.put("firstName", u.getFirstName() != null ? u.getFirstName() : "");
                map.put("lastName", u.getLastName() != null ? u.getLastName() : "");
                map.put("tag", u.getTag() != null ? u.getTag() : "");
            });
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/api/contacts/{targetUsername}")
    public ResponseEntity<?> addContact(@RequestHeader("Authorization") String authHeader,
                                        @PathVariable String targetUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        if (username.equals(targetUsername)) return ResponseEntity.badRequest().body(Map.of("error", "Cannot add yourself"));

        if (userRepository.findByUsername(targetUsername).isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        if (contactRepository.existsByOwnerAndContact(username, targetUsername)) {
            return ResponseEntity.ok(Map.of("status", "already_contact"));
        }

        ContactEntity contact = new ContactEntity(username, targetUsername, now());
        contactRepository.save(contact);
        log.info("User '{}' added '{}' to contacts", username, targetUsername);
        return ResponseEntity.ok(Map.of("status", "added"));
    }

    @DeleteMapping("/api/contacts/{targetUsername}")
    @Transactional
    public ResponseEntity<?> removeContact(@RequestHeader("Authorization") String authHeader,
                                           @PathVariable String targetUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        contactRepository.deleteByOwnerAndContact(username, targetUsername);
        log.info("User '{}' removed '{}' from contacts", username, targetUsername);
        return ResponseEntity.ok(Map.of("status", "removed"));
    }

    // ════════════════════════════════════════════
    //  BLOCKS
    // ════════════════════════════════════════════

    @GetMapping("/api/blocks")
    public ResponseEntity<?> getBlocks(@RequestHeader("Authorization") String authHeader) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        List<BlockedUserEntity> blocks = blockedUserRepository.findByBlocker(username);
        List<Map<String, String>> result = blocks.stream().map(b -> {
            Map<String, String> map = new HashMap<>();
            map.put("blocked", b.getBlocked());
            map.put("createdAt", b.getCreatedAt());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/api/blocks/{targetUsername}")
    public ResponseEntity<?> blockUser(@RequestHeader("Authorization") String authHeader,
                                       @PathVariable String targetUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        if (username.equals(targetUsername)) return ResponseEntity.badRequest().body(Map.of("error", "Cannot block yourself"));

        if (blockedUserRepository.existsByBlockerAndBlocked(username, targetUsername)) {
            return ResponseEntity.ok(Map.of("status", "already_blocked"));
        }

        BlockedUserEntity block = new BlockedUserEntity(username, targetUsername, now());
        blockedUserRepository.save(block);
        log.info("User '{}' blocked '{}'", username, targetUsername);
        return ResponseEntity.ok(Map.of("status", "blocked"));
    }

    @DeleteMapping("/api/blocks/{targetUsername}")
    @Transactional
    public ResponseEntity<?> unblockUser(@RequestHeader("Authorization") String authHeader,
                                         @PathVariable String targetUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        blockedUserRepository.deleteByBlockerAndBlocked(username, targetUsername);
        log.info("User '{}' unblocked '{}'", username, targetUsername);
        return ResponseEntity.ok(Map.of("status", "unblocked"));
    }

    // ════════════════════════════════════════════
    //  VIEW OTHER USER'S PROFILE
    // ════════════════════════════════════════════

    @GetMapping("/api/profile/{targetUsername}")
    public ResponseEntity<?> getUserProfile(@RequestHeader("Authorization") String authHeader,
                                            @PathVariable String targetUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        Optional<UserEntity> userOpt = userRepository.findByUsername(targetUsername);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "User not found"));

        UserEntity user = userOpt.get();
        Map<String, Object> profile = new HashMap<>();
        profile.put("username", user.getUsername());
        profile.put("avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "");
        profile.put("phone", user.getPhone() != null ? user.getPhone() : "");
        profile.put("bio", user.getBio() != null ? user.getBio() : "");
        profile.put("birthday", user.getBirthday() != null ? user.getBirthday() : "");
        profile.put("firstName", user.getFirstName() != null ? user.getFirstName() : "");
        profile.put("lastName", user.getLastName() != null ? user.getLastName() : "");
        profile.put("profileColor", user.getProfileColor() != null ? user.getProfileColor() : "");
        profile.put("createdAt", user.getCreatedAt() != null ? user.getCreatedAt() : "");
        profile.put("lastSeen", user.getLastSeen() != null ? user.getLastSeen() : "");
        profile.put("tag", user.getTag() != null ? user.getTag() : "");

        // Is this person in my contacts?
        profile.put("isContact", contactRepository.existsByOwnerAndContact(username, targetUsername));
        // Did I block this person?
        profile.put("iBlockedByMe", blockedUserRepository.existsByBlockerAndBlocked(username, targetUsername));

        return ResponseEntity.ok(profile);
    }

    // ════════════════════════════════════════════

    private String extractUsername(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!jwtService.isTokenValid(token)) return null;
        return jwtService.extractUsername(token);
    }

    private String now() {
        return LocalDateTime.now().format(FORMATTER);
    }
}
