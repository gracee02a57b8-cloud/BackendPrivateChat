package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "stories", indexes = {
    @Index(name = "idx_stories_author", columnList = "author"),
    @Index(name = "idx_stories_expires_at", columnList = "expiresAt"),
    @Index(name = "idx_stories_created_at", columnList = "createdAt")
})
public class StoryEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(length = 50, nullable = false)
    private String author;

    @Column(length = 500, nullable = false)
    private String videoUrl;

    @Column(length = 500)
    private String thumbnailUrl;

    /** Duration in seconds */
    @Column
    private int duration;

    @Column(length = 30, nullable = false)
    private String createdAt;

    @Column(length = 30, nullable = false)
    private String expiresAt;

    public StoryEntity() {}

    public StoryEntity(String id, String author, String videoUrl, String thumbnailUrl, int duration, String createdAt, String expiresAt) {
        this.id = id;
        this.author = author;
        this.videoUrl = videoUrl;
        this.thumbnailUrl = thumbnailUrl;
        this.duration = duration;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getVideoUrl() { return videoUrl; }
    public void setVideoUrl(String videoUrl) { this.videoUrl = videoUrl; }

    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }

    public int getDuration() { return duration; }
    public void setDuration(int duration) { this.duration = duration; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getExpiresAt() { return expiresAt; }
    public void setExpiresAt(String expiresAt) { this.expiresAt = expiresAt; }
}
