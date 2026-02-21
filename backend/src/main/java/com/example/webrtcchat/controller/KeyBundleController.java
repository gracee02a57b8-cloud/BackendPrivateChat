package com.example.webrtcchat.controller;

import com.example.webrtcchat.service.KeyBundleService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/keys")
public class KeyBundleController {

    private final KeyBundleService keyBundleService;

    public KeyBundleController(KeyBundleService keyBundleService) {
        this.keyBundleService = keyBundleService;
    }

    /**
     * Upload a full key bundle (identity + signed pre-key + one-time pre-keys).
     */
    @PostMapping("/bundle")
    public ResponseEntity<?> uploadBundle(@RequestBody Map<String, Object> body,
                                          Authentication auth) {
        String username = auth.getName();
        String identityKey = (String) body.get("identityKey");
        String signingKey = (String) body.get("signingKey");
        String signedPreKey = (String) body.get("signedPreKey");
        String signedPreKeySignature = (String) body.get("signedPreKeySignature");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> oneTimePreKeys =
                (List<Map<String, Object>>) body.get("oneTimePreKeys");

        if (identityKey == null || signingKey == null || signedPreKey == null || signedPreKeySignature == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required key fields"));
        }

        keyBundleService.uploadBundle(username, identityKey, signingKey,
                signedPreKey, signedPreKeySignature, oneTimePreKeys);

        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    /**
     * Fetch a user's key bundle for X3DH. Consumes one OTK.
     */
    @GetMapping("/bundle/{username}")
    public ResponseEntity<?> fetchBundle(@PathVariable String username) {
        try {
            Map<String, Object> bundle = keyBundleService.fetchBundle(username);
            return ResponseEntity.ok(bundle);
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Replenish one-time pre-keys.
     */
    @PostMapping("/replenish")
    public ResponseEntity<?> replenishKeys(@RequestBody Map<String, Object> body,
                                           Authentication auth) {
        String username = auth.getName();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> newKeys =
                (List<Map<String, Object>>) body.get("oneTimePreKeys");

        try {
            keyBundleService.replenishKeys(username, newKeys);
            return ResponseEntity.ok(Map.of("status", "ok"));
        } catch (NoSuchElementException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Upload a key bundle first"));
        }
    }

    /**
     * Get count of remaining one-time pre-keys.
     */
    @GetMapping("/count")
    public ResponseEntity<?> getKeyCount(Authentication auth) {
        String username = auth.getName();
        long count = keyBundleService.getOneTimeKeyCount(username);
        return ResponseEntity.ok(Map.of("count", count));
    }

    /**
     * Check if a user has E2E keys set up.
     */
    @GetMapping("/has-bundle/{username}")
    public ResponseEntity<?> hasBundle(@PathVariable String username) {
        boolean has = keyBundleService.hasBundle(username);
        return ResponseEntity.ok(Map.of("hasBundle", has));
    }
}
