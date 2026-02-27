package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "poll_votes")
public class PollVoteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "poll_id", length = 36, nullable = false)
    private String pollId;

    @Column(name = "option_id", nullable = false)
    private Long optionId;

    @Column(length = 50, nullable = false)
    private String username;

    public PollVoteEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPollId() { return pollId; }
    public void setPollId(String pollId) { this.pollId = pollId; }
    public Long getOptionId() { return optionId; }
    public void setOptionId(Long optionId) { this.optionId = optionId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}
