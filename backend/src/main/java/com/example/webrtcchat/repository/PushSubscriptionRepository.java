package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.PushSubscriptionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscriptionEntity, String> {

    List<PushSubscriptionEntity> findByUsername(String username);

    Optional<PushSubscriptionEntity> findByEndpoint(String endpoint);

    void deleteByEndpoint(String endpoint);

    void deleteByUsername(String username);
}
