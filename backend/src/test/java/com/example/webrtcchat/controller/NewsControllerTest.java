package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.NewsDto;
import com.example.webrtcchat.service.JwtService;
import com.example.webrtcchat.service.NewsService;
import com.example.webrtcchat.service.WebPushService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(NewsController.class)
@AutoConfigureMockMvc(addFilters = false)
class NewsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NewsService newsService;

    @MockBean
    private WebPushService webPushService;

    @MockBean
    private JwtService jwtService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("GET /api/news - returns all news")
    void getAllNews_success() throws Exception {
        NewsDto news = new NewsDto("n1", "alice", "Breaking!", "Content", null, "2026-01-01 12:00:00");
        when(newsService.getAllNews()).thenReturn(List.of(news));

        mockMvc.perform(get("/api/news"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("n1"))
                .andExpect(jsonPath("$[0].title").value("Breaking!"));
    }

    @Test
    @DisplayName("POST /api/news - creates news")
    void createNews_success() throws Exception {
        NewsDto created = new NewsDto("n1", "alice", "Title", "Content", null, "2026-01-01 12:00:00");
        when(newsService.createNews("alice", "Title", "Content", null)).thenReturn(created);

        mockMvc.perform(post("/api/news")
                        .principal(() -> "alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "Title",
                                "content", "Content"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Title"));
    }

    @Test
    @DisplayName("POST /api/news - blank title returns 400")
    void createNews_blankTitle() throws Exception {
        mockMvc.perform(post("/api/news")
                        .principal(() -> "alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "",
                                "content", "Content"
                        ))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("DELETE /api/news/{id} - success for author")
    void deleteNews_success() throws Exception {
        when(newsService.deleteNews("n1", "alice")).thenReturn(true);

        mockMvc.perform(delete("/api/news/n1").principal(() -> "alice"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("DELETE /api/news/{id} - returns 403 for non-author")
    void deleteNews_nonAuthor() throws Exception {
        when(newsService.deleteNews("n1", "bob")).thenReturn(false);

        mockMvc.perform(delete("/api/news/n1").principal(() -> "bob"))
                .andExpect(status().isForbidden());
    }
}
