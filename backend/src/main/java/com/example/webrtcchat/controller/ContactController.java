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
@RequestMapping("/api")
public class ContactController {

    private static final Logger log = LoggerFactory.getLogger(ContactController.class);
    private static final DateTimeFormatter DTF = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ContactRepository contactRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public ContactController(ContactRepository contactRepository,
                             BlockedUserRepository blockedUserRepository,
                             UserRepository userRepository,
                             JwtService jwtService) {
        this.contactRepository = contactRepository;
        this.blockedUserRepository = blockedUserRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    // ─── Contacts ─────────────────────────────────────────

    @GetMapping("/contacts")
    public ResponseEntity<?> getContacts(@RequestHeader("Authorization") String authHeader) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        List<ContactEntity> contacts = contactRepository.findByOwner(username);
        List<Map<String, Object>> result = contacts.stream().map(c -> {
            Map<String, Object> m = new HashMap<>();
            m.put("username", c.getContact());
            m.put("addedAt", c.getCreatedAt());
            // Enrich with user data
            userRepository.findByUsername(c.getContact()).ifPresent(u -> {
                m.put("avatarUrl", u.getAvatarUrl() != null ? u.getAvatarUrl() : "");
                m.put("firstName", u.getFirstName() != null ? u.getFirstName() : "");
                m.put("lastName", u.getLastName() != null ? u.getLastName() : "");
                m.put("lastSeen", u.getLastSeen() != null ? u.getLastSeen() : "");
                m.put("bio", u.getBio() != null ? u.getBio() : "");
            });
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/contacts/{contactUsername}")
    public ResponseEntity<?> addContact(@RequestHeader("Authorization") String authHeader,
                                        @PathVariable String contactUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        if (username.equals(contactUsername)) return ResponseEntity.badRequest().body(Map.of("error", "Нельзя добавить себя"));

        if (userRepository.findByUsername(contactUsername).isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Пользователь не найден"));
        }

        if (contactRepository.existsByOwnerAndContact(username, contactUsername)) {
            return ResponseEntity.ok(Map.of("status", "already_exists"));
        }

        ContactEntity contact = new ContactEntity(username, contactUsername, LocalDateTime.now().format(DTF));
        contactRepository.save(contact);
        log.info("User '{}' added '{}' to contacts", username, contactUsername);
        return ResponseEntity.ok(Map.of("status", "added"));
    }

    @DeleteMapping("/contacts/{contactUsername}")
    @Transactional
    public ResponseEntity<?> removeContact(@RequestHeader("Authorization") String authHeader,
                                           @PathVariable String contactUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        contactRepository.deleteByOwnerAndContact(username, contactUsername);
        log.info("User '{}' removed '{}' from contacts", username, contactUsername);
        return ResponseEntity.ok(Map.of("status", "removed"));
    }

    @GetMapping("/contacts/check/{contactUsername}")
    public ResponseEntity<?> isContact(@RequestHeader("Authorization") String authHeader,
                                       @PathVariable String contactUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        boolean isContact = contactRepository.existsByOwnerAndContact(username, contactUsername);
        return ResponseEntity.ok(Map.of("isContact", isContact));
    }

    // ─── Blocks ───────────────────────────────────────────

    @GetMapping("/blocks")
    public ResponseEntity<?> getBlocked(@RequestHeader("Authorization") String authHeader) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        List<BlockedUserEntity> blocked = blockedUserRepository.findByBlocker(username);
        List<Map<String, Object>> result = blocked.stream().map(b -> {
            Map<String, Object> m = new HashMap<>();
            m.put("username", b.getBlocked());
            m.put("blockedAt", b.getCreatedAt());
            userRepository.findByUsername(b.getBlocked()).ifPresent(u -> {
                m.put("avatarUrl", u.getAvatarUrl() != null ? u.getAvatarUrl() : "");
                m.put("firstName", u.getFirstName() != null ? u.getFirstName() : "");
                m.put("lastName", u.getLastName() != null ? u.getLastName() : "");
            });
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/blocks/{blockedUsername}")
    public ResponseEntity<?> blockUser(@RequestHeader("Authorization") String authHeader,
                                       @PathVariable String blockedUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        if (username.equals(blockedUsername)) return ResponseEntity.badRequest().body(Map.of("error", "Нельзя заблокировать себя"));

        if (userRepository.findByUsername(blockedUsername).isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Пользователь не найден"));
        }

        if (blockedUserRepository.existsByBlockerAndBlocked(username, blockedUsername)) {
            return ResponseEntity.ok(Map.of("status", "already_blocked"));
        }

        BlockedUserEntity block = new BlockedUserEntity(username, blockedUsername, LocalDateTime.now().format(DTF));
        blockedUserRepository.save(block);
        log.info("User '{}' blocked '{}'", username, blockedUsername);
        return ResponseEntity.ok(Map.of("status", "blocked"));
    }

    @DeleteMapping("/blocks/{blockedUsername}")
    @Transactional
    public ResponseEntity<?> unblockUser(@RequestHeader("Authorization") String authHeader,
                                         @PathVariable String blockedUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        blockedUserRepository.deleteByBlockerAndBlocked(username, blockedUsername);
        log.info("User '{}' unblocked '{}'", username, blockedUsername);
        return ResponseEntity.ok(Map.of("status", "unblocked"));
    }

    @GetMapping("/blocks/check/{targetUsername}")
    public ResponseEntity<?> isBlocked(@RequestHeader("Authorization") String authHeader,
                                       @PathVariable String targetUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        boolean iBlockedThem = blockedUserRepository.existsByBlockerAndBlocked(username, targetUsername);
        boolean theyBlockedMe = blockedUserRepository.existsByBlockerAndBlocked(targetUsername, username);
        return ResponseEntity.ok(Map.of(
                "iBlockedThem", iBlockedThem,
                "theyBlockedMe", theyBlockedMe,
                "anyBlock", iBlockedThem || theyBlockedMe
        ));
    }

    // ─── Get another user's public profile ────────────────

    @GetMapping("/profile/{targetUsername}")
    public ResponseEntity<?> getUserProfile(@RequestHeader("Authorization") String authHeader,
                                            @PathVariable String targetUsername) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        var userOpt = userRepository.findByUsername(targetUsername);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Пользователь не найден"));

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
        profile.put("lastSeen", user.getLastSeen() != null ? user.getLastSeen() : "");
        profile.put("createdAt", user.getCreatedAt() != null ? user.getCreatedAt() : "");

        // Contact / block status for the requesting user
        profile.put("isContact", contactRepository.existsByOwnerAndContact(username, targetUsername));
        profile.put("iBlockedByMe", blockedUserRepository.existsByBlockerAndBlocked(username, targetUsername));
        profile.put("iAmBlockedByThem", blockedUserRepository.existsByBlockerAndBlocked(targetUsername, username));

        return ResponseEntity.ok(profile);
    }

    private String extractUsername(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!jwtService.isTokenValid(token)) return null;
        return jwtService.extractUsername(token);
    }
}
