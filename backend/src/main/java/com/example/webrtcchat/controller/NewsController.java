package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.NewsDto;
import com.example.webrtcchat.service.NewsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/news")
public class NewsController {

    private final NewsService newsService;

    public NewsController(NewsService newsService) {
        this.newsService = newsService;
    }

    @GetMapping
    public ResponseEntity<List<NewsDto>> getAllNews() {
        return ResponseEntity.ok(newsService.getAllNews());
    }

    @PostMapping
    public ResponseEntity<NewsDto> createNews(@RequestBody Map<String, String> body, Principal principal) {
        String title = body.get("title");
        String content = body.get("content");
        String imageUrl = body.get("imageUrl");

        if (title == null || title.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        NewsDto news = newsService.createNews(
                principal.getName(),
                title.trim(),
                content != null ? content.trim() : "",
                imageUrl != null ? imageUrl.trim() : null
        );
        return ResponseEntity.ok(news);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNews(@PathVariable String id, Principal principal) {
        boolean deleted = newsService.deleteNews(id, principal.getName());
        if (!deleted) return ResponseEntity.status(403).build();
        return ResponseEntity.ok().build();
    }
}
