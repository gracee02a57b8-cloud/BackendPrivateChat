package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "blocked_users", uniqueConstraints = @UniqueConstraint(columnNames = {"blocker", "blocked"}))
public class BlockedUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String blocker;

    @Column(nullable = false, length = 50)
    private String blocked;

    @Column(name = "created_at", length = 30)
    private String createdAt;

    public BlockedUserEntity() {}

    public BlockedUserEntity(String blocker, String blocked, String createdAt) {
        this.blocker = blocker;
        this.blocked = blocked;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getBlocker() { return blocker; }
    public void setBlocker(String blocker) { this.blocker = blocker; }

    public String getBlocked() { return blocked; }
    public void setBlocked(String blocked) { this.blocked = blocked; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
