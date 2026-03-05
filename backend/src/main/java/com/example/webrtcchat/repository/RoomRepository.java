package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.RoomEntity;
import com.example.webrtcchat.types.RoomType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<RoomEntity, String> {

    // Perf B2: JOIN FETCH members in a single query instead of N+1
    @EntityGraph(attributePaths = "members")
    @Query("SELECT DISTINCT r FROM RoomEntity r JOIN r.members m " +
           "WHERE r.type <> com.example.webrtcchat.types.RoomType.GENERAL AND m = :username")
    List<RoomEntity> findUserRooms(@Param("username") String username);

    // Perf B2: override findById to eagerly fetch members via EntityGraph
    @Override
    @EntityGraph(attributePaths = "members")
    Optional<RoomEntity> findById(String id);

    long countByType(RoomType type);

    @Query("SELECT COUNT(DISTINCT m.roomId) FROM MessageEntity m " +
           "WHERE m.roomId <> 'general' AND m.timestamp >= :since")
    long countActiveRoomsSince(@Param("since") String since);
}
