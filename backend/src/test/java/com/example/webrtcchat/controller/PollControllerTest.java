package com.example.webrtcchat.controller;

import com.example.webrtcchat.entity.PollEntity;
import com.example.webrtcchat.service.JwtService;
import com.example.webrtcchat.service.PollService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.example.webrtcchat.dto.MessageDto;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PollController.class)
@AutoConfigureMockMvc(addFilters = false)
class PollControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PollService pollService;

    @MockBean
    private ChatWebSocketHandler wsHandler;

    @MockBean
    private JwtService jwtService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("POST /api/polls — broadcast includes pollData")
    void createPoll_broadcastIncludesPollData() throws Exception {
        // Prepare mock poll entity
        PollEntity poll = new PollEntity();
        poll.setId("poll-1");
        poll.setRoomId("room1");
        poll.setMessageId("msg-1");
        poll.setCreator("alice");
        poll.setQuestion("Lunch?");
        poll.setCreatedAt("2026-01-01 12:00:00");

        Map<String, Object> pollData = Map.of(
                "pollId", "poll-1",
                "question", "Lunch?",
                "totalVotes", 0,
                "options", List.of(
                        Map.of("id", 1L, "text", "Pizza", "votes", 0, "voters", List.of()),
                        Map.of("id", 2L, "text", "Sushi", "votes", 0, "voters", List.of())
                )
        );

        when(pollService.createPoll(eq("room1"), anyString(), eq("alice"), eq("Lunch?"),
                eq(List.of("Pizza", "Sushi")), eq(false), eq(false)))
                .thenReturn(poll);
        when(pollService.getPollData("poll-1")).thenReturn(pollData);

        mockMvc.perform(post("/api/polls")
                        .principal(() -> "alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "roomId", "room1",
                                "question", "Lunch?",
                                "options", List.of("Pizza", "Sushi")
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pollId").value("poll-1"));

        // Verify broadcast message contains pollData
        ArgumentCaptor<MessageDto> msgCaptor = ArgumentCaptor.forClass(MessageDto.class);
        verify(wsHandler).broadcastMessageToRoom(eq("room1"), msgCaptor.capture());

        MessageDto broadcast = msgCaptor.getValue();
        assertThat(broadcast.getPollData()).isNotNull();
        assertThat(broadcast.getPollData().get("question")).isEqualTo("Lunch?");
        assertThat(broadcast.getPollData().get("options")).isNotNull();
    }

    @Test
    @DisplayName("POST /api/polls — missing fields returns 400")
    void createPoll_missingFields() throws Exception {
        mockMvc.perform(post("/api/polls")
                        .principal(() -> "alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("roomId", "room1"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/polls — less than 2 options returns 400")
    void createPoll_tooFewOptions() throws Exception {
        mockMvc.perform(post("/api/polls")
                        .principal(() -> "alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "roomId", "room1",
                                "question", "Q?",
                                "options", List.of("Only one")
                        ))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/polls/{pollId} — returns poll data")
    void getPoll_success() throws Exception {
        Map<String, Object> pollData = Map.of("pollId", "poll-1", "question", "Q?");
        when(pollService.getPollData("poll-1")).thenReturn(pollData);

        mockMvc.perform(get("/api/polls/poll-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pollId").value("poll-1"));
    }

    @Test
    @DisplayName("GET /api/polls/{pollId} — not found returns 404")
    void getPoll_notFound() throws Exception {
        when(pollService.getPollData("unknown")).thenReturn(null);

        mockMvc.perform(get("/api/polls/unknown"))
                .andExpect(status().isNotFound());
    }
}
