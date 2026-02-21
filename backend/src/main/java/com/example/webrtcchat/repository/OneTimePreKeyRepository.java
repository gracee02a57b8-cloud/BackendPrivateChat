package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.OneTimePreKeyEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OneTimePreKeyRepository extends JpaRepository<OneTimePreKeyEntity, Long> {
    List<OneTimePreKeyEntity> findByUsername(String username);
    Optional<OneTimePreKeyEntity> findFirstByUsername(String username);
    long countByUsername(String username);
    void deleteByUsernameAndKeyId(String username, int keyId);
    void deleteAllByUsername(String username);
}
