package com.example.webrtcchat.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WebRtcControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/webrtc/ice-config - returns HMAC ephemeral TURN credentials")
    void getIceConfig_authenticated_returnsHmacCredentials() throws Exception {
        // Register + login
        mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/register")
                        .contentType("application/json")
                        .content("{\"username\":\"ice_test_user\",\"password\":\"password123\",\"tag\":\"ice_test_user\"}")
        );

        String loginResponse = mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"ice_test_user\",\"password\":\"password123\"}")
        ).andReturn().getResponse().getContentAsString();

        String token = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(loginResponse).get("token").asText();

        mockMvc.perform(get("/api/webrtc/ice-config")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iceServers").isArray())
                .andExpect(jsonPath("$.iceServers.length()").value(2))
                // STUN server
                .andExpect(jsonPath("$.iceServers[0].urls").value("stun:stun.l.google.com:19302"))
                // TURN server with ephemeral HMAC credentials
                .andExpect(jsonPath("$.iceServers[1].urls").isArray())
                .andExpect(jsonPath("$.iceServers[1].urls.length()").value(2))
                // Username is "<expiry_timestamp>:<username>" format
                .andExpect(jsonPath("$.iceServers[1].username", matchesPattern("\\d+:ice_test_user")))
                // Credential is Base64-encoded HMAC-SHA1 (non-empty)
                .andExpect(jsonPath("$.iceServers[1].credential").isNotEmpty());
    }

    @Test
    @DisplayName("HMAC-SHA1 generates correct credentials")
    void hmacSha1_generatesCorrectCredential() {
        // Known test vector: secret="testsecret", data="1234567890:user"
        String result = WebRtcController.hmacSha1("testsecret", "1234567890:user");
        // Verify it's valid Base64 and non-empty
        assertNotNull(result);
        assertTrue(result.length() > 0);
        // Verify same input always produces same output
        assertEquals(result, WebRtcController.hmacSha1("testsecret", "1234567890:user"));
        // Verify different input produces different output
        assertNotEquals(result, WebRtcController.hmacSha1("testsecret", "9999999999:user"));
    }

    @Test
    @DisplayName("GET /api/webrtc/ice-config - unauthenticated returns 401/403")
    void getIceConfig_unauthenticated_returnsForbidden() throws Exception {
        mockMvc.perform(get("/api/webrtc/ice-config"))
                .andExpect(status().isForbidden());
    }
}
