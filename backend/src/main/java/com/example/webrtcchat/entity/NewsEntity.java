package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "news")
public class NewsEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(length = 50)
    private String author;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(length = 500)
    private String imageUrl;

    private String createdAt;

    public NewsEntity() {}

    public NewsEntity(String id, String author, String title, String content, String imageUrl, String createdAt) {
        this.id = id;
        this.author = author;
        this.title = title;
        this.content = content;
        this.imageUrl = imageUrl;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
