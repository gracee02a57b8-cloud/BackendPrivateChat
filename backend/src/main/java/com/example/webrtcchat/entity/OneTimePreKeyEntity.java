package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "one_time_pre_keys", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"username", "key_id"})
})
public class OneTimePreKeyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 50, nullable = false)
    private String username;

    @Column(name = "key_id", nullable = false)
    private int keyId;

    @Column(name = "public_key", columnDefinition = "TEXT", nullable = false)
    private String publicKey;

    public OneTimePreKeyEntity() {}

    public OneTimePreKeyEntity(String username, int keyId, String publicKey) {
        this.username = username;
        this.keyId = keyId;
        this.publicKey = publicKey;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public int getKeyId() { return keyId; }
    public void setKeyId(int keyId) { this.keyId = keyId; }

    public String getPublicKey() { return publicKey; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }
}
