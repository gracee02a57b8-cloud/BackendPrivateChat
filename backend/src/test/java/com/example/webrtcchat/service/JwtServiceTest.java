package com.example.webrtcchat.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String SECRET = "test-jwt-secret-key-for-unit-tests-min-32-chars!!";
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, 3600000L); // 1 hour
    }

    @Test
    @DisplayName("generateToken returns non-null token")
    void generateToken_returnsToken() {
        String token = jwtService.generateToken("testuser");
        assertNotNull(token);
        assertFalse(token.isBlank());
    }

    @Test
    @DisplayName("extractUsername returns correct username")
    void extractUsername_returnsCorrectUser() {
        String token = jwtService.generateToken("alice");
        String username = jwtService.extractUsername(token);
        assertEquals("alice", username);
    }

    @Test
    @DisplayName("isTokenValid returns true for valid token")
    void isTokenValid_trueForValidToken() {
        String token = jwtService.generateToken("bob");
        assertTrue(jwtService.isTokenValid(token));
    }

    @Test
    @DisplayName("isTokenValid returns false for tampered token")
    void isTokenValid_falseForTamperedToken() {
        String token = jwtService.generateToken("eve");
        String tampered = token.substring(0, token.length() - 5) + "XXXXX";
        assertFalse(jwtService.isTokenValid(tampered));
    }

    @Test
    @DisplayName("isTokenValid returns false for expired token")
    void isTokenValid_falseForExpiredToken() {
        JwtService shortLived = new JwtService(SECRET, -1000L); // already expired
        String token = shortLived.generateToken("expired");
        assertFalse(jwtService.isTokenValid(token));
    }

    @Test
    @DisplayName("isTokenValid returns false for garbage string")
    void isTokenValid_falseForGarbage() {
        assertFalse(jwtService.isTokenValid("not.a.real.jwt"));
    }

    @Test
    @DisplayName("isTokenValid returns false for null or empty")
    void isTokenValid_falseForNullOrEmpty() {
        assertFalse(jwtService.isTokenValid(""));
    }

    @Test
    @DisplayName("Different users get different tokens")
    void differentUsersGetDifferentTokens() {
        String token1 = jwtService.generateToken("user1");
        String token2 = jwtService.generateToken("user2");
        assertNotEquals(token1, token2);
    }

    @Test
    @DisplayName("Token signed with different secret is invalid")
    void tokenFromDifferentSecretIsInvalid() {
        JwtService other = new JwtService("another-secret-key-that-is-32-chars-long!!", 3600000L);
        String token = other.generateToken("attacker");
        assertFalse(jwtService.isTokenValid(token));
    }
}
