package com.example.webrtcchat.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WebRtcControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/webrtc/ice-config - returns ICE servers config (authenticated)")
    void getIceConfig_authenticated_returnsConfig() throws Exception {
        // First get a valid token
        mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/register")
                        .contentType("application/json")
                        .content("{\"username\":\"ice_test_user\",\"password\":\"password123\"}")
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
                .andExpect(jsonPath("$.iceServers[0].urls").exists())
                .andExpect(jsonPath("$.iceServers[1].urls").exists())
                .andExpect(jsonPath("$.iceServers[1].username").exists())
                .andExpect(jsonPath("$.iceServers[1].credential").exists());
    }

    @Test
    @DisplayName("GET /api/webrtc/ice-config - unauthenticated returns 401/403")
    void getIceConfig_unauthenticated_returnsForbidden() throws Exception {
        mockMvc.perform(get("/api/webrtc/ice-config"))
                .andExpect(status().isForbidden());
    }
}
