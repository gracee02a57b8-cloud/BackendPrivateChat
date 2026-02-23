package com.example.webrtcchat.dto;

import java.util.List;

public class StoryDto {

    private String id;
    private String author;
    private String videoUrl;
    private String thumbnailUrl;
    private int duration;
    private String createdAt;
    private String expiresAt;
    private long viewCount;
    private boolean viewedByMe;
    private List<StoryViewDto> viewers;

    public StoryDto() {}

    public StoryDto(String id, String author, String videoUrl, String thumbnailUrl,
                    int duration, String createdAt, String expiresAt) {
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

    public long getViewCount() { return viewCount; }
    public void setViewCount(long viewCount) { this.viewCount = viewCount; }

    public boolean isViewedByMe() { return viewedByMe; }
    public void setViewedByMe(boolean viewedByMe) { this.viewedByMe = viewedByMe; }

    public List<StoryViewDto> getViewers() { return viewers; }
    public void setViewers(List<StoryViewDto> viewers) { this.viewers = viewers; }

    /** Nested view DTO */
    public static class StoryViewDto {
        private String viewer;
        private String viewedAt;

        public StoryViewDto() {}
        public StoryViewDto(String viewer, String viewedAt) {
            this.viewer = viewer;
            this.viewedAt = viewedAt;
        }

        public String getViewer() { return viewer; }
        public void setViewer(String viewer) { this.viewer = viewer; }
        public String getViewedAt() { return viewedAt; }
        public void setViewedAt(String viewedAt) { this.viewedAt = viewedAt; }
    }
}
