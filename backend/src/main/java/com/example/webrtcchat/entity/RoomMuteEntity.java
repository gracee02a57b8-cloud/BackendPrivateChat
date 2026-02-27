package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "room_mutes")
public class RoomMuteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 50, nullable = false)
    private String username;

    @Column(name = "room_id", length = 100, nullable = false)
    private String roomId;

    @Column(name = "muted_until", length = 30)
    private String mutedUntil;

    public RoomMuteEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public String getMutedUntil() { return mutedUntil; }
    public void setMutedUntil(String mutedUntil) { this.mutedUntil = mutedUntil; }
}
