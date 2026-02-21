package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.types.MessageType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface MessageRepository extends JpaRepository<MessageEntity, String> {

    List<MessageEntity> findByRoomIdOrderByTimestampAsc(String roomId);

    @Query("SELECT m FROM MessageEntity m WHERE m.roomId = :roomId ORDER BY m.timestamp DESC")
    List<MessageEntity> findRecentByRoomId(@Param("roomId") String roomId, Pageable pageable);

    long countByRoomId(String roomId);

    List<MessageEntity> findByRoomIdAndTypeAndSenderNotAndStatusNot(
            String roomId, MessageType type, String sender, String status);

    @Transactional
    void deleteByRoomId(String roomId);
}
