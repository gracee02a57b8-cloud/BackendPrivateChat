package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "poll_options")
public class PollOptionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "poll_id", nullable = false)
    private PollEntity poll;

    @Column(length = 200, nullable = false)
    private String text;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    public PollOptionEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public PollEntity getPoll() { return poll; }
    public void setPoll(PollEntity poll) { this.poll = poll; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
