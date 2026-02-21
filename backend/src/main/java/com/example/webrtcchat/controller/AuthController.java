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
        String username = userDto.getUsername().trim();
        if (username.length() > 20) {
            return ResponseEntity.badRequest().body(Map.of("error", "Имя не более 20 символов"));
        }
        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Пользователь уже существует"));
        }

        UserEntity user = new UserEntity(
                username,
                passwordEncoder.encode(userDto.getPassword()),
                LocalDateTime.now().format(FORMATTER)
        );
        userRepository.save(user);

        String token = jwtService.generateToken(username);
        return ResponseEntity.ok(new AuthResponse(token, username));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody UserDto userDto) {
        if (userDto.getUsername() == null || userDto.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Имя пользователя обязательно"));
        }
        if (userDto.getPassword() == null || userDto.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Пароль обязателен"));
        }

        String username = userDto.getUsername().trim();
        var userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Неверные учетные данные"));
        }

        UserEntity user = userOpt.get();
        if (user.getPassword() == null || !passwordEncoder.matches(userDto.getPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "Неверные учетные данные"));
        }

        String token = jwtService.generateToken(username);
        return ResponseEntity.ok(new AuthResponse(token, username));
    }
}
