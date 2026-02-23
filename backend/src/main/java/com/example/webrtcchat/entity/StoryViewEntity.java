package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "story_views", indexes = {
    @Index(name = "idx_story_views_story_id", columnList = "storyId"),
    @Index(name = "idx_story_views_viewer", columnList = "viewer")
}, uniqueConstraints = {
    @UniqueConstraint(columnNames = {"storyId", "viewer"})
})
public class StoryViewEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 36, nullable = false)
    private String storyId;

    @Column(length = 50, nullable = false)
    private String viewer;

    @Column(length = 30, nullable = false)
    private String viewedAt;

    public StoryViewEntity() {}

    public StoryViewEntity(String storyId, String viewer, String viewedAt) {
        this.storyId = storyId;
        this.viewer = viewer;
        this.viewedAt = viewedAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getStoryId() { return storyId; }
    public void setStoryId(String storyId) { this.storyId = storyId; }

    public String getViewer() { return viewer; }
    public void setViewer(String viewer) { this.viewer = viewer; }

    public String getViewedAt() { return viewedAt; }
    public void setViewedAt(String viewedAt) { this.viewedAt = viewedAt; }
}
