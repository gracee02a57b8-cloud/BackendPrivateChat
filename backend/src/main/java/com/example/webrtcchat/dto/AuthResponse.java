package com.example.webrtcchat.dto;

public class AuthResponse {
    private String token;
    private String username;
    private String role;
    private String avatarUrl;
    private String tag;

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

    public AuthResponse(String token, String username, String role, String avatarUrl, String tag) {
        this.token = token;
        this.username = username;
        this.role = role;
        this.avatarUrl = avatarUrl;
        this.tag = tag;
    }

    public String getToken() { return token; }
    public String getUsername() { return username; }
    public String getRole() { return role; }
    public String getAvatarUrl() { return avatarUrl; }
    public String getTag() { return tag; }
}
