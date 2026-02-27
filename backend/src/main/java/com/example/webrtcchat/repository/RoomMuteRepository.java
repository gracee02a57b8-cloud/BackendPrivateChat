package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.RoomMuteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomMuteRepository extends JpaRepository<RoomMuteEntity, Long> {

    Optional<RoomMuteEntity> findByUsernameAndRoomId(String username, String roomId);

    List<RoomMuteEntity> findByUsername(String username);

    void deleteByUsernameAndRoomId(String username, String roomId);

    boolean existsByUsernameAndRoomId(String username, String roomId);
}
