package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "chat_folders")
public class ChatFolderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 50, nullable = false)
    private String username;

    @Column(length = 50, nullable = false)
    private String name;

    @Column(length = 10)
    private String emoji;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "chat_folder_rooms", joinColumns = @JoinColumn(name = "folder_id"))
    @Column(name = "room_id", length = 100)
    private java.util.Set<String> roomIds = new java.util.HashSet<>();

    public ChatFolderEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public java.util.Set<String> getRoomIds() { return roomIds; }
    public void setRoomIds(java.util.Set<String> roomIds) { this.roomIds = roomIds; }
}
