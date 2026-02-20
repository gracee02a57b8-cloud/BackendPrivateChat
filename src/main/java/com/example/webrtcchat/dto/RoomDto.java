package com.example.webrtcchat.dto;

import com.example.webrtcchat.types.RoomType;

import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

public class RoomDto {

    private String id;
    private String name;
    private RoomType type;
    private Set<String> members = new CopyOnWriteArraySet<>();
    private String createdBy;
    private String createdAt;

    public RoomDto() {}

    public RoomDto(String id, String name, RoomType type, String createdBy, String createdAt) {
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

    public Set<String> getMembers() { return members; }
    public void setMembers(Set<String> members) { this.members = members; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
