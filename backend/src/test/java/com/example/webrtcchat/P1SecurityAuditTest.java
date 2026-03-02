package com.example.webrtcchat;

import com.example.webrtcchat.dto.AuthResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
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
 * P1 Security Audit Tests.
 *
 * Covers:
 *   P1-4  — Room membership authorization (mute, unmute, getMuteStatus, markMessageRead)
 *   P1-5  — /api/chat/history removed
 *   P1-7  — JWT refresh tokens (refresh, logout, rotation)
 *   P1-9  — ContactBlockController uses Principal (no @RequestHeader)
 *   P1-10 — Generic login error messages
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:p1securitytestdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false",
        "jwt.secret=p1-security-test-jwt-secret-min-32-chars-long!!",
        "jwt.expiration=3600000",
        "jwt.refresh-expiration=604800000",
        "cors.allowed-origins=http://localhost:*",
        "upload.dir=${java.io.tmpdir}/barsik-p1-security-test-uploads",
        "rate-limit.max-requests=1000",
        "rate-limit.window-ms=1000"
})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class P1SecurityAuditTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    private String tokenAlice;
    private String tokenBob;
    private String tokenEve;
    private String refreshTokenAlice;
    private String refreshTokenBob;

    @BeforeAll
    void registerUsers() throws Exception {
        var alice = registerAndGetAuthData("p1_alice");
        tokenAlice = alice.getToken();
        refreshTokenAlice = alice.getRefreshToken();

        var bob = registerAndGetAuthData("p1_bob");
        tokenBob = bob.getToken();
        refreshTokenBob = bob.getRefreshToken();

        var eve = registerAndGetAuthData("p1_eve");
        tokenEve = eve.getToken();
    }

    // ═══════════════════════════════════════════════════
    //  P1-4 — Room membership authorization
    // ═══════════════════════════════════════════════════

    @Test
    @Order(1)
    @DisplayName("P1-4: Non-member cannot mute a private room")
    void nonMember_cannotMutePrivateRoom() throws Exception {
        // Alice creates private room with Bob
        String roomId = createPrivateRoom(tokenAlice, "p1_bob");

        // Eve (not a member) tries to mute it
        mockMvc.perform(post("/api/rooms/" + roomId + "/mute")
                        .header("Authorization", "Bearer " + tokenEve))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(2)
    @DisplayName("P1-4: Non-member cannot unmute a private room")
    void nonMember_cannotUnmutePrivateRoom() throws Exception {
        String roomId = createPrivateRoom(tokenAlice, "p1_bob");

        mockMvc.perform(delete("/api/rooms/" + roomId + "/mute")
                        .header("Authorization", "Bearer " + tokenEve))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(3)
    @DisplayName("P1-4: Non-member cannot get mute status of private room")
    void nonMember_cannotGetMuteStatus() throws Exception {
        String roomId = createPrivateRoom(tokenAlice, "p1_bob");

        mockMvc.perform(get("/api/rooms/" + roomId + "/mute")
                        .header("Authorization", "Bearer " + tokenEve))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(4)
    @DisplayName("P1-4: Non-member cannot mark message as read in private room")
    void nonMember_cannotMarkRead() throws Exception {
        String roomId = createPrivateRoom(tokenAlice, "p1_bob");

        mockMvc.perform(post("/api/rooms/" + roomId + "/messages/999/read")
                        .header("Authorization", "Bearer " + tokenEve))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(5)
    @DisplayName("P1-4: Member CAN mute their own private room")
    void member_canMuteOwnPrivateRoom() throws Exception {
        String roomId = createPrivateRoom(tokenAlice, "p1_bob");

        mockMvc.perform(post("/api/rooms/" + roomId + "/mute")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk());
    }

    @Test
    @Order(6)
    @DisplayName("P1-4: Non-member cannot access private room history")
    void nonMember_cannotAccessRoomHistory() throws Exception {
        String roomId = createPrivateRoom(tokenAlice, "p1_bob");

        mockMvc.perform(get("/api/rooms/" + roomId + "/history?page=0&size=20")
                        .header("Authorization", "Bearer " + tokenEve))
                .andExpect(status().isForbidden());
    }

    // ═══════════════════════════════════════════════════
    //  P1-5 — /api/chat/history removed
    // ═══════════════════════════════════════════════════

    @Test
    @Order(10)
    @DisplayName("P1-5: /api/chat/history is no longer accessible (returns 404 or 403)")
    void chatHistory_removed() throws Exception {
        // Should return 404 (no mapping) or 403 (no auth)
        int status = mockMvc.perform(get("/api/chat/history")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andReturn().getResponse().getStatus();

        assertTrue(status == 404 || status == 405,
                "Expected 404 or 405 for removed /api/chat/history, got " + status);
    }

    @Test
    @Order(11)
    @DisplayName("P1-5: /api/chat/users still works (not removed)")
    void chatUsers_stillWorks() throws Exception {
        mockMvc.perform(get("/api/chat/users?q=p1_")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk());
    }

    // ═══════════════════════════════════════════════════
    //  P1-7 — JWT refresh tokens
    // ═══════════════════════════════════════════════════

    @Test
    @Order(20)
    @DisplayName("P1-7: Login returns refreshToken")
    void login_returnsRefreshToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "p1_alice",
                                "password", "securePass123"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.refreshToken").exists())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertNotNull(json.get("refreshToken").asText());
        assertTrue(json.get("refreshToken").asText().length() >= 32, "Refresh token must be at least 32 chars");
    }

    @Test
    @Order(21)
    @DisplayName("P1-7: Register returns refreshToken")
    void register_returnsRefreshToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "p1_newreg",
                                "password", "securePass123",
                                "tag", "p1_newreg"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refreshToken").exists())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertTrue(json.get("refreshToken").asText().length() >= 32);
    }

    @Test
    @Order(22)
    @DisplayName("P1-7: /api/auth/refresh exchanges refreshToken for new accessToken")
    void refresh_exchangesToken() throws Exception {
        // First login to get a fresh refresh token
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "p1_bob",
                                "password", "securePass123"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode loginJson = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String rt = loginJson.get("refreshToken").asText();

        // Use the refresh token
        MvcResult refreshResult = mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", rt))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.refreshToken").exists())
                .andReturn();

        JsonNode refreshJson = objectMapper.readTree(refreshResult.getResponse().getContentAsString());
        assertNotNull(refreshJson.get("token").asText());
        // Rotated — new refresh token should differ from old one
        assertNotEquals(rt, refreshJson.get("refreshToken").asText(), "Refresh token must be rotated");
    }

    @Test
    @Order(23)
    @DisplayName("P1-7: Old refresh token is invalid after rotation")
    void refresh_oldTokenInvalid() throws Exception {
        // Login to get refresh token
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "p1_alice",
                                "password", "securePass123"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode loginJson = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String oldRt = loginJson.get("refreshToken").asText();

        // Use it once (rotation consumes it)
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", oldRt))))
                .andExpect(status().isOk());

        // Try to use the same old refresh token again — should fail
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", oldRt))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(24)
    @DisplayName("P1-7: Refresh with invalid token returns 401")
    void refresh_invalidToken() throws Exception {
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", "nonexistent-token"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(25)
    @DisplayName("P1-7: Refresh with missing refreshToken returns 400")
    void refresh_missingToken() throws Exception {
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Order(26)
    @DisplayName("P1-7: /api/auth/logout revokes all refresh tokens for user")
    void logout_revokesAllTokens() throws Exception {
        // Login to get fresh tokens
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "p1_bob",
                                "password", "securePass123"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode loginJson = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String accessToken = loginJson.get("token").asText();
        String rt = loginJson.get("refreshToken").asText();

        // Logout with both access token and refresh token
        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", rt))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("logged_out"));

        // The refresh token should now be revoked
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", rt))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(27)
    @DisplayName("P1-7: New access token from refresh works for protected endpoints")
    void refresh_newTokenWorksForProtected() throws Exception {
        // Login
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "p1_alice",
                                "password", "securePass123"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode loginJson = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String rt = loginJson.get("refreshToken").asText();

        // Refresh to get new access token
        MvcResult refreshResult = mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", rt))))
                .andExpect(status().isOk())
                .andReturn();

        String newToken = objectMapper.readTree(refreshResult.getResponse().getContentAsString())
                .get("token").asText();

        // Use new token for a protected endpoint
        mockMvc.perform(get("/api/rooms")
                        .header("Authorization", "Bearer " + newToken))
                .andExpect(status().isOk());
    }

    // ═══════════════════════════════════════════════════
    //  P1-9 — Contacts/blocks use Principal
    // ═══════════════════════════════════════════════════

    @Test
    @Order(30)
    @DisplayName("P1-9: GET /api/contacts works with JWT (Principal-based auth)")
    void contacts_worksWithJwt() throws Exception {
        mockMvc.perform(get("/api/contacts")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk());
    }

    @Test
    @Order(31)
    @DisplayName("P1-9: GET /api/contacts returns 403 without token")
    void contacts_forbiddenWithoutToken() throws Exception {
        mockMvc.perform(get("/api/contacts"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(32)
    @DisplayName("P1-9: POST /api/contacts/add works with JWT")
    void addContact_worksWithJwt() throws Exception {
        mockMvc.perform(post("/api/contacts/p1_bob")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk());
    }

    @Test
    @Order(33)
    @DisplayName("P1-9: GET /api/blocks works with JWT")
    void blocks_worksWithJwt() throws Exception {
        mockMvc.perform(get("/api/blocks")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk());
    }

    // ═══════════════════════════════════════════════════
    //  P1-10 — Generic login errors
    // ═══════════════════════════════════════════════════

    @Test
    @Order(40)
    @DisplayName("P1-10: Wrong password returns generic error (no user enumeration)")
    void login_wrongPassword_genericError() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "p1_alice",
                                "password", "wrongPassword"
                        ))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Неверные учетные данные"));
    }

    @Test
    @Order(41)
    @DisplayName("P1-10: Nonexistent user returns same generic error")
    void login_unknownUser_sameError() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "ghost_user_12345",
                                "password", "anyPassword123"
                        ))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Неверные учетные данные"));
    }

    @Test
    @Order(42)
    @DisplayName("P1-10: Both wrong-password and unknown-user return identical HTTP status + error message")
    void login_genericError_identical() throws Exception {
        // Wrong password for existing user
        MvcResult wrongPwd = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "p1_alice",
                                "password", "wrongPassword"
                        ))))
                .andReturn();

        // Nonexistent user
        MvcResult unknownUser = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "nonexistent_xyz",
                                "password", "anyPassword123"
                        ))))
                .andReturn();

        // Status must be identical
        assertEquals(wrongPwd.getResponse().getStatus(), unknownUser.getResponse().getStatus(),
                "HTTP status must be identical for wrong-password and unknown-user");

        // Error message must be identical
        String err1 = objectMapper.readTree(wrongPwd.getResponse().getContentAsString()).get("error").asText();
        String err2 = objectMapper.readTree(unknownUser.getResponse().getContentAsString()).get("error").asText();
        assertEquals(err1, err2, "Error message must be identical to prevent user enumeration");
    }

    // ═══════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════

    private AuthResponse registerAndGetAuthData(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", username,
                                "password", "securePass123",
                                "tag", username
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readValue(
                result.getResponse().getContentAsString(), AuthResponse.class);
    }

    private String createPrivateRoom(String token, String otherUser) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/rooms/private/" + otherUser)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
    }
}
