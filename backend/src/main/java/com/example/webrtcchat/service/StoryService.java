package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.StoryDto;
import com.example.webrtcchat.entity.StoryEntity;
import com.example.webrtcchat.entity.StoryViewEntity;
import com.example.webrtcchat.repository.StoryRepository;
import com.example.webrtcchat.repository.StoryViewRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class StoryService {

    private static final Logger log = LoggerFactory.getLogger(StoryService.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int MAX_STORIES_PER_USER = 5;
    private static final int STORY_LIFETIME_HOURS = 24;

    private final StoryRepository storyRepository;
    private final StoryViewRepository storyViewRepository;
    private final Path uploadDir;

    public StoryService(StoryRepository storyRepository,
                        StoryViewRepository storyViewRepository,
                        @Value("${upload.dir:uploads}") String uploadDirPath) {
        this.storyRepository = storyRepository;
        this.storyViewRepository = storyViewRepository;
        this.uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
    }

    private String now() {
        return LocalDateTime.now().format(FORMATTER);
    }

    /**
     * Create a new story.
     * @return StoryDto or null if user already has MAX stories
     */
    @Transactional
    public StoryDto createStory(String author, String videoUrl, String thumbnailUrl, int duration) {
        String currentTime = now();

        // Check max stories limit
        long count = storyRepository.countByAuthorActive(author, currentTime);
        if (count >= MAX_STORIES_PER_USER) {
            return null; // caller should return 400
        }

        String id = UUID.randomUUID().toString();
        LocalDateTime createdTime = LocalDateTime.now();
        String createdAt = createdTime.format(FORMATTER);
        String expiresAt = createdTime.plusHours(STORY_LIFETIME_HOURS).format(FORMATTER);

        StoryEntity entity = new StoryEntity(id, author, videoUrl, thumbnailUrl, duration, createdAt, expiresAt);
        storyRepository.save(entity);

        StoryDto dto = toDto(entity, author);
        dto.setViewCount(0);
        dto.setViewedByMe(true); // own story
        return dto;
    }

    /**
     * Get all active stories grouped by author, for a requesting user.
     * Returns list of StoryDto (flat, frontend groups by author).
     */
    @Transactional(readOnly = true)
    public List<StoryDto> getAllActiveStories(String requestingUser) {
        String currentTime = now();
        List<StoryEntity> stories = storyRepository.findAllActive(currentTime);

        // Preload viewed story IDs for the requesting user
        Set<String> viewedIds = new HashSet<>(storyViewRepository.findViewedStoryIdsByViewer(requestingUser));

        return stories.stream().map(s -> {
            StoryDto dto = toDto(s, requestingUser);
            dto.setViewCount(storyViewRepository.countByStoryId(s.getId()));
            dto.setViewedByMe(s.getAuthor().equals(requestingUser) || viewedIds.contains(s.getId()));
            return dto;
        }).collect(Collectors.toList());
    }

    /**
     * Mark a story as viewed by a user.
     */
    @Transactional
    public void viewStory(String storyId, String viewer) {
        if (storyViewRepository.existsByStoryIdAndViewer(storyId, viewer)) {
            return; // already viewed
        }
        StoryViewEntity view = new StoryViewEntity(storyId, viewer, now());
        storyViewRepository.save(view);
    }

    /**
     * Get a single story by ID.
     */
    @Transactional(readOnly = true)
    public StoryDto getStoryById(String storyId) {
        return storyRepository.findById(storyId)
                .map(s -> toDto(s, s.getAuthor()))
                .orElse(null);
    }

    /**
     * Get viewers of a story (only the author should call this).
     */
    @Transactional(readOnly = true)
    public List<StoryDto.StoryViewDto> getStoryViewers(String storyId) {
        return storyViewRepository.findByStoryId(storyId).stream()
                .map(v -> new StoryDto.StoryViewDto(v.getViewer(), v.getViewedAt()))
                .collect(Collectors.toList());
    }

    /**
     * Delete a specific story (by author).
     * @return true if deleted
     */
    @Transactional
    public boolean deleteStory(String storyId, String author) {
        Optional<StoryEntity> opt = storyRepository.findById(storyId);
        if (opt.isEmpty() || !opt.get().getAuthor().equals(author)) {
            return false;
        }
        StoryEntity story = opt.get();
        deleteStoryFile(story.getVideoUrl());
        if (story.getThumbnailUrl() != null) {
            deleteStoryFile(story.getThumbnailUrl());
        }
        storyRepository.delete(story);
        return true;
    }

    /**
     * Cleanup expired stories — runs every hour.
     */
    @Scheduled(fixedRate = 3600000) // 1 hour
    @Transactional
    public void cleanupExpiredStories() {
        String currentTime = now();
        List<StoryEntity> expired = storyRepository.findExpired(currentTime);
        if (expired.isEmpty()) return;

        log.info("Cleaning up {} expired stories", expired.size());
        for (StoryEntity story : expired) {
            deleteStoryFile(story.getVideoUrl());
            if (story.getThumbnailUrl() != null) {
                deleteStoryFile(story.getThumbnailUrl());
            }
        }
        int deleted = storyRepository.deleteExpired(currentTime);
        log.info("Deleted {} expired stories", deleted);
    }

    private void deleteStoryFile(String url) {
        if (url == null) return;
        try {
            // URL is like /api/uploads/uuid.ext — extract filename
            String filename = url.substring(url.lastIndexOf('/') + 1);
            Path filePath = uploadDir.resolve(filename);
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            log.warn("Failed to delete story file: {}", url, e);
        }
    }

    private StoryDto toDto(StoryEntity entity, String requestingUser) {
        return new StoryDto(
                entity.getId(),
                entity.getAuthor(),
                entity.getVideoUrl(),
                entity.getThumbnailUrl(),
                entity.getDuration(),
                entity.getCreatedAt(),
                entity.getExpiresAt()
        );
    }
}
