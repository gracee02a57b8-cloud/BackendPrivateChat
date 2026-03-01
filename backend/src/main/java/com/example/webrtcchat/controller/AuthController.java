package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.AuthResponse;
import com.example.webrtcchat.dto.UserDto;
import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.service.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(JwtService jwtService, UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/register")
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
        // Save display name (fullname) as firstName if provided
        if (userDto.getFullname() != null && !userDto.getFullname().isBlank()) {
            user.setFirstName(userDto.getFullname().trim());
        }
        userRepository.save(user);

        String token = jwtService.generateToken(username, user.getRole());
        String displayName = user.getFirstName() != null ? user.getFirstName() : username;
        return ResponseEntity.ok(new AuthResponse(token, username, user.getRole(), user.getAvatarUrl(), tag, displayName));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody UserDto userDto) {
        if (userDto.getUsername() == null || userDto.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Имя пользователя или тег обязательны"));
        }
        if (userDto.getPassword() == null || userDto.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Пароль обязателен"));
        }

        String loginInput = userDto.getUsername().trim();
        java.util.Optional<UserEntity> userOpt;

        // If login starts with @, try finding by tag first
        if (loginInput.startsWith("@")) {
            userOpt = userRepository.findByTag(loginInput.toLowerCase());
        } else {
            userOpt = userRepository.findByUsername(loginInput);
            // If not found by username, try finding by tag
            if (userOpt.isEmpty()) {
                userOpt = userRepository.findByTag("@" + loginInput.toLowerCase());
            }
        }

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Неверные учетные данные"));
        }

        UserEntity user = userOpt.get();
        if (user.getPassword() == null || !passwordEncoder.matches(userDto.getPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "Неверные учетные данные"));
        }

        String token = jwtService.generateToken(user.getUsername(), user.getRole());
        String displayName = user.getFirstName() != null ? user.getFirstName() : user.getUsername();
        return ResponseEntity.ok(new AuthResponse(token, user.getUsername(), user.getRole(), user.getAvatarUrl(), user.getTag(), displayName));
    }
}
