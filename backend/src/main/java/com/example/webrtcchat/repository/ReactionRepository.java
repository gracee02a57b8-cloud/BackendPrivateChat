package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.ReactionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReactionRepository extends JpaRepository<ReactionEntity, Long> {

    List<ReactionEntity> findByMessageId(String messageId);

    List<ReactionEntity> findByRoomId(String roomId);

    Optional<ReactionEntity> findByMessageIdAndUsernameAndEmoji(String messageId, String username, String emoji);

    void deleteByMessageIdAndUsernameAndEmoji(String messageId, String username, String emoji);

    long countByMessageId(String messageId);
}
