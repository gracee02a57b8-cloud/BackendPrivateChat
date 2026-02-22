package com.example.webrtcchat.controller;

import com.example.webrtcchat.service.ChatService;
import com.example.webrtcchat.service.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private static final Logger log = LoggerFactory.getLogger(ProfileController.class);
    private static final long MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
    private static final Set<String> ALLOWED_AVATAR_EXT = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".webp"
    );

    private final ChatService chatService;
    private final JwtService jwtService;
    private final Path uploadDir;

    public ProfileController(ChatService chatService, JwtService jwtService,
                             @Value("${upload.dir:uploads}") String uploadDirPath) {
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
    }

    @GetMapping
    public ResponseEntity<?> getProfile(@RequestHeader("Authorization") String authHeader) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String avatarUrl = chatService.getAvatarUrl(username);
        return ResponseEntity.ok(Map.of(
                "username", username,
                "avatarUrl", avatarUrl != null ? avatarUrl : ""
        ));
    }

    @PostMapping("/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestHeader("Authorization") String authHeader,
                                          @RequestParam("file") MultipartFile file) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Файл пустой"));
        }
        if (file.getSize() > MAX_AVATAR_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "Макс. размер аватара 5 МБ"));
        }

        String ext = getExtension(file.getOriginalFilename()).toLowerCase();
        if (!ALLOWED_AVATAR_EXT.contains(ext)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Только изображения: jpg, png, gif, webp"));
        }

        // Detect content type from bytes
        String detectedType = detectContentType(file);
        if (detectedType == null || !detectedType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Файл не является изображением"));
        }

        try {
            // Delete old avatar file if exists
            String oldAvatarUrl = chatService.getAvatarUrl(username);
            if (oldAvatarUrl != null && !oldAvatarUrl.isBlank()) {
                deleteAvatarFile(oldAvatarUrl);
            }

            String filename = "avatar_" + UUID.randomUUID() + ext;
            Path target = uploadDir.resolve(filename);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

            String avatarUrl = "/api/uploads/" + filename;
            chatService.updateAvatarUrl(username, avatarUrl);

            log.info("Avatar updated for user '{}'", username);
            return ResponseEntity.ok(Map.of("avatarUrl", avatarUrl));
        } catch (IOException e) {
            log.error("Avatar upload failed for user '{}'", username, e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Ошибка загрузки"));
        }
    }

    @DeleteMapping("/avatar")
    public ResponseEntity<?> deleteAvatar(@RequestHeader("Authorization") String authHeader) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String oldAvatarUrl = chatService.getAvatarUrl(username);
        if (oldAvatarUrl != null && !oldAvatarUrl.isBlank()) {
            deleteAvatarFile(oldAvatarUrl);
        }

        chatService.updateAvatarUrl(username, null);
        log.info("Avatar deleted for user '{}'", username);
        return ResponseEntity.ok(Map.of("avatarUrl", ""));
    }

    private void deleteAvatarFile(String avatarUrl) {
        try {
            String filename = avatarUrl.substring(avatarUrl.lastIndexOf('/') + 1);
            Path file = uploadDir.resolve(filename).normalize();
            if (file.startsWith(uploadDir)) {
                Files.deleteIfExists(file);
            }
        } catch (IOException e) {
            log.warn("Failed to delete old avatar file: {}", avatarUrl, e);
        }
    }

    private String extractUsername(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!jwtService.isTokenValid(token)) return null;
        return jwtService.extractUsername(token);
    }

    private String detectContentType(MultipartFile file) {
        try {
            Path tempFile = Files.createTempFile("avatar-check-", getExtension(file.getOriginalFilename()));
            try {
                Files.copy(file.getInputStream(), tempFile, StandardCopyOption.REPLACE_EXISTING);
                String probed = Files.probeContentType(tempFile);
                return probed != null ? probed : file.getContentType();
            } finally {
                Files.deleteIfExists(tempFile);
            }
        } catch (IOException e) {
            return file.getContentType();
        }
    }

    private String getExtension(String filename) {
        if (filename != null && filename.contains(".")) {
            String ext = filename.substring(filename.lastIndexOf("."));
            if (ext.matches("\\.[a-zA-Z0-9]+")) return ext;
        }
        return ".bin";
    }
}
