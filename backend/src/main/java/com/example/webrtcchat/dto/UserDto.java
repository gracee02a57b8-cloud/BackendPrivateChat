package com.example.webrtcchat.dto;

public class UserDto {
    private String username;
    private String password;
    private boolean online;

    public UserDto() {}

    public UserDto(String username) {
        this.username = username;
    }

    public UserDto(String username, boolean online) {
        this.username = username;
        this.online = online;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public boolean isOnline() { return online; }
    public void setOnline(boolean online) { this.online = online; }
}
