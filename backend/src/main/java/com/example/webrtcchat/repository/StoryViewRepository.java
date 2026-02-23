package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.StoryViewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StoryViewRepository extends JpaRepository<StoryViewEntity, Long> {

    /** All views for a specific story */
    List<StoryViewEntity> findByStoryId(String storyId);

    /** Count views for a story */
    long countByStoryId(String storyId);

    /** Check if a user already viewed a story */
    boolean existsByStoryIdAndViewer(String storyId, String viewer);

    /** Get all story IDs that a specific user has viewed */
    @Query("SELECT v.storyId FROM StoryViewEntity v WHERE v.viewer = :viewer")
    List<String> findViewedStoryIdsByViewer(@Param("viewer") String viewer);
}
