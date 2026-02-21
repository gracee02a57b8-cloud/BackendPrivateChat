package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.TaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<TaskEntity, String> {

    List<TaskEntity> findByAssignedToOrCreatedBy(String assignedTo, String createdBy);

    List<TaskEntity> findByStatusNotAndDeadlineNotNullAndDeadlineLessThan(String status, String deadline);
}
