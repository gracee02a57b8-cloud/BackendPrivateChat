package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.TaskDto;
import com.example.webrtcchat.entity.TaskEntity;
import com.example.webrtcchat.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TaskService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Transactional
    public TaskDto createTask(TaskDto task) {
        TaskEntity entity = new TaskEntity();
        entity.setId(UUID.randomUUID().toString());
        entity.setTitle(task.getTitle());
        entity.setDescription(task.getDescription());
        entity.setCreatedBy(task.getCreatedBy());
        entity.setAssignedTo(task.getAssignedTo());
        entity.setDeadline(task.getDeadline());
        entity.setStatus("OPEN");
        entity.setCreatedAt(LocalDateTime.now().format(FORMATTER));
        entity.setRoomId(task.getRoomId());
        taskRepository.save(entity);
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public TaskDto getTask(String id) {
        return taskRepository.findById(id).map(this::toDto).orElse(null);
    }

    @Transactional
    public TaskDto updateTaskStatus(String id, String status) {
        return taskRepository.findById(id)
                .map(entity -> {
                    entity.setStatus(status);
                    taskRepository.save(entity);
                    return toDto(entity);
                })
                .orElse(null);
    }

    @Transactional
    public boolean deleteTask(String id) {
        if (taskRepository.existsById(id)) {
            taskRepository.deleteById(id);
            return true;
        }
        return false;
    }

    @Transactional(readOnly = true)
    public List<TaskDto> getTasksForUser(String username) {
        return taskRepository.findByAssignedToOrCreatedBy(username, username)
                .stream()
                .map(this::toDto)
                .sorted((a, b) -> {
                    int sPriority = statusPriority(a.getStatus()) - statusPriority(b.getStatus());
                    if (sPriority != 0) return sPriority;
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TaskDto> getOverdueTasks() {
        String now = LocalDateTime.now().format(FORMATTER);
        return taskRepository.findByStatusNotAndDeadlineNotNullAndDeadlineLessThan("DONE", now)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    private int statusPriority(String status) {
        return switch (status) {
            case "OPEN" -> 0;
            case "IN_PROGRESS" -> 1;
            case "DONE" -> 2;
            default -> 3;
        };
    }

    private TaskDto toDto(TaskEntity e) {
        TaskDto dto = new TaskDto();
        dto.setId(e.getId());
        dto.setTitle(e.getTitle());
        dto.setDescription(e.getDescription());
        dto.setCreatedBy(e.getCreatedBy());
        dto.setAssignedTo(e.getAssignedTo());
        dto.setDeadline(e.getDeadline());
        dto.setStatus(e.getStatus());
        dto.setCreatedAt(e.getCreatedAt());
        dto.setRoomId(e.getRoomId());
        return dto;
    }
}
