package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.AuthResponse;
import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false) // Disable security filters for unit testing controller logic
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // === Register ===

    @Test
    @DisplayName("POST /api/auth/register - success")
    void register_success() throws Exception {
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("$2a$encoded");
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtService.generateToken("newuser")).thenReturn("jwt-token-123");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "newuser",
                                "password", "password123"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token-123"))
                .andExpect(jsonPath("$.username").value("newuser"));

        verify(userRepository).save(any(UserEntity.class));
    }

    @Test
    @DisplayName("POST /api/auth/register - duplicate username returns 400")
    void register_duplicateUsername() throws Exception {
        when(userRepository.existsByUsername("existing")).thenReturn(true);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "existing",
                                "password", "password123"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Пользователь уже существует"));
    }

    @Test
    @DisplayName("POST /api/auth/register - blank username returns 400")
    void register_blankUsername() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "",
                                "password", "password123"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    @DisplayName("POST /api/auth/register - short password returns 400")
    void register_shortPassword() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "user",
                                "password", "short1"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Пароль должен быть не менее 8 символов"));
    }

    @Test
    @DisplayName("POST /api/auth/register - username too long returns 400")
    void register_usernameTooLong() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "a".repeat(21),
                                "password", "password123"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Имя не более 20 символов"));
    }

    // === Login ===

    @Test
    @DisplayName("POST /api/auth/login - success")
    void login_success() throws Exception {
        UserEntity user = new UserEntity("alice", "$2a$encoded", "2026-01-01 12:00:00");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correctpass", "$2a$encoded")).thenReturn(true);
        when(jwtService.generateToken("alice")).thenReturn("jwt-token-alice");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "alice",
                                "password", "correctpass"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token-alice"))
                .andExpect(jsonPath("$.username").value("alice"));
    }

    @Test
    @DisplayName("POST /api/auth/login - wrong password returns 401")
    void login_wrongPassword() throws Exception {
        UserEntity user = new UserEntity("alice", "$2a$encoded", "2026-01-01 12:00:00");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongpass", "$2a$encoded")).thenReturn(false);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "alice",
                                "password", "wrongpass"
                        ))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Неверные учетные данные"));
    }

    @Test
    @DisplayName("POST /api/auth/login - unknown user returns 401")
    void login_unknownUser() throws Exception {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "ghost",
                                "password", "password"
                        ))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Неверные учетные данные"));
    }

    @Test
    @DisplayName("POST /api/auth/login - blank username returns 400")
    void login_blankUsername() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "",
                                "password", "password"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    @DisplayName("POST /api/auth/login - blank password returns 400")
    void login_blankPassword() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "alice",
                                "password", ""
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }
}
