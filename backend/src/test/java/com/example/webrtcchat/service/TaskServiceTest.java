package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.TaskDto;
import com.example.webrtcchat.entity.TaskEntity;
import com.example.webrtcchat.repository.TaskRepository;
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
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private TaskService taskService;

    @Test
    @DisplayName("createTask saves entity with OPEN status")
    void createTask_success() {
        when(taskRepository.save(any(TaskEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskDto input = new TaskDto();
        input.setTitle("Fix bug");
        input.setDescription("Fix the login bug");
        input.setCreatedBy("alice");
        input.setAssignedTo("bob");
        input.setRoomId("general");

        TaskDto result = taskService.createTask(input);

        assertNotNull(result);
        assertNotNull(result.getId());
        assertEquals("Fix bug", result.getTitle());
        assertEquals("OPEN", result.getStatus());
        assertEquals("alice", result.getCreatedBy());

        ArgumentCaptor<TaskEntity> captor = ArgumentCaptor.forClass(TaskEntity.class);
        verify(taskRepository).save(captor.capture());
        assertEquals("OPEN", captor.getValue().getStatus());
    }

    @Test
    @DisplayName("getTask returns task when found")
    void getTask_found() {
        TaskEntity entity = createTaskEntity("t1", "Task", "alice", "OPEN");
        when(taskRepository.findById("t1")).thenReturn(Optional.of(entity));

        TaskDto result = taskService.getTask("t1");
        assertNotNull(result);
        assertEquals("t1", result.getId());
        assertEquals("Task", result.getTitle());
    }

    @Test
    @DisplayName("getTask returns null when not found")
    void getTask_notFound() {
        when(taskRepository.findById("nonexistent")).thenReturn(Optional.empty());
        assertNull(taskService.getTask("nonexistent"));
    }

    @Test
    @DisplayName("updateTaskStatus changes status")
    void updateTaskStatus_success() {
        TaskEntity entity = createTaskEntity("t1", "Task", "alice", "OPEN");
        when(taskRepository.findById("t1")).thenReturn(Optional.of(entity));
        when(taskRepository.save(any(TaskEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskDto result = taskService.updateTaskStatus("t1", "DONE");

        assertNotNull(result);
        assertEquals("DONE", result.getStatus());
        verify(taskRepository).save(entity);
    }

    @Test
    @DisplayName("updateTaskStatus returns null for non-existent task")
    void updateTaskStatus_notFound() {
        when(taskRepository.findById("nonexistent")).thenReturn(Optional.empty());
        assertNull(taskService.updateTaskStatus("nonexistent", "DONE"));
    }

    @Test
    @DisplayName("deleteTask returns true when task exists")
    void deleteTask_success() {
        when(taskRepository.existsById("t1")).thenReturn(true);

        assertTrue(taskService.deleteTask("t1"));
        verify(taskRepository).deleteById("t1");
    }

    @Test
    @DisplayName("deleteTask returns false when task not found")
    void deleteTask_notFound() {
        when(taskRepository.existsById("nonexistent")).thenReturn(false);
        assertFalse(taskService.deleteTask("nonexistent"));
    }

    @Test
    @DisplayName("getTasksForUser returns sorted tasks (OPEN first, then IN_PROGRESS, then DONE)")
    void getTasksForUser_sorted() {
        TaskEntity done = createTaskEntity("t1", "Done task", "alice", "DONE");
        done.setCreatedAt("2026-01-01 12:00:00");
        TaskEntity open = createTaskEntity("t2", "Open task", "alice", "OPEN");
        open.setCreatedAt("2026-01-01 12:01:00");
        TaskEntity inProgress = createTaskEntity("t3", "In-progress task", "alice", "IN_PROGRESS");
        inProgress.setCreatedAt("2026-01-01 12:02:00");

        when(taskRepository.findByAssignedToOrCreatedBy("alice", "alice"))
                .thenReturn(List.of(done, open, inProgress));

        List<TaskDto> result = taskService.getTasksForUser("alice");

        assertEquals(3, result.size());
        assertEquals("OPEN", result.get(0).getStatus());
        assertEquals("IN_PROGRESS", result.get(1).getStatus());
        assertEquals("DONE", result.get(2).getStatus());
    }

    @Test
    @DisplayName("getTasksForUser returns empty list when no tasks")
    void getTasksForUser_empty() {
        when(taskRepository.findByAssignedToOrCreatedBy("alice", "alice"))
                .thenReturn(List.of());

        List<TaskDto> result = taskService.getTasksForUser("alice");
        assertTrue(result.isEmpty());
    }

    // === Helper ===

    private TaskEntity createTaskEntity(String id, String title, String createdBy, String status) {
        TaskEntity e = new TaskEntity();
        e.setId(id);
        e.setTitle(title);
        e.setCreatedBy(createdBy);
        e.setStatus(status);
        e.setCreatedAt("2026-01-01 12:00:00");
        return e;
    }
}
