package com.example.webrtcchat.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "polls")
public class PollEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "room_id", length = 100, nullable = false)
    private String roomId;

    @Column(name = "message_id", length = 36)
    private String messageId;

    @Column(length = 50, nullable = false)
    private String creator;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String question;

    @Column(name = "multi_choice", nullable = false)
    private boolean multiChoice;

    @Column(nullable = false)
    private boolean anonymous;

    @Column(nullable = false)
    private boolean closed;

    @Column(name = "created_at", length = 30, nullable = false)
    private String createdAt;

    @Column(name = "expires_at", length = 30)
    private String expiresAt;

    @OneToMany(mappedBy = "poll", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sortOrder ASC")
    private List<PollOptionEntity> options = new ArrayList<>();

    public PollEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    public String getCreator() { return creator; }
    public void setCreator(String creator) { this.creator = creator; }
    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
    public boolean isMultiChoice() { return multiChoice; }
    public void setMultiChoice(boolean multiChoice) { this.multiChoice = multiChoice; }
    public boolean isAnonymous() { return anonymous; }
    public void setAnonymous(boolean anonymous) { this.anonymous = anonymous; }
    public boolean isClosed() { return closed; }
    public void setClosed(boolean closed) { this.closed = closed; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public String getExpiresAt() { return expiresAt; }
    public void setExpiresAt(String expiresAt) { this.expiresAt = expiresAt; }
    public List<PollOptionEntity> getOptions() { return options; }
    public void setOptions(List<PollOptionEntity> options) { this.options = options; }
}
