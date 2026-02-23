package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "push_subscriptions")
public class PushSubscriptionEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 255)
    private String username;

    @Column(nullable = false, length = 1024, unique = true)
    private String endpoint;

    @Column(nullable = false, length = 512)
    private String p256dh;

    @Column(name = "auth_key", nullable = false, length = 255)
    private String authKey;

    @Column(name = "created_at", length = 30)
    private String createdAt;

    public PushSubscriptionEntity() {}

    public PushSubscriptionEntity(String id, String username, String endpoint,
                                   String p256dh, String authKey, String createdAt) {
        this.id = id;
        this.username = username;
        this.endpoint = endpoint;
        this.p256dh = p256dh;
        this.authKey = authKey;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public String getP256dh() { return p256dh; }
    public void setP256dh(String p256dh) { this.p256dh = p256dh; }

    public String getAuthKey() { return authKey; }
    public void setAuthKey(String authKey) { this.authKey = authKey; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
