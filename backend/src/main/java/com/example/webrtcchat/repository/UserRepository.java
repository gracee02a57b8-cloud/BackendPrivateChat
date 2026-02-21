package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUsername(String username);
    boolean existsByUsername(String username);
    List<UserEntity> findByUsernameContainingIgnoreCase(String query);
}
