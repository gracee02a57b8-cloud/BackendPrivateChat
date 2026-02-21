package com.example.webrtcchat;

import com.example.webrtcchat.dto.AuthResponse;
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

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Security-focused integration tests.
 * Tests auth bypass, IDOR, file upload attacks, E2E key flow, SQL injection.
 *
 * Uses @TestInstance(PER_CLASS) + @BeforeAll to register users ONCE,
 * avoiding rate-limiter issues (max 10 auth requests/minute).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:securitytestdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false",
        "jwt.secret=security-test-jwt-secret-key-min-32-chars-long!!",
        "jwt.expiration=3600000",
        "cors.allowed-origins=http://localhost:*",
        "upload.dir=${java.io.tmpdir}/barsik-security-test-uploads"
})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SecurityIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    private String tokenAlice;
    private String tokenBob;
    private String tokenEve;

    @BeforeAll
    void registerUsers() throws Exception {
        tokenAlice = registerAndGetToken("sec_alice");
        tokenBob = registerAndGetToken("sec_bob");
        tokenEve = registerAndGetToken("sec_eve");
    }

    // === JWT / Auth Bypass ===

    @Test
    @Order(1)
    @DisplayName("Protected endpoints reject missing token")
    void protectedEndpoints_noToken() throws Exception {
        mockMvc.perform(get("/api/rooms")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/tasks")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/keys/count")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"hack\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(2)
    @DisplayName("Protected endpoints reject invalid/expired token")
    void protectedEndpoints_badToken() throws Exception {
        mockMvc.perform(get("/api/rooms")
                        .header("Authorization", "Bearer invalid.jwt.token"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(3)
    @DisplayName("Malformed auth header is rejected")
    void protectedEndpoints_malformedAuthHeader() throws Exception {
        mockMvc.perform(get("/api/rooms")
                        .header("Authorization", "NotBearer tokenvalue"))
                .andExpect(status().isForbidden());
    }

    // === SQL Injection ===

    @Test
    @Order(10)
    @DisplayName("SQL injection in search query is parameterized")
    void sqlInjection_search() throws Exception {
        mockMvc.perform(get("/api/chat/users?q='; DROP TABLE app_users; --")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk());
        // If table was dropped, this would fail
        mockMvc.perform(get("/api/chat/users?q=test")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk());
    }

    @Test
    @Order(11)
    @DisplayName("SQL injection in room name stored safely")
    void sqlInjection_roomName() throws Exception {
        mockMvc.perform(post("/api/rooms/create")
                        .header("Authorization", "Bearer " + tokenAlice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "'; DELETE FROM rooms; --"
                        ))))
                .andExpect(status().isOk());
    }

    // === XSS Prevention (stored but returned as JSON, not HTML) ===

    @Test
    @Order(20)
    @DisplayName("XSS in room name is stored but returned as JSON (not executed)")
    void xssInRoomName() throws Exception {
        String xssRoom = "<img onerror=alert(1) src=x>";
        MvcResult result = mockMvc.perform(post("/api/rooms/create")
                        .header("Authorization", "Bearer " + tokenAlice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", xssRoom))))
                .andExpect(status().isOk())
                .andReturn();
        // Content-Type is application/json → browser won't execute XSS
        String contentType = result.getResponse().getContentType();
        assertTrue(contentType != null && contentType.contains("json"),
                "Response must be JSON, not HTML");
    }

    @Test
    @Order(21)
    @DisplayName("XSS in news title returned as JSON")
    void xssInNewsTitle() throws Exception {
        mockMvc.perform(post("/api/news")
                        .header("Authorization", "Bearer " + tokenAlice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "<script>steal()</script>",
                                "content", "Normal content"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("<script>steal()</script>"));
    }

    // === IDOR (Insecure Direct Object Reference) ===

    @Test
    @Order(30)
    @DisplayName("Eve cannot access private room between Alice and Bob")
    void idor_privateRoomAccess() throws Exception {
        // Alice creates private room with Bob
        MvcResult pmResult = mockMvc.perform(post("/api/rooms/private/sec_bob")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk())
                .andReturn();

        String pmRoomId = objectMapper.readTree(
                pmResult.getResponse().getContentAsString()
        ).get("id").asText();

        // Eve cannot access the private room
        mockMvc.perform(get("/api/rooms/" + pmRoomId)
                        .header("Authorization", "Bearer " + tokenEve))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(31)
    @DisplayName("Non-creator cannot delete room")
    void idor_deleteRoom() throws Exception {
        MvcResult roomResult = mockMvc.perform(post("/api/rooms/create")
                        .header("Authorization", "Bearer " + tokenAlice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Idor Room"))))
                .andExpect(status().isOk())
                .andReturn();

        String roomId = objectMapper.readTree(
                roomResult.getResponse().getContentAsString()
        ).get("id").asText();

        mockMvc.perform(delete("/api/rooms/" + roomId)
                        .header("Authorization", "Bearer " + tokenBob))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(32)
    @DisplayName("Non-author cannot delete news")
    void idor_deleteNews() throws Exception {
        MvcResult newsResult = mockMvc.perform(post("/api/news")
                        .header("Authorization", "Bearer " + tokenAlice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "Alice's News", "content", "Content"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        String newsId = objectMapper.readTree(
                newsResult.getResponse().getContentAsString()
        ).get("id").asText();

        mockMvc.perform(delete("/api/news/" + newsId)
                        .header("Authorization", "Bearer " + tokenBob))
                .andExpect(status().isForbidden());
    }

    // === File Upload Security ===

    @Test
    @Order(40)
    @DisplayName("File upload requires authentication")
    void fileUpload_requiresAuth() throws Exception {
        org.springframework.mock.web.MockMultipartFile file =
                new org.springframework.mock.web.MockMultipartFile(
                        "file", "test.txt", "text/plain", "hello".getBytes());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .multipart("/api/upload/file").file(file))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(41)
    @DisplayName("Image upload rejects non-image extension")
    void wrongExtensionForImage() throws Exception {
        org.springframework.mock.web.MockMultipartFile file =
                new org.springframework.mock.web.MockMultipartFile(
                        "file", "malware.exe", "image/png",
                        new byte[]{(byte) 0x89, 'P', 'N', 'G'});

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .multipart("/api/upload").file(file)
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isBadRequest());
    }

    // === E2E Key Management Security ===

    @Test
    @Order(50)
    @DisplayName("Key bundle upload requires authentication")
    void keyBundleUpload_requiresAuth() throws Exception {
        mockMvc.perform(post("/api/keys/bundle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identityKey\":\"ik\",\"signingKey\":\"sk\",\"signedPreKey\":\"spk\",\"signedPreKeySignature\":\"sig\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(51)
    @DisplayName("Full E2E key bundle flow: upload → fetch → identity → replenish")
    void fullKeyBundleFlow() throws Exception {
        // Upload bundle
        mockMvc.perform(post("/api/keys/bundle")
                        .header("Authorization", "Bearer " + tokenAlice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "identityKey", "ik-test-base64",
                                "signingKey", "sk-test-base64",
                                "signedPreKey", "spk-test-base64",
                                "signedPreKeySignature", "sig-test-base64",
                                "oneTimePreKeys", java.util.List.of(
                                        Map.of("id", 0, "publicKey", "otk0-base64"),
                                        Map.of("id", 1, "publicKey", "otk1-base64")
                                )
                        ))))
                .andExpect(status().isOk());

        // Verify has-bundle
        mockMvc.perform(get("/api/keys/has-bundle/sec_alice")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasBundle").value(true));

        // Fetch bundle (consumes 1 OTK)
        mockMvc.perform(get("/api/keys/bundle/sec_alice")
                        .header("Authorization", "Bearer " + tokenBob))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identityKey").value("ik-test-base64"))
                .andExpect(jsonPath("$.signedPreKey").value("spk-test-base64"));

        // Verify identity key endpoint
        mockMvc.perform(get("/api/keys/identity/sec_alice")
                        .header("Authorization", "Bearer " + tokenBob))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identityKey").value("ik-test-base64"));

        // Replenish OTKs
        mockMvc.perform(post("/api/keys/replenish")
                        .header("Authorization", "Bearer " + tokenAlice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "oneTimePreKeys", java.util.List.of(
                                        Map.of("id", 10, "publicKey", "otk10-base64")
                                )
                        ))))
                .andExpect(status().isOk());

        // Verify count after replenish
        mockMvc.perform(get("/api/keys/count")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk());
    }

    // === Edge Cases ===

    @Test
    @Order(60)
    @DisplayName("Cannot create private room with yourself")
    void cannotPmSelf() throws Exception {
        mockMvc.perform(post("/api/rooms/private/sec_alice")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Order(61)
    @DisplayName("Room history size parameter is accepted without 500")
    void historyWithLargeSize() throws Exception {
        mockMvc.perform(get("/api/rooms/general/history?page=0&size=9999")
                        .header("Authorization", "Bearer " + tokenAlice))
                .andExpect(status().isOk());
    }

    // === Helper ===

    private String registerAndGetToken(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", username,
                                "password", "securePass123"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readValue(
                result.getResponse().getContentAsString(), AuthResponse.class
        ).getToken();
    }
}
