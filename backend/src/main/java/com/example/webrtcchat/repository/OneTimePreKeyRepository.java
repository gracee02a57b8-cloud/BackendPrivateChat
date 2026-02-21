package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.OneTimePreKeyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OneTimePreKeyRepository extends JpaRepository<OneTimePreKeyEntity, Long> {
    List<OneTimePreKeyEntity> findByUsername(String username);
    Optional<OneTimePreKeyEntity> findFirstByUsername(String username);
    long countByUsername(String username);
    void deleteByUsernameAndKeyId(String username, int keyId);

    /**
     * Delete all OTKs for a user using a native query.
     * This bypasses Hibernate's entity lifecycle and executes immediately,
     * preventing "duplicate key" constraint violations when re-inserting.
     */
    @Modifying
    @Query("DELETE FROM OneTimePreKeyEntity o WHERE o.username = :username")
    void deleteAllByUsername(@Param("username") String username);
}
