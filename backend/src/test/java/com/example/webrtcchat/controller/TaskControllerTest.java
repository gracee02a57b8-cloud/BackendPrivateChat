package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.TaskDto;
import com.example.webrtcchat.service.JwtService;
import com.example.webrtcchat.service.TaskService;
import com.example.webrtcchat.types.MessageType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TaskController.class)
@AutoConfigureMockMvc(addFilters = false)
class TaskControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private TaskService taskService;
    @MockBean private ChatWebSocketHandler wsHandler;
    @MockBean private JwtService jwtService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // === GET /api/tasks ===

    @Test
    @DisplayName("GET /api/tasks - returns tasks for user")
    void getTasks_success() throws Exception {
        TaskDto task = createTask("t1", "Fix bug", "alice", "bob", "OPEN");
        when(taskService.getTasksForUser("alice")).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks").principal(auth("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("t1"))
                .andExpect(jsonPath("$[0].title").value("Fix bug"));
    }

    @Test
    @DisplayName("GET /api/tasks - empty list when no tasks")
    void getTasks_empty() throws Exception {
        when(taskService.getTasksForUser("alice")).thenReturn(List.of());

        mockMvc.perform(get("/api/tasks").principal(auth("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    // === POST /api/tasks ===

    @Test
    @DisplayName("POST /api/tasks - creates task and broadcasts notification")
    void createTask_success() throws Exception {
        TaskDto input = createTask(null, "New task", "alice", "bob", null);
        TaskDto created = createTask("t1", "New task", "alice", "bob", "OPEN");
        when(taskService.createTask(any(TaskDto.class))).thenReturn(created);

        mockMvc.perform(post("/api/tasks")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("t1"))
                .andExpect(jsonPath("$.status").value("OPEN"));

        verify(wsHandler).broadcastTaskNotification(MessageType.TASK_CREATED, created);
    }

    @Test
    @DisplayName("POST /api/tasks - sets createdBy from auth context")
    void createTask_setsCreatedBy() throws Exception {
        TaskDto created = createTask("t1", "Task", "alice", "bob", "OPEN");
        when(taskService.createTask(argThat(t -> "alice".equals(t.getCreatedBy()))))
                .thenReturn(created);

        mockMvc.perform(post("/api/tasks")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "Task",
                                "assignedTo", "bob"
                        ))))
                .andExpect(status().isOk());

        verify(taskService).createTask(argThat(t -> "alice".equals(t.getCreatedBy())));
    }

    // === PUT /api/tasks/{id}/status ===

    @Test
    @DisplayName("PUT /api/tasks/{id}/status - creator can update status")
    void updateStatus_byCreator() throws Exception {
        TaskDto existing = createTask("t1", "Task", "alice", "bob", "OPEN");
        when(taskService.getTask("t1")).thenReturn(existing);

        TaskDto updated = createTask("t1", "Task", "alice", "bob", "IN_PROGRESS");
        when(taskService.updateTaskStatus("t1", "IN_PROGRESS")).thenReturn(updated);

        mockMvc.perform(put("/api/tasks/t1/status")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "IN_PROGRESS"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    @Test
    @DisplayName("PUT /api/tasks/{id}/status - assignee can update status")
    void updateStatus_byAssignee() throws Exception {
        TaskDto existing = createTask("t1", "Task", "alice", "bob", "OPEN");
        when(taskService.getTask("t1")).thenReturn(existing);

        TaskDto updated = createTask("t1", "Task", "alice", "bob", "DONE");
        when(taskService.updateTaskStatus("t1", "DONE")).thenReturn(updated);

        mockMvc.perform(put("/api/tasks/t1/status")
                        .principal(auth("bob"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "DONE"))))
                .andExpect(status().isOk());

        verify(wsHandler).broadcastTaskNotification(MessageType.TASK_COMPLETED, updated);
    }

    @Test
    @DisplayName("PUT /api/tasks/{id}/status - non-authorized user gets 403")
    void updateStatus_unauthorized() throws Exception {
        TaskDto existing = createTask("t1", "Task", "alice", "bob", "OPEN");
        when(taskService.getTask("t1")).thenReturn(existing);

        mockMvc.perform(put("/api/tasks/t1/status")
                        .principal(auth("eve"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "DONE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PUT /api/tasks/{id}/status - task not found returns 404")
    void updateStatus_notFound() throws Exception {
        when(taskService.getTask("nonexistent")).thenReturn(null);

        mockMvc.perform(put("/api/tasks/nonexistent/status")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "DONE"))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PUT /api/tasks/{id}/status - DONE triggers TASK_COMPLETED notification")
    void updateStatus_doneTriggersNotification() throws Exception {
        TaskDto existing = createTask("t1", "Task", "alice", "bob", "IN_PROGRESS");
        when(taskService.getTask("t1")).thenReturn(existing);

        TaskDto updated = createTask("t1", "Task", "alice", "bob", "DONE");
        when(taskService.updateTaskStatus("t1", "DONE")).thenReturn(updated);

        mockMvc.perform(put("/api/tasks/t1/status")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "DONE"))))
                .andExpect(status().isOk());

        verify(wsHandler).broadcastTaskNotification(MessageType.TASK_COMPLETED, updated);
    }

    @Test
    @DisplayName("PUT /api/tasks/{id}/status - non-DONE status does NOT trigger TASK_COMPLETED")
    void updateStatus_nonDoneNoNotification() throws Exception {
        TaskDto existing = createTask("t1", "Task", "alice", "bob", "OPEN");
        when(taskService.getTask("t1")).thenReturn(existing);

        TaskDto updated = createTask("t1", "Task", "alice", "bob", "IN_PROGRESS");
        when(taskService.updateTaskStatus("t1", "IN_PROGRESS")).thenReturn(updated);

        mockMvc.perform(put("/api/tasks/t1/status")
                        .principal(auth("alice"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "IN_PROGRESS"))))
                .andExpect(status().isOk());

        verify(wsHandler, never()).broadcastTaskNotification(eq(MessageType.TASK_COMPLETED), any());
    }

    // === DELETE /api/tasks/{id} ===

    @Test
    @DisplayName("DELETE /api/tasks/{id} - creator can delete")
    void deleteTask_byCreator() throws Exception {
        TaskDto existing = createTask("t1", "Task", "alice", "bob", "OPEN");
        when(taskService.getTask("t1")).thenReturn(existing);
        when(taskService.deleteTask("t1")).thenReturn(true);

        mockMvc.perform(delete("/api/tasks/t1").principal(auth("alice")))
                .andExpect(status().isOk());

        verify(taskService).deleteTask("t1");
    }

    @Test
    @DisplayName("DELETE /api/tasks/{id} - non-creator gets 403")
    void deleteTask_nonCreator() throws Exception {
        TaskDto existing = createTask("t1", "Task", "alice", "bob", "OPEN");
        when(taskService.getTask("t1")).thenReturn(existing);

        mockMvc.perform(delete("/api/tasks/t1").principal(auth("bob")))
                .andExpect(status().isForbidden());

        verify(taskService, never()).deleteTask(anyString());
    }

    @Test
    @DisplayName("DELETE /api/tasks/{id} - not found returns 404")
    void deleteTask_notFound() throws Exception {
        when(taskService.getTask("nonexistent")).thenReturn(null);

        mockMvc.perform(delete("/api/tasks/nonexistent").principal(auth("alice")))
                .andExpect(status().isNotFound());
    }

    // === Helpers ===

    private TaskDto createTask(String id, String title, String createdBy, String assignedTo, String status) {
        TaskDto dto = new TaskDto();
        dto.setId(id);
        dto.setTitle(title);
        dto.setCreatedBy(createdBy);
        dto.setAssignedTo(assignedTo);
        dto.setStatus(status);
        dto.setRoomId("general");
        return dto;
    }

    private static Principal auth(String username) {
        return new UsernamePasswordAuthenticationToken(username, null, List.of());
    }
}
