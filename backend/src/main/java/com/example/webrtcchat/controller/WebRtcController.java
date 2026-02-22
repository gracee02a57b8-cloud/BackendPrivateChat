package com.example.webrtcchat.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/webrtc")
public class WebRtcController {

    @Value("${webrtc.stun.url}")
    private String stunUrl;

    @Value("${webrtc.turn.url}")
    private String turnUrl;

    @Value("${webrtc.turn.username}")
    private String turnUsername;

    @Value("${webrtc.turn.credential}")
    private String turnCredential;

    @GetMapping("/ice-config")
    public ResponseEntity<Map<String, Object>> getIceConfig() {
        Map<String, Object> stunServer = Map.of("urls", stunUrl);
        Map<String, Object> turnServer = Map.of(
                "urls", turnUrl,
                "username", turnUsername,
                "credential", turnCredential
        );

        Map<String, Object> config = Map.of(
                "iceServers", List.of(stunServer, turnServer)
        );

        return ResponseEntity.ok(config);
    }
}
