package com.example.webrtcchat.controller;

import com.example.webrtcchat.service.JwtService;
import com.example.webrtcchat.service.KeyBundleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(KeyBundleController.class)
@AutoConfigureMockMvc(addFilters = false)
class KeyBundleControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private KeyBundleService keyBundleService;
    @MockBean private JwtService jwtService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // === Upload Bundle ===

    @Test
    @DisplayName("POST /api/keys/bundle - success")
    void uploadBundle_success() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("identityKey", "ik123");
        body.put("signingKey", "sk123");
        body.put("signedPreKey", "spk123");
        body.put("signedPreKeySignature", "sig123");
        body.put("oneTimePreKeys", List.of(Map.of("id", 0, "publicKey", "otk0")));

        mockMvc.perform(post("/api/keys/bundle")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        verify(keyBundleService).uploadBundle(eq("alice"), eq("ik123"), eq("sk123"),
                eq("spk123"), eq("sig123"), anyList());
    }

    @Test
    @DisplayName("POST /api/keys/bundle - missing fields returns 400")
    void uploadBundle_missingFields() throws Exception {
        Map<String, Object> body = Map.of("identityKey", "ik123");

        mockMvc.perform(post("/api/keys/bundle")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Missing required key fields"));
    }

    // === Fetch Bundle ===

    @Test
    @DisplayName("GET /api/keys/bundle/{username} - success")
    void fetchBundle_success() throws Exception {
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("username", "bob");
        bundle.put("identityKey", "ik-bob");
        bundle.put("signedPreKey", "spk-bob");
        bundle.put("oneTimeKeyId", 5);
        bundle.put("oneTimeKey", "otk5");
        when(keyBundleService.fetchBundle("bob")).thenReturn(bundle);

        mockMvc.perform(get("/api/keys/bundle/bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("bob"))
                .andExpect(jsonPath("$.identityKey").value("ik-bob"))
                .andExpect(jsonPath("$.oneTimeKeyId").value(5));
    }

    @Test
    @DisplayName("GET /api/keys/bundle/{username} - user not found returns 404")
    void fetchBundle_notFound() throws Exception {
        when(keyBundleService.fetchBundle("ghost"))
                .thenThrow(new NoSuchElementException("No key bundle"));

        mockMvc.perform(get("/api/keys/bundle/ghost"))
                .andExpect(status().isNotFound());
    }

    // === Replenish Keys ===

    @Test
    @DisplayName("POST /api/keys/replenish - success")
    void replenishKeys_success() throws Exception {
        Map<String, Object> body = Map.of("oneTimePreKeys",
                List.of(Map.of("id", 20, "publicKey", "newKey20")));

        mockMvc.perform(post("/api/keys/replenish")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    @DisplayName("POST /api/keys/replenish - no bundle returns 400")
    void replenishKeys_noBundle() throws Exception {
        doThrow(new NoSuchElementException("No key bundle"))
                .when(keyBundleService).replenishKeys(eq("alice"), anyList());

        Map<String, Object> body = Map.of("oneTimePreKeys",
                List.of(Map.of("id", 20, "publicKey", "newKey20")));

        mockMvc.perform(post("/api/keys/replenish")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Upload a key bundle first"));
    }

    // === Key Count ===

    @Test
    @DisplayName("GET /api/keys/count - returns OTK count")
    void getKeyCount_success() throws Exception {
        when(keyBundleService.getOneTimeKeyCount("alice")).thenReturn(15L);

        mockMvc.perform(get("/api/keys/count")
                        .principal(auth("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(15));
    }

    // === Identity Key ===

    @Test
    @DisplayName("GET /api/keys/identity/{username} - returns identity key")
    void getIdentityKey_success() throws Exception {
        when(keyBundleService.getIdentityKey("bob")).thenReturn("ik-bob-base64");

        mockMvc.perform(get("/api/keys/identity/bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identityKey").value("ik-bob-base64"));
    }

    @Test
    @DisplayName("GET /api/keys/identity/{username} - user not found returns 404")
    void getIdentityKey_notFound() throws Exception {
        when(keyBundleService.getIdentityKey("ghost")).thenReturn(null);

        mockMvc.perform(get("/api/keys/identity/ghost"))
                .andExpect(status().isNotFound());
    }

    // === Identity Key (self) ===

    @Test
    @DisplayName("GET /api/keys/identity/me - returns own identity key")
    void getMyIdentityKey_success() throws Exception {
        when(keyBundleService.getIdentityKey("alice")).thenReturn("ik-alice-base64");

        mockMvc.perform(get("/api/keys/identity/me")
                        .principal(auth("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identityKey").value("ik-alice-base64"));
    }

    @Test
    @DisplayName("GET /api/keys/identity/me - no bundle returns 404")
    void getMyIdentityKey_notFound() throws Exception {
        when(keyBundleService.getIdentityKey("alice")).thenReturn(null);

        mockMvc.perform(get("/api/keys/identity/me")
                        .principal(auth("alice")))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/keys/identity/me - uses authenticated username, not path")
    void getMyIdentityKey_usesAuthenticatedUser() throws Exception {
        when(keyBundleService.getIdentityKey("alice")).thenReturn("ik-alice");
        when(keyBundleService.getIdentityKey("bob")).thenReturn("ik-bob");

        // Even though path is /me, it uses auth principal
        mockMvc.perform(get("/api/keys/identity/me")
                        .principal(auth("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identityKey").value("ik-alice"));

        verify(keyBundleService).getIdentityKey("alice");
        verify(keyBundleService, never()).getIdentityKey("me");
    }

    // === Has Bundle ===

    @Test
    @DisplayName("GET /api/keys/has-bundle/{username} - returns true")
    void hasBundle_true() throws Exception {
        when(keyBundleService.hasBundle("alice")).thenReturn(true);

        mockMvc.perform(get("/api/keys/has-bundle/alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasBundle").value(true));
    }

    @Test
    @DisplayName("GET /api/keys/has-bundle/{username} - returns false")
    void hasBundle_false() throws Exception {
        when(keyBundleService.hasBundle("ghost")).thenReturn(false);

        mockMvc.perform(get("/api/keys/has-bundle/ghost"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasBundle").value(false));
    }

    private static Principal auth(String username) {
        return new UsernamePasswordAuthenticationToken(username, null, List.of());
    }
}
