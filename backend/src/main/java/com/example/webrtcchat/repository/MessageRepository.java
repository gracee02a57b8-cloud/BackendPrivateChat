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

    List<MessageEntity> findByRoomIdAndTypeInAndSenderNotAndStatusNot(
            String roomId, java.util.Collection<MessageType> types, String sender, String status);

    @Transactional
    void deleteByRoomId(String roomId);

    // ── Pinned messages ──

    List<MessageEntity> findByRoomIdAndPinnedTrue(String roomId);

    @Query("SELECT m FROM MessageEntity m WHERE m.disappearsAt IS NOT NULL AND m.disappearsAt <= :now")
    List<MessageEntity> findExpiredDisappearingMessages(@Param("now") String now);

    // ── Media stats queries ──

    @Query("SELECT COUNT(m) FROM MessageEntity m WHERE m.roomId = :roomId AND m.fileUrl IS NOT NULL AND m.fileType LIKE 'image/%'")
    long countPhotosByRoomId(@Param("roomId") String roomId);

    @Query("SELECT COUNT(m) FROM MessageEntity m WHERE m.roomId = :roomId AND m.fileUrl IS NOT NULL AND m.fileType LIKE 'video/%'")
    long countVideosByRoomId(@Param("roomId") String roomId);

    @Query("SELECT COUNT(m) FROM MessageEntity m WHERE m.roomId = :roomId AND m.fileUrl IS NOT NULL AND m.fileType NOT LIKE 'image/%' AND m.fileType NOT LIKE 'video/%'")
    long countFilesByRoomId(@Param("roomId") String roomId);

    @Query("SELECT COUNT(m) FROM MessageEntity m WHERE m.roomId = :roomId AND m.content LIKE '%http%'")
    long countLinksByRoomId(@Param("roomId") String roomId);

    // ── Message search ──

    @Query("SELECT m FROM MessageEntity m WHERE m.roomId = :roomId AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY m.timestamp DESC")
    List<MessageEntity> searchMessages(@Param("roomId") String roomId, @Param("query") String query, Pageable pageable);

    @Query("SELECT m FROM MessageEntity m WHERE m.roomId IN :roomIds AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY m.timestamp DESC")
    List<MessageEntity> searchMessagesGlobal(@Param("roomIds") java.util.Collection<String> roomIds, @Param("query") String query, Pageable pageable);
}
