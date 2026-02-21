package com.example.webrtcchat.dto;

public class NewsCommentDto {

    private String id;
    private String newsId;
    private String author;
    private String text;
    private String createdAt;

    public NewsCommentDto() {}

    public NewsCommentDto(String id, String newsId, String author, String text, String createdAt) {
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
