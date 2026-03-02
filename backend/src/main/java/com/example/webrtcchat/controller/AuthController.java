package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.AuthResponse;
import com.example.webrtcchat.dto.UserDto;
import com.example.webrtcchat.entity.RefreshTokenEntity;
import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.RefreshTokenRepository;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.service.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;
    private final long refreshTokenExpirationMs;

    public AuthController(JwtService jwtService, UserRepository userRepository,
                          PasswordEncoder passwordEncoder, RefreshTokenRepository refreshTokenRepository,
                          @Value("${jwt.refresh-expiration:604800000}") long refreshTokenExpirationMs) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
    }

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<?> register(@RequestBody UserDto userDto) {
        if (userDto.getUsername() == null || userDto.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Имя пользователя обязательно"));
        }
        if (userDto.getPassword() == null || userDto.getPassword().length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Пароль должен быть не менее 8 символов"));
        }
        if (userDto.getTag() == null || userDto.getTag().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Тег обязателен"));
        }
        String username = userDto.getUsername().trim();
        if (username.length() > 20) {
            return ResponseEntity.badRequest().body(Map.of("error", "Имя не более 20 символов"));
        }
        String tag = userDto.getTag().trim().toLowerCase();
        if (!tag.startsWith("@")) tag = "@" + tag;
        if (!tag.matches("@[a-zA-Z0-9_]{2,24}")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Тег: 2-24 символа (латиница, цифры, _)"));
        }
        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Пользователь уже существует"));
        }
        if (userRepository.existsByTag(tag)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Этот тег уже занят"));
        }

        UserEntity user = new UserEntity(
                username,
                passwordEncoder.encode(userDto.getPassword()),
                LocalDateTime.now().format(FORMATTER)
        );
        user.setTag(tag);
        if (userDto.getFullname() != null && !userDto.getFullname().isBlank()) {
            user.setFirstName(userDto.getFullname().trim());
        }
        userRepository.save(user);

        String token = jwtService.generateToken(username, user.getRole());
        String refreshToken = createRefreshToken(username);
        String displayName = user.getFirstName() != null ? user.getFirstName() : username;
        return ResponseEntity.ok(new AuthResponse(token, refreshToken, username, user.getRole(), user.getAvatarUrl(), tag, displayName));
    }

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<?> login(@RequestBody UserDto userDto) {
        if (userDto.getUsername() == null || userDto.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Имя пользователя или тег обязательны"));
        }
        if (userDto.getPassword() == null || userDto.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Пароль обязателен"));
        }

        String loginInput = userDto.getUsername().trim();
        java.util.Optional<UserEntity> userOpt;

        if (loginInput.startsWith("@")) {
            userOpt = userRepository.findByTag(loginInput.toLowerCase());
        } else {
            userOpt = userRepository.findByUsername(loginInput);
            if (userOpt.isEmpty()) {
                userOpt = userRepository.findByTag("@" + loginInput.toLowerCase());
            }
        }

        // P1-10: generic error for both "user not found" and "wrong password"
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Неверные учетные данные"));
        }

        UserEntity user = userOpt.get();
        if (user.getPassword() == null || !passwordEncoder.matches(userDto.getPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "Неверные учетные данные"));
        }

        String token = jwtService.generateToken(user.getUsername(), user.getRole());
        String refreshToken = createRefreshToken(user.getUsername());
        String displayName = user.getFirstName() != null ? user.getFirstName() : user.getUsername();
        return ResponseEntity.ok(new AuthResponse(token, refreshToken, user.getUsername(), user.getRole(), user.getAvatarUrl(), user.getTag(), displayName));
    }

    /**
     * Exchange a valid refresh token for a new access token.
     */
    @PostMapping("/refresh")
    @Transactional
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "refreshToken обязателен"));
        }

        var tokenOpt = refreshTokenRepository.findByToken(refreshToken);
        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Невалидный refresh token"));
        }

        RefreshTokenEntity rt = tokenOpt.get();

        // Check expiry
        LocalDateTime expiresAt = LocalDateTime.parse(rt.getExpiresAt(), FORMATTER);
        if (expiresAt.isBefore(LocalDateTime.now())) {
            refreshTokenRepository.delete(rt);
            return ResponseEntity.status(401).body(Map.of("error", "Refresh token истёк"));
        }

        // Verify user still exists
        var userOpt = userRepository.findByUsername(rt.getUsername());
        if (userOpt.isEmpty()) {
            refreshTokenRepository.delete(rt);
            return ResponseEntity.status(401).body(Map.of("error", "Пользователь не найден"));
        }

        UserEntity user = userOpt.get();

        // Rotate: delete old refresh token, issue new pair
        refreshTokenRepository.delete(rt);
        String newAccessToken = jwtService.generateToken(user.getUsername(), user.getRole());
        String newRefreshToken = createRefreshToken(user.getUsername());

        log.debug("Token refreshed for user '{}'", user.getUsername());

        return ResponseEntity.ok(Map.of(
                "token", newAccessToken,
                "refreshToken", newRefreshToken
        ));
    }

    /**
     * Logout — revoke all refresh tokens for the user.
     */
    @PostMapping("/logout")
    @Transactional
    public ResponseEntity<?> logout(@RequestBody(required = false) Map<String, String> body,
                                    Principal principal) {
        // Try to get username from Principal (authenticated request)
        String username = null;
        if (principal != null) {
            username = principal.getName();
        }

        // Also accept refreshToken in body for unauthenticated logout
        if (body != null && body.containsKey("refreshToken")) {
            var tokenOpt = refreshTokenRepository.findByToken(body.get("refreshToken"));
            if (tokenOpt.isPresent()) {
                username = tokenOpt.get().getUsername();
                refreshTokenRepository.delete(tokenOpt.get());
            }
        }

        if (username != null) {
            refreshTokenRepository.deleteByUsername(username);
            log.info("User '{}' logged out — all refresh tokens revoked", username);
        }

        return ResponseEntity.ok(Map.of("status", "logged_out"));
    }

    // ── Helper ──

    private String createRefreshToken(String username) {
        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        String now = LocalDateTime.now().format(FORMATTER);
        String expiresAt = LocalDateTime.now()
                .plusSeconds(refreshTokenExpirationMs / 1000)
                .format(FORMATTER);

        RefreshTokenEntity rt = new RefreshTokenEntity(token, username, expiresAt, now);
        refreshTokenRepository.save(rt);
        return token;
    }
}
