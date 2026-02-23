package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.ContactEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContactRepository extends JpaRepository<ContactEntity, Long> {
    List<ContactEntity> findByOwner(String owner);
    Optional<ContactEntity> findByOwnerAndContact(String owner, String contact);
    boolean existsByOwnerAndContact(String owner, String contact);
    void deleteByOwnerAndContact(String owner, String contact);
}
