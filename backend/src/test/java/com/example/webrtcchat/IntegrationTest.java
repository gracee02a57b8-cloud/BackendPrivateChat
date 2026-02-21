package com.example.webrtcchat;

import com.example.webrtcchat.dto.AuthResponse;
import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Full integration test with H2 in-memory database.
 * Tests the complete auth flow: register → login → access protected resources.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false",
        "jwt.secret=test-jwt-secret-key-for-unit-tests-min-32-chars!!",
        "jwt.expiration=3600000",
        "cors.allowed-origins=http://localhost:*",
        "upload.dir=${java.io.tmpdir}/barsik-test-uploads"
})
class IntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("Full auth flow: register → login → access rooms")
    void fullAuthFlow() throws Exception {
        // 1. Register
        MvcResult registerResult = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "integrationUser",
                                "password", "securePass123"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.username").value("integrationUser"))
                .andReturn();

        String registerBody = registerResult.getResponse().getContentAsString();
        AuthResponse registerResponse = objectMapper.readValue(registerBody, AuthResponse.class);
        String token = registerResponse.getToken();
        assertNotNull(token);

        // Verify user in DB
        assertTrue(userRepository.existsByUsername("integrationUser"));
        UserEntity user = userRepository.findByUsername("integrationUser").orElseThrow();
        assertNotNull(user.getPassword());
        assertNotEquals("securePass123", user.getPassword()); // Should be BCrypt encoded

        // 2. Login with same credentials
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "integrationUser",
                                "password", "securePass123"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.username").value("integrationUser"));

        // 3. Access protected endpoint with token
        mockMvc.perform(get("/api/rooms")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // 4. Access without token → 403
        mockMvc.perform(get("/api/rooms"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Register duplicate user returns 400")
    void registerDuplicate() throws Exception {
        // First registration
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "duplicateUser",
                                "password", "pass12345678"
                        ))))
                .andExpect(status().isOk());

        // Second registration with same username
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "duplicateUser",
                                "password", "otherpass123"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Пользователь уже существует"));
    }

    @Test
    @DisplayName("Login with wrong password returns 401")
    void loginWrongPassword() throws Exception {
        // Register
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "wrongPassUser",
                                "password", "correctPass1"
                        ))))
                .andExpect(status().isOk());

        // Login with wrong password
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "wrongPassUser",
                                "password", "wrongPass12"
                        ))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Actuator health endpoint is accessible without auth")
    void healthEndpoint() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Room CRUD flow with auth")
    void roomCrudFlow() throws Exception {
        // Register and get token
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "roomTestUser",
                                "password", "pass12345678"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readValue(
                result.getResponse().getContentAsString(), AuthResponse.class
        ).getToken();

        // Create room
        MvcResult createResult = mockMvc.perform(post("/api/rooms/create")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Test Room"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test Room"))
                .andReturn();

        String roomId = objectMapper.readTree(
                createResult.getResponse().getContentAsString()
        ).get("id").asText();

        // Get room
        mockMvc.perform(get("/api/rooms/" + roomId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test Room"));

        // Get room history
        mockMvc.perform(get("/api/rooms/" + roomId + "/history")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // Delete room
        mockMvc.perform(delete("/api/rooms/" + roomId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("News CRUD flow with auth")
    void newsCrudFlow() throws Exception {
        // Register and get token
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "newsTestUser",
                                "password", "pass12345678"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readValue(
                result.getResponse().getContentAsString(), AuthResponse.class
        ).getToken();

        // Create news
        MvcResult createResult = mockMvc.perform(post("/api/news")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "Big News",
                                "content", "Something happened!"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Big News"))
                .andReturn();

        String newsId = objectMapper.readTree(
                createResult.getResponse().getContentAsString()
        ).get("id").asText();

        // Get all news
        mockMvc.perform(get("/api/news")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // Delete news
        mockMvc.perform(delete("/api/news/" + newsId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }
}
