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
    ICE_CANDIDATE,

    // E2E group key distribution (relay to target user)
    GROUP_KEY,

    // Conference (group call) signaling
    CONF_JOIN,      // user joined conference → broadcast to all participants
    CONF_LEAVE,     // user left conference → broadcast to all participants
    CONF_PEERS,     // server → new joiner: list of existing peers
    CONF_OFFER,     // peer-to-peer SDP offer within conference
    CONF_ANSWER,    // peer-to-peer SDP answer within conference
    CONF_ICE        // peer-to-peer ICE candidate within conference
}
