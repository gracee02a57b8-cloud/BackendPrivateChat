package com.example.webrtcchat.config;

import com.example.webrtcchat.controller.ChatWebSocketHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.util.Arrays;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebSocketConfig.class);

    private final ChatWebSocketHandler chatWebSocketHandler;
    private final String[] allowedOrigins;

    public WebSocketConfig(ChatWebSocketHandler chatWebSocketHandler,
                           @Value("${cors.allowed-origins:http://localhost:*}") String origins) {
        this.chatWebSocketHandler = chatWebSocketHandler;
        this.allowedOrigins = Arrays.stream(origins.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .filter(o -> {
                    if ("*".equals(o)) {
                        log.warn("WebSocket origin wildcard '*' rejected — configure explicit origins via CORS_ORIGINS env var");
                        return false;
                    }
                    return true;
                })
                .toArray(String[]::new);

        log.info("WebSocket allowed origin patterns: {}", Arrays.toString(this.allowedOrigins));

        if (this.allowedOrigins.length == 0) {
            log.warn("No WebSocket origins configured! All connections will be rejected. Set CORS_ORIGINS env var.");
        }
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(chatWebSocketHandler, "/ws/chat")
                .setAllowedOriginPatterns(allowedOrigins);
    }

    /**
     * Increase WebSocket text message buffer size to 64 KB.
     * Default Tomcat limit is 8 KB, which is too small for video call SDP
     * after E2E encryption + base64 encoding (~10-13 KB for video offers).
     * Without this, video CALL_OFFERs are silently dropped by the server.
     */
    @Bean
    @Profile("!test")
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(65536);   // 64 KB
        container.setMaxBinaryMessageBufferSize(65536); // 64 KB
        container.setMaxSessionIdleTimeout(300000L);    // 5 min
        return container;
    }
}