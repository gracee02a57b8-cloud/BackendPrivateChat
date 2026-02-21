package com.example.webrtcchat.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "key_bundles")
public class KeyBundleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 50, nullable = false, unique = true)
    private String username;

    @Column(name = "identity_key", columnDefinition = "TEXT", nullable = false)
    private String identityKey;

    @Column(name = "signing_key", columnDefinition = "TEXT", nullable = false)
    private String signingKey;

    @Column(name = "signed_pre_key", columnDefinition = "TEXT", nullable = false)
    private String signedPreKey;

    @Column(name = "signed_pre_key_signature", columnDefinition = "TEXT", nullable = false)
    private String signedPreKeySignature;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void onSave() {
        this.updatedAt = Instant.now();
    }

    public KeyBundleEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getIdentityKey() { return identityKey; }
    public void setIdentityKey(String identityKey) { this.identityKey = identityKey; }

    public String getSigningKey() { return signingKey; }
    public void setSigningKey(String signingKey) { this.signingKey = signingKey; }

    public String getSignedPreKey() { return signedPreKey; }
    public void setSignedPreKey(String signedPreKey) { this.signedPreKey = signedPreKey; }

    public String getSignedPreKeySignature() { return signedPreKeySignature; }
    public void setSignedPreKeySignature(String s) { this.signedPreKeySignature = s; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
