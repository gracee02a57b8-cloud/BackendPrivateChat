package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.NewsDto;
import com.example.webrtcchat.entity.NewsEntity;
import com.example.webrtcchat.repository.NewsRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NewsServiceTest {

    @Mock
    private NewsRepository newsRepository;

    @InjectMocks
    private NewsService newsService;

    @Test
    @DisplayName("getAllNews returns news in descending order")
    void getAllNews_returnsSorted() {
        NewsEntity n1 = new NewsEntity("n1", "alice", "News 1", "Content 1", null, "2026-01-01 12:00:00");
        NewsEntity n2 = new NewsEntity("n2", "bob", "News 2", "Content 2", null, "2026-01-02 12:00:00");
        when(newsRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(n2, n1));

        List<NewsDto> result = newsService.getAllNews();

        assertEquals(2, result.size());
        assertEquals("n2", result.get(0).getId());
        assertEquals("n1", result.get(1).getId());
    }

    @Test
    @DisplayName("getAllNews returns empty list when no news")
    void getAllNews_empty() {
        when(newsRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());
        assertTrue(newsService.getAllNews().isEmpty());
    }

    @Test
    @DisplayName("createNews saves entity and returns DTO")
    void createNews_success() {
        when(newsRepository.save(any(NewsEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        NewsDto result = newsService.createNews("alice", "Breaking", "Some content", "/img.png");

        assertNotNull(result);
        assertNotNull(result.getId());
        assertEquals("alice", result.getAuthor());
        assertEquals("Breaking", result.getTitle());
        assertEquals("Some content", result.getContent());
        assertEquals("/img.png", result.getImageUrl());

        verify(newsRepository).save(any(NewsEntity.class));
    }

    @Test
    @DisplayName("createNews with null imageUrl")
    void createNews_noImage() {
        when(newsRepository.save(any(NewsEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        NewsDto result = newsService.createNews("alice", "Title", "Content", null);

        assertNull(result.getImageUrl());
    }

    @Test
    @DisplayName("deleteNews succeeds for author")
    void deleteNews_byAuthor() {
        NewsEntity entity = new NewsEntity("n1", "alice", "Title", "Content", null, "2026-01-01");
        when(newsRepository.findById("n1")).thenReturn(Optional.of(entity));

        assertTrue(newsService.deleteNews("n1", "alice"));
        verify(newsRepository).delete(entity);
    }

    @Test
    @DisplayName("deleteNews fails for non-author")
    void deleteNews_nonAuthor() {
        NewsEntity entity = new NewsEntity("n1", "alice", "Title", "Content", null, "2026-01-01");
        when(newsRepository.findById("n1")).thenReturn(Optional.of(entity));

        assertFalse(newsService.deleteNews("n1", "bob"));
        verify(newsRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteNews returns false for non-existent news")
    void deleteNews_notFound() {
        when(newsRepository.findById("nonexistent")).thenReturn(Optional.empty());
        assertFalse(newsService.deleteNews("nonexistent", "alice"));
    }
}
