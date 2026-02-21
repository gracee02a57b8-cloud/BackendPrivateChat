package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.NewsCommentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NewsCommentRepository extends JpaRepository<NewsCommentEntity, String> {

    List<NewsCommentEntity> findByNewsIdOrderByCreatedAtAsc(String newsId);

    void deleteByNewsId(String newsId);

    long countByNewsId(String newsId);
}
