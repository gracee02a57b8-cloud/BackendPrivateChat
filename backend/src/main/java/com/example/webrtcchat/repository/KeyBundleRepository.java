package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.KeyBundleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KeyBundleRepository extends JpaRepository<KeyBundleEntity, Long> {
    Optional<KeyBundleEntity> findByUsername(String username);
    boolean existsByUsername(String username);
}
