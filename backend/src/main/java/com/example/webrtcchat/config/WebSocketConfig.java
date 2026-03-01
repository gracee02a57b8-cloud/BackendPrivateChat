package com.example.webrtcchat.config;

import com.example.webrtcchat.controller.ChatWebSocketHandler;
import jakarta.websocket.server.ServerContainer;
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

    private final ChatWebSocketHandler chatWebSocketHandler;
    private final String[] allowedOrigins;

    public WebSocketConfig(ChatWebSocketHandler chatWebSocketHandler,
                           @Value("${cors.allowed-origins:http://localhost:*}") String origins) {
        this.chatWebSocketHandler = chatWebSocketHandler;
        this.allowedOrigins = Arrays.stream(origins.split(","))
                .map(String::trim)
                .toArray(String[]::new);
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