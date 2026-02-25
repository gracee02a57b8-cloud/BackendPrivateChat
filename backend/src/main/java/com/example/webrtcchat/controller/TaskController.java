package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.TaskDto;
import com.example.webrtcchat.service.TaskService;
import com.example.webrtcchat.service.WebPushService;
import com.example.webrtcchat.types.MessageType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final ChatWebSocketHandler wsHandler;
    private final WebPushService webPushService;

    public TaskController(TaskService taskService, ChatWebSocketHandler wsHandler,
                          WebPushService webPushService) {
        this.taskService = taskService;
        this.wsHandler = wsHandler;
        this.webPushService = webPushService;
    }

    @GetMapping
    public ResponseEntity<List<TaskDto>> getTasks(Authentication auth) {
        return ResponseEntity.ok(taskService.getTasksForUser(auth.getName()));
    }

    @PostMapping
    public ResponseEntity<TaskDto> createTask(@RequestBody TaskDto task, Authentication auth) {
        task.setCreatedBy(auth.getName());
        TaskDto created = taskService.createTask(task);
        wsHandler.broadcastTaskNotification(MessageType.TASK_CREATED, created);

        // Push notification to assignee (even if offline)
        if (created.getAssignedTo() != null && !created.getAssignedTo().equals(auth.getName())) {
            webPushService.sendPushToUserAsync(created.getAssignedTo(),
                    "📋 Новая задача",
                    auth.getName() + ": " + created.getTitle(),
                    "task", created.getRoomId());
        }
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody TaskDto body, Authentication auth) {
        TaskDto task = taskService.getTask(id);
        if (task == null) return ResponseEntity.notFound().build();
        // Only creator or assignee can update
        if (!auth.getName().equals(task.getCreatedBy()) && !auth.getName().equals(task.getAssignedTo())) {
            return ResponseEntity.status(403).body("Нет доступа");
        }
        TaskDto updated = taskService.updateTaskStatus(id, body.getStatus());
        if ("DONE".equals(body.getStatus())) {
            wsHandler.broadcastTaskNotification(MessageType.TASK_COMPLETED, updated);
            // Push notification to creator that task is completed
            if (updated.getCreatedBy() != null && !updated.getCreatedBy().equals(auth.getName())) {
                webPushService.sendPushToUserAsync(updated.getCreatedBy(),
                        "✅ Задача выполнена",
                        updated.getTitle(),
                        "task", updated.getRoomId());
            }
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTask(@PathVariable String id, Authentication auth) {
        TaskDto task = taskService.getTask(id);
        if (task == null) return ResponseEntity.notFound().build();
        if (!auth.getName().equals(task.getCreatedBy())) {
            return ResponseEntity.status(403).body("Только создатель может удалить задачу");
        }
        taskService.deleteTask(id);
        return ResponseEntity.ok().build();
    }
}
