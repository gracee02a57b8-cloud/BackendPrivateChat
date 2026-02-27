package com.example.webrtcchat.entity;

import com.example.webrtcchat.types.RoomType;
import jakarta.persistence.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "rooms")
public class RoomEntity {

    @Id
    @Column(length = 100)
    private String id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoomType type;

    @Column(length = 50)
    private String createdBy;

    private String createdAt;

    @Column(length = 500)
    private String description;

    @Column(length = 500)
    private String avatarUrl;

    @Column(name = "disappearing_seconds")
    private int disappearingSeconds;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "room_members", joinColumns = @JoinColumn(name = "room_id"))
    @Column(name = "username", length = 50)
    private Set<String> members = new HashSet<>();

    public RoomEntity() {}

    public RoomEntity(String id, String name, RoomType type, String createdBy, String createdAt) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public RoomType getType() { return type; }
    public void setType(RoomType type) { this.type = type; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public Set<String> getMembers() { return members; }
    public void setMembers(Set<String> members) { this.members = members; }

    public int getDisappearingSeconds() { return disappearingSeconds; }
    public void setDisappearingSeconds(int disappearingSeconds) { this.disappearingSeconds = disappearingSeconds; }
}
