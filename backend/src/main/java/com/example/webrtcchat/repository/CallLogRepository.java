package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.CallLogEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CallLogRepository extends JpaRepository<CallLogEntity, String> {

    @Query("SELECT c FROM CallLogEntity c WHERE c.caller = :username OR c.callee = :username ORDER BY c.timestamp DESC")
    List<CallLogEntity> findByUsername(@Param("username") String username, Pageable pageable);
}
