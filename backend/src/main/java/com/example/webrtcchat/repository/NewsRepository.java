package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.NewsEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NewsRepository extends JpaRepository<NewsEntity, String> {

    List<NewsEntity> findAllByOrderByCreatedAtDesc();
}
