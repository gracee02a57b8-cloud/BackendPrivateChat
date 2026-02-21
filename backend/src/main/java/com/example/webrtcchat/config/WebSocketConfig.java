package com.example.webrtcchat.config;

import com.example.webrtcchat.controller.ChatWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

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
}