package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.PollEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PollRepository extends JpaRepository<PollEntity, String> {

    List<PollEntity> findByRoomId(String roomId);

    Optional<PollEntity> findByMessageId(String messageId);
}
