package com.example.webrtcchat.dto;

public class UserDto {
    private String username;
    private String password;
    private String tag;
    private boolean online;
    private String lastSeen;
    private String avatarUrl;

    public UserDto() {}

    public UserDto(String username) {
        this.username = username;
    }

    public UserDto(String username, boolean online) {
        this.username = username;
        this.online = online;
    }

    public UserDto(String username, boolean online, String lastSeen) {
        this.username = username;
        this.online = online;
        this.lastSeen = lastSeen;
    }

    public UserDto(String username, boolean online, String lastSeen, String avatarUrl) {
        this.username = username;
        this.online = online;
        this.lastSeen = lastSeen;
        this.avatarUrl = avatarUrl;
    }

    public UserDto(String username, boolean online, String lastSeen, String avatarUrl, String tag) {
        this.username = username;
        this.online = online;
        this.lastSeen = lastSeen;
        this.avatarUrl = avatarUrl;
        this.tag = tag;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public boolean isOnline() { return online; }
    public void setOnline(boolean online) { this.online = online; }

    public String getLastSeen() { return lastSeen; }
    public void setLastSeen(String lastSeen) { this.lastSeen = lastSeen; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }
}
