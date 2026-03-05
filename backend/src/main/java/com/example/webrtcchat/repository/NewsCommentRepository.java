package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.NewsCommentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NewsCommentRepository extends JpaRepository<NewsCommentEntity, String> {

    List<NewsCommentEntity> findByNewsIdOrderByCreatedAtAsc(String newsId);

    void deleteByNewsId(String newsId);

    long countByNewsId(String newsId);

    // Perf B6: batch count comments for all news in one query
    @Query("SELECT c.newsId, COUNT(c) FROM NewsCommentEntity c WHERE c.newsId IN :newsIds GROUP BY c.newsId")
    List<Object[]> countByNewsIdIn(@Param("newsIds") List<String> newsIds);
}
