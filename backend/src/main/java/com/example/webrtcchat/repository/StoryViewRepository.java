package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.StoryViewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public interface StoryViewRepository extends JpaRepository<StoryViewEntity, Long> {

    /** All views for a specific story */
    List<StoryViewEntity> findByStoryId(String storyId);

    /** Count views for a story */
    long countByStoryId(String storyId);

    /** Batch count views for multiple stories in one query (eliminates N+1) */
    @Query("SELECT v.storyId, COUNT(v) FROM StoryViewEntity v WHERE v.storyId IN :storyIds GROUP BY v.storyId")
    List<Object[]> countByStoryIdsRaw(@Param("storyIds") List<String> storyIds);

    default Map<String, Long> countByStoryIds(List<String> storyIds) {
        return countByStoryIdsRaw(storyIds).stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> (Long) r[1]));
    }

    /** Check if a user already viewed a story */
    boolean existsByStoryIdAndViewer(String storyId, String viewer);

    /** Get all story IDs that a specific user has viewed */
    @Query("SELECT v.storyId FROM StoryViewEntity v WHERE v.viewer = :viewer")
    List<String> findViewedStoryIdsByViewer(@Param("viewer") String viewer);
}
