package com.example.webrtcchat.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Provides ICE server configuration with HMAC-based ephemeral TURN credentials.
 * Uses coturn's TURN REST API (use-auth-secret) for time-limited credentials.
 *
 * Credential format:
 *   username = "<expiry_unix>:<actual_username>"
 *   password = Base64(HMAC-SHA1(secret, username))
 */
@RestController
@RequestMapping("/api/webrtc")
public class WebRtcController {

    private static final long CREDENTIAL_TTL_SECONDS = 86400; // 24 hours

    @Value("${webrtc.stun.url}")
    private String stunUrl;

    @Value("${webrtc.turn.url}")
    private String turnUrl;

    @Value("${webrtc.turn.secret}")
    private String turnSecret;

    @GetMapping("/ice-config")
    public ResponseEntity<Map<String, Object>> getIceConfig(Authentication auth) {
        String user = (auth != null) ? auth.getName() : "anonymous";

        // Generate ephemeral TURN credentials (TURN REST API / HMAC-SHA1)
        long expiry = Instant.now().getEpochSecond() + CREDENTIAL_TTL_SECONDS;
        String tempUsername = expiry + ":" + user;
        String tempPassword = hmacSha1(turnSecret, tempUsername);

        Map<String, Object> stunServer = Map.of("urls", stunUrl);
        Map<String, Object> turnServer = Map.of(
                "urls", List.of(turnUrl, turnUrl + "?transport=tcp"),
                "username", tempUsername,
                "credential", tempPassword
        );

        Map<String, Object> config = Map.of(
                "iceServers", List.of(stunServer, turnServer)
        );

        return ResponseEntity.ok(config);
    }

    /** Compute HMAC-SHA1 and return Base64-encoded result. */
    static String hmacSha1(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(raw);
        } catch (Exception e) {
            throw new RuntimeException("HMAC-SHA1 failed", e);
        }
    }
}
