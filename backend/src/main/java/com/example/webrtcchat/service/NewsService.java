package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.NewsCommentDto;
import com.example.webrtcchat.dto.NewsDto;
import com.example.webrtcchat.entity.NewsCommentEntity;
import com.example.webrtcchat.entity.NewsEntity;
import com.example.webrtcchat.repository.NewsCommentRepository;
import com.example.webrtcchat.repository.NewsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class NewsService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final NewsRepository newsRepository;
    private final NewsCommentRepository commentRepository;

    public NewsService(NewsRepository newsRepository, NewsCommentRepository commentRepository) {
        this.newsRepository = newsRepository;
        this.commentRepository = commentRepository;
    }

    @Transactional(readOnly = true)
    public List<NewsDto> getAllNews() {
        return newsRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(e -> {
                    NewsDto dto = toDto(e);
                    dto.setCommentCount(commentRepository.countByNewsId(e.getId()));
                    return dto;
                }).toList();
    }

    @Transactional
    public NewsDto createNews(String author, String title, String content, String imageUrl) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        NewsEntity entity = new NewsEntity();
        entity.setId(id);
        entity.setAuthor(author);
        entity.setTitle(title);
        entity.setContent(content);
        entity.setImageUrl(imageUrl);
        entity.setCreatedAt(now());
        newsRepository.save(entity);
        NewsDto dto = toDto(entity);
        dto.setCommentCount(0L);
        return dto;
    }

    @Transactional
    public boolean deleteNews(String id, String username) {
        return newsRepository.findById(id)
                .map(entity -> {
                    if (!entity.getAuthor().equals(username)) return false;
                    commentRepository.deleteByNewsId(id);
                    newsRepository.delete(entity);
                    return true;
                })
                .orElse(false);
    }

    // ── Comments ──

    @Transactional(readOnly = true)
    public List<NewsCommentDto> getComments(String newsId) {
        return commentRepository.findByNewsIdOrderByCreatedAtAsc(newsId)
                .stream().map(this::toCommentDto).toList();
    }

    @Transactional
    public NewsCommentDto addComment(String newsId, String author, String text) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        NewsCommentEntity entity = new NewsCommentEntity(id, newsId, author, text, now());
        commentRepository.save(entity);
        return toCommentDto(entity);
    }

    @Transactional
    public boolean deleteComment(String commentId, String username) {
        return commentRepository.findById(commentId)
                .map(entity -> {
                    if (!entity.getAuthor().equals(username)) return false;
                    commentRepository.delete(entity);
                    return true;
                })
                .orElse(false);
    }

    private String now() {
        return LocalDateTime.now().format(FORMATTER);
    }

    private NewsDto toDto(NewsEntity e) {
        return new NewsDto(e.getId(), e.getAuthor(), e.getTitle(), e.getContent(), e.getImageUrl(), e.getCreatedAt());
    }

    private NewsCommentDto toCommentDto(NewsCommentEntity e) {
        return new NewsCommentDto(e.getId(), e.getNewsId(), e.getAuthor(), e.getText(), e.getCreatedAt());
    }
}
