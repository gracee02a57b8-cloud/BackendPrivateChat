package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.ReadReceiptEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReadReceiptRepository extends JpaRepository<ReadReceiptEntity, Long> {

    List<ReadReceiptEntity> findByMessageId(String messageId);

    List<ReadReceiptEntity> findByRoomIdAndUsername(String roomId, String username);

    boolean existsByMessageIdAndUsername(String messageId, String username);
}
