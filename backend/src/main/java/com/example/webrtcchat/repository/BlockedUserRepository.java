package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.BlockedUserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BlockedUserRepository extends JpaRepository<BlockedUserEntity, Long> {
    List<BlockedUserEntity> findByBlocker(String blocker);
    Optional<BlockedUserEntity> findByBlockerAndBlocked(String blocker, String blocked);
    boolean existsByBlockerAndBlocked(String blocker, String blocked);
    void deleteByBlockerAndBlocked(String blocker, String blocked);
    /** Check if either user has blocked the other */
    boolean existsByBlockerAndBlockedOrBlockerAndBlocked(String blocker1, String blocked1, String blocker2, String blocked2);
}
