package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "news_comments")
public class NewsCommentEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "news_id", nullable = false, length = 36)
    private String newsId;

    @Column(length = 50, nullable = false)
    private String author;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String text;

    @Column(name = "created_at")
    private String createdAt;

    public NewsCommentEntity() {}

    public NewsCommentEntity(String id, String newsId, String author, String text, String createdAt) {
        this.id = id;
        this.newsId = newsId;
        this.author = author;
        this.text = text;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getNewsId() { return newsId; }
    public void setNewsId(String newsId) { this.newsId = newsId; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
