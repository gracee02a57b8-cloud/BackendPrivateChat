package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.ChatFolderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatFolderRepository extends JpaRepository<ChatFolderEntity, Long> {

    List<ChatFolderEntity> findByUsernameOrderBySortOrderAsc(String username);

    long countByUsername(String username);
}
