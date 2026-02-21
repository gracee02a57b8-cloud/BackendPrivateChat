package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.NewsDto;
import com.example.webrtcchat.entity.NewsEntity;
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

    public NewsService(NewsRepository newsRepository) {
        this.newsRepository = newsRepository;
    }

    @Transactional(readOnly = true)
    public List<NewsDto> getAllNews() {
        return newsRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toDto).toList();
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
        return toDto(entity);
    }

    @Transactional
    public boolean deleteNews(String id, String username) {
        return newsRepository.findById(id)
                .map(entity -> {
                    if (!entity.getAuthor().equals(username)) return false;
                    newsRepository.delete(entity);
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
}
