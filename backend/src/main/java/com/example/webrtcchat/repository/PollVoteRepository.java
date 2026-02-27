package com.example.webrtcchat.repository;

import com.example.webrtcchat.entity.PollVoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PollVoteRepository extends JpaRepository<PollVoteEntity, Long> {

    List<PollVoteEntity> findByPollId(String pollId);

    List<PollVoteEntity> findByPollIdAndUsername(String pollId, String username);

    List<PollVoteEntity> findByPollIdAndOptionId(String pollId, Long optionId);

    long countByPollIdAndOptionId(String pollId, Long optionId);

    void deleteByPollIdAndUsernameAndOptionId(String pollId, String username, Long optionId);

    boolean existsByPollIdAndUsernameAndOptionId(String pollId, String username, Long optionId);
}
