package com.example.webrtcchat.controller;

import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.UserRepository;
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
import java.util.HashMap;
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
    private final UserRepository userRepository;
    private final Path uploadDir;

    public ProfileController(ChatService chatService, JwtService jwtService,
                             UserRepository userRepository,
                             @Value("${upload.dir:uploads}") String uploadDirPath) {
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
    }

    @GetMapping
    public ResponseEntity<?> getProfile(@RequestHeader("Authorization") String authHeader) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        var userOpt = userRepository.findByUsername(username);
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
        profile.put("tag", user.getTag() != null ? user.getTag() : "");
        return ResponseEntity.ok(profile);
    }

    @PutMapping
    public ResponseEntity<?> updateProfile(@RequestHeader("Authorization") String authHeader,
                                           @RequestBody Map<String, String> body) {
        String username = extractUsername(authHeader);
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        var userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "User not found"));

        UserEntity user = userOpt.get();

        if (body.containsKey("firstName")) {
            String fn = body.get("firstName");
            if (fn != null && fn.length() > 50) return ResponseEntity.badRequest().body(Map.of("error", "Имя не более 50 символов"));
            user.setFirstName(fn);
        }
        if (body.containsKey("lastName")) {
            String ln = body.get("lastName");
            if (ln != null && ln.length() > 50) return ResponseEntity.badRequest().body(Map.of("error", "Фамилия не более 50 символов"));
            user.setLastName(ln);
        }
        if (body.containsKey("phone")) {
            String phone = body.get("phone");
            if (phone != null && phone.length() > 30) return ResponseEntity.badRequest().body(Map.of("error", "Номер не более 30 символов"));
            user.setPhone(phone);
        }
        if (body.containsKey("bio")) {
            String bio = body.get("bio");
            if (bio != null && bio.length() > 500) return ResponseEntity.badRequest().body(Map.of("error", "О себе не более 500 символов"));
            user.setBio(bio);
        }
        if (body.containsKey("birthday")) {
            String birthday = body.get("birthday");
            if (birthday != null && !birthday.isBlank() && !birthday.matches("\\d{4}-\\d{2}-\\d{2}")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Формат даты: YYYY-MM-DD"));
            }
            user.setBirthday(birthday);
        }
        if (body.containsKey("profileColor")) {
            String color = body.get("profileColor");
            if (color != null && !color.isBlank() && !color.matches("#[0-9a-fA-F]{6}")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Формат цвета: #RRGGBB"));
            }
            user.setProfileColor(color);
        }

        userRepository.save(user);
        log.info("Profile updated for user '{}'", username);

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
        profile.put("tag", user.getTag() != null ? user.getTag() : "");
        return ResponseEntity.ok(profile);
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
