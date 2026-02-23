package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.StoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StoryRepository extends JpaRepository<StoryEntity, String> {

    /** All active (non-expired) stories ordered by creation time */
    @Query("SELECT s FROM StoryEntity s WHERE s.expiresAt > :now ORDER BY s.createdAt DESC")
    List<StoryEntity> findAllActive(@Param("now") String now);

    /** Active stories by specific author */
    @Query("SELECT s FROM StoryEntity s WHERE s.author = :author AND s.expiresAt > :now ORDER BY s.createdAt ASC")
    List<StoryEntity> findByAuthorActive(@Param("author") String author, @Param("now") String now);

    /** Count active stories by author (for max-5 limit) */
    @Query("SELECT COUNT(s) FROM StoryEntity s WHERE s.author = :author AND s.expiresAt > :now")
    long countByAuthorActive(@Param("author") String author, @Param("now") String now);

    /** Delete all expired stories */
    @Modifying
    @Query("DELETE FROM StoryEntity s WHERE s.expiresAt <= :now")
    int deleteExpired(@Param("now") String now);

    /** Find expired stories (to clean up files before deleting) */
    @Query("SELECT s FROM StoryEntity s WHERE s.expiresAt <= :now")
    List<StoryEntity> findExpired(@Param("now") String now);
}
