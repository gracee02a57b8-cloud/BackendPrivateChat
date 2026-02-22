package com.example.webrtcchat.dto;

public class AuthResponse {
    private String token;
    private String username;
    private String role;
    private String avatarUrl;

    public AuthResponse() {}

    public AuthResponse(String token, String username, String role) {
        this.token = token;
        this.username = username;
        this.role = role;
    }

    public AuthResponse(String token, String username, String role, String avatarUrl) {
        this.token = token;
        this.username = username;
        this.role = role;
        this.avatarUrl = avatarUrl;
    }

    public String getToken() { return token; }
    public String getUsername() { return username; }
    public String getRole() { return role; }
    public String getAvatarUrl() { return avatarUrl; }
}
