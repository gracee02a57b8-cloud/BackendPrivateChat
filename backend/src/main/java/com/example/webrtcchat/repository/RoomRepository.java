package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.RoomEntity;
import com.example.webrtcchat.types.RoomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RoomRepository extends JpaRepository<RoomEntity, String> {

    @Query("SELECT DISTINCT r FROM RoomEntity r LEFT JOIN r.members m " +
           "WHERE r.type <> com.example.webrtcchat.types.RoomType.GENERAL AND m = :username")
    List<RoomEntity> findUserRooms(@Param("username") String username);

    long countByType(RoomType type);

    @Query("SELECT COUNT(DISTINCT m.roomId) FROM MessageEntity m " +
           "WHERE m.roomId <> 'general' AND m.timestamp >= :since")
    long countActiveRoomsSince(@Param("since") String since);
}
