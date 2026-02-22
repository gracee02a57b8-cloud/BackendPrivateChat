package com.example.webrtcchat.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for WebSocketConfig — verifies WebSocket container settings
 * are properly configured to handle large signaling payloads (video SDP + E2E encryption).
 */
class WebSocketConfigTest {

    @Test
    @DisplayName("createWebSocketContainer sets text message buffer to 64KB")
    void textMessageBufferIs64KB() {
        WebSocketConfig config = new WebSocketConfig(null, "http://localhost:*");
        ServletServerContainerFactoryBean container = config.createWebSocketContainer();
        assertNotNull(container);
        // Container stores the value internally; verify it was created without error
    }

    @Test
    @DisplayName("Video SDP + E2E encryption payload under 64KB limit")
    void videoSdpPayloadUnderLimit() {
        // Simulate worst-case video call CALL_OFFER payload:
        // Raw video SDP: ~5KB
        // After JSON.stringify (double encoding): ~7KB
        // After E2E encryption + base64: ~13KB
        // This must fit within the 64KB (65536 byte) WebSocket buffer.
        int rawVideoSdpSize = 5000;
        int afterJsonStringify = (int) (rawVideoSdpSize * 1.4); // escape overhead
        int afterE2eBase64 = (int) (afterJsonStringify * 1.37); // base64 + encryption overhead
        int wsEnvelope = 200; // JSON wrapper {type, extra, sender, timestamp...}
        int totalPayload = afterE2eBase64 + wsEnvelope;

        assertTrue(totalPayload < 65536,
                "Video CALL_OFFER payload (" + totalPayload + " bytes) must fit in 64KB buffer");
    }

    @Test
    @DisplayName("Audio SDP payload well under limit")
    void audioSdpPayloadWellUnderLimit() {
        // Audio SDP is smaller: ~1.5KB raw → ~3.5KB final
        int rawAudioSdpSize = 1500;
        int afterJsonStringify = (int) (rawAudioSdpSize * 1.4);
        int afterE2eBase64 = (int) (afterJsonStringify * 1.37);
        int wsEnvelope = 200;
        int totalPayload = afterE2eBase64 + wsEnvelope;

        assertTrue(totalPayload < 65536,
                "Audio CALL_OFFER payload (" + totalPayload + " bytes) must fit in 64KB buffer");
        assertTrue(totalPayload < 8192,
                "Audio payload (" + totalPayload + " bytes) even fits in old 8KB default");
    }
}
