package com.example.webrtcchat.controller;

import com.example.webrtcchat.service.WebPushService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/push")
public class PushController {

    private final WebPushService webPushService;

    public PushController(WebPushService webPushService) {
        this.webPushService = webPushService;
    }

    /**
     * GET /api/push/vapid-key — return the VAPID public key so the frontend
     * can subscribe with the correct applicationServerKey.
     */
    @GetMapping("/vapid-key")
    public ResponseEntity<Map<String, String>> getVapidKey() {
        String key = webPushService.getVapidPublicKey();
        if (key == null || key.isBlank()) {
            return ResponseEntity.status(503).body(Map.of("error", "Push not configured"));
        }
        return ResponseEntity.ok(Map.of("key", key));
    }

    /**
     * POST /api/push/subscribe — store a PushSubscription for the authenticated user.
     * Body: { endpoint, keys: { p256dh, auth } }
     */
    @SuppressWarnings("unchecked")
    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(@RequestBody Map<String, Object> body, Principal principal) {
        String endpoint = (String) body.get("endpoint");
        Map<String, String> keys = (Map<String, String>) body.get("keys");

        if (endpoint == null || keys == null || keys.get("p256dh") == null || keys.get("auth") == null) {
            return ResponseEntity.badRequest().build();
        }

        webPushService.subscribe(
                principal.getName(),
                endpoint,
                keys.get("p256dh"),
                keys.get("auth")
        );
        return ResponseEntity.ok().build();
    }

    /**
     * POST /api/push/unsubscribe — remove a PushSubscription by endpoint.
     * Body: { endpoint }
     */
    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> unsubscribe(@RequestBody Map<String, String> body) {
        String endpoint = body.get("endpoint");
        if (endpoint == null) return ResponseEntity.badRequest().build();

        webPushService.unsubscribe(endpoint);
        return ResponseEntity.ok().build();
    }
}
