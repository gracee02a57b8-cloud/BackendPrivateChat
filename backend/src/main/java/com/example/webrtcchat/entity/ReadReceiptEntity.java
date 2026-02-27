package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "read_receipts")
public class ReadReceiptEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "message_id", length = 36, nullable = false)
    private String messageId;

    @Column(name = "room_id", length = 100, nullable = false)
    private String roomId;

    @Column(length = 50, nullable = false)
    private String username;

    @Column(name = "read_at", length = 30, nullable = false)
    private String readAt;

    public ReadReceiptEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getReadAt() { return readAt; }
    public void setReadAt(String readAt) { this.readAt = readAt; }
}
