package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.NewsCommentDto;
import com.example.webrtcchat.dto.NewsDto;
import com.example.webrtcchat.service.NewsService;
import com.example.webrtcchat.service.WebPushService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/news")
public class NewsController {

    private final NewsService newsService;
    private final WebPushService webPushService;

    public NewsController(NewsService newsService, WebPushService webPushService) {
        this.newsService = newsService;
        this.webPushService = webPushService;
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

        // Send push notification to all subscribers about the new news post
        webPushService.sendPushToAllAsync(
                "📰 " + title.trim(),
                content != null && !content.isBlank()
                        ? content.trim().substring(0, Math.min(content.trim().length(), 100))
                        : "Новая публикация в ленте новостей",
                "news", null, principal.getName()
        );

        return ResponseEntity.ok(news);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNews(@PathVariable String id, Principal principal) {
        boolean deleted = newsService.deleteNews(id, principal.getName());
        if (!deleted) return ResponseEntity.status(403).build();
        return ResponseEntity.ok().build();
    }

    // ── Comments ──

    @GetMapping("/{newsId}/comments")
    public ResponseEntity<List<NewsCommentDto>> getComments(@PathVariable String newsId) {
        return ResponseEntity.ok(newsService.getComments(newsId));
    }

    @PostMapping("/{newsId}/comments")
    public ResponseEntity<NewsCommentDto> addComment(
            @PathVariable String newsId,
            @RequestBody Map<String, String> body,
            Principal principal) {
        String text = body.get("text");
        if (text == null || text.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        NewsCommentDto comment = newsService.addComment(newsId, principal.getName(), text.trim());
        return ResponseEntity.ok(comment);
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable String commentId, Principal principal) {
        boolean deleted = newsService.deleteComment(commentId, principal.getName());
        if (!deleted) return ResponseEntity.status(403).build();
        return ResponseEntity.ok().build();
    }
}
