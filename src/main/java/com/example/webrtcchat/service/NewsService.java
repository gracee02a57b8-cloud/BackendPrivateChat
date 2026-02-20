package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.NewsDto;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class NewsService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final Map<String, NewsDto> news = new ConcurrentHashMap<>();

    public List<NewsDto> getAllNews() {
        return news.values().stream()
                .sorted(Comparator.comparing(NewsDto::getCreatedAt).reversed())
                .toList();
    }

    public NewsDto createNews(String author, String title, String content, String imageUrl) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        NewsDto dto = new NewsDto(id, author, title, content, imageUrl, now());
        news.put(id, dto);
        return dto;
    }

    public boolean deleteNews(String id, String username) {
        NewsDto dto = news.get(id);
        if (dto == null) return false;
        if (!dto.getAuthor().equals(username)) return false;
        news.remove(id);
        return true;
    }

    private String now() {
        return LocalDateTime.now().format(FORMATTER);
    }
}
