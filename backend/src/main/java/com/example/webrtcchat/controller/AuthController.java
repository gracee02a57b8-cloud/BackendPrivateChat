package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.AuthResponse;
import com.example.webrtcchat.dto.UserDto;
import com.example.webrtcchat.service.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtService jwtService;

    public AuthController(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody UserDto userDto) {
        if (userDto.getUsername() == null || userDto.getUsername().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String username = userDto.getUsername().trim();
        String token = jwtService.generateToken(username);
        return ResponseEntity.ok(new AuthResponse(token, username));
    }
}
