package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "user_contacts", uniqueConstraints = @UniqueConstraint(columnNames = {"owner", "contact"}))
public class ContactEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String owner;

    @Column(nullable = false, length = 50)
    private String contact;

    @Column(name = "created_at", length = 30)
    private String createdAt;

    public ContactEntity() {}

    public ContactEntity(String owner, String contact, String createdAt) {
        this.owner = owner;
        this.contact = contact;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }

    public String getContact() { return contact; }
    public void setContact(String contact) { this.contact = contact; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
