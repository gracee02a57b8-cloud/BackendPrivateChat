package com.example.webrtcchat.dto;

public class AdminStatsDto {

    private long totalUsers;
    private long onlineUsers;
    private long totalChats;
    private long activeChats;
    private long groupChats;
    private long directChats;

    public AdminStatsDto() {}

    public AdminStatsDto(long totalUsers, long onlineUsers, long totalChats,
                         long activeChats, long groupChats, long directChats) {
        this.totalUsers = totalUsers;
        this.onlineUsers = onlineUsers;
        this.totalChats = totalChats;
        this.activeChats = activeChats;
        this.groupChats = groupChats;
        this.directChats = directChats;
    }

    public long getTotalUsers() { return totalUsers; }
    public void setTotalUsers(long totalUsers) { this.totalUsers = totalUsers; }

    public long getOnlineUsers() { return onlineUsers; }
    public void setOnlineUsers(long onlineUsers) { this.onlineUsers = onlineUsers; }

    public long getTotalChats() { return totalChats; }
    public void setTotalChats(long totalChats) { this.totalChats = totalChats; }

    public long getActiveChats() { return activeChats; }
    public void setActiveChats(long activeChats) { this.activeChats = activeChats; }

    public long getGroupChats() { return groupChats; }
    public void setGroupChats(long groupChats) { this.groupChats = groupChats; }

    public long getDirectChats() { return directChats; }
    public void setDirectChats(long directChats) { this.directChats = directChats; }
}
