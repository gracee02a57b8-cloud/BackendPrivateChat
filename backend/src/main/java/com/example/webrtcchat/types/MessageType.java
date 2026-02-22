package com.example.webrtcchat.types;

public enum MessageType {
    CHAT,
    JOIN,
    LEAVE,
    PRIVATE,
    STATUS_UPDATE,
    READ_RECEIPT,
    EDIT,
    DELETE,
    SCHEDULED,
    TASK_CREATED,
    TASK_COMPLETED,
    TASK_OVERDUE,
    TYPING,
    REPLY_NOTIFICATION,
    MENTION_NOTIFICATION,
    VOICE,
    VIDEO_CIRCLE,
    AVATAR_UPDATE,

    // WebRTC call signaling
    CALL_OFFER,
    CALL_ANSWER,
    CALL_REJECT,
    CALL_END,
    CALL_BUSY,
    ICE_CANDIDATE
}
