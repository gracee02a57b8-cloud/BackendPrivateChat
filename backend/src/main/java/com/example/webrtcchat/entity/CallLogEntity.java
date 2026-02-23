package com.example.webrtcchat.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "call_logs", indexes = {
    @Index(name = "idx_call_logs_caller", columnList = "caller"),
    @Index(name = "idx_call_logs_callee", columnList = "callee"),
    @Index(name = "idx_call_logs_timestamp", columnList = "timestamp")
})
public class CallLogEntity {

    @Id
    @Column(length = 36)
    private String id;

    /** Who initiated the call */
    @Column(length = 50, nullable = false)
    private String caller;

    /** Who was called */
    @Column(length = 50, nullable = false)
    private String callee;

    /** 'audio' or 'video' */
    @Column(length = 10)
    private String callType;

    /** 'completed', 'missed', 'rejected', 'busy', 'unavailable' */
    @Column(length = 20, nullable = false)
    private String status;

    /** Duration in seconds (0 if not answered) */
    private int duration;

    /** ISO-like timestamp "yyyy-MM-dd HH:mm:ss" */
    @Column(nullable = false)
    private String timestamp;

    public CallLogEntity() {}

    public CallLogEntity(String id, String caller, String callee, String callType, String status, int duration, String timestamp) {
        this.id = id;
        this.caller = caller;
        this.callee = callee;
        this.callType = callType;
        this.status = status;
        this.duration = duration;
        this.timestamp = timestamp;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCaller() { return caller; }
    public void setCaller(String caller) { this.caller = caller; }

    public String getCallee() { return callee; }
    public void setCallee(String callee) { this.callee = callee; }

    public String getCallType() { return callType; }
    public void setCallType(String callType) { this.callType = callType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getDuration() { return duration; }
    public void setDuration(int duration) { this.duration = duration; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
}
