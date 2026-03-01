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
    CALL_REOFFER,   // mid-call SDP renegotiation (e.g. audio→video upgrade)
    CALL_REANSWER,  // answer to CALL_REOFFER
    ICE_CANDIDATE,

    // E2E group key distribution (relay to target user)
    GROUP_KEY,

    // E2E encryption invitation signaling
    E2E_INVITE,         // initiator → room: "I enabled E2E, please accept"
    E2E_ACCEPT,         // participant → room: "I accepted E2E"
    E2E_DECLINE,        // participant → room: "I declined E2E"

    // Group invite signaling
    GROUP_INVITE,
    GROUP_INVITE_ACCEPT,

    // Call history (displayed in chat)
    CALL_LOG,

    // Conference (group call) signaling
    CONF_JOIN,      // user joined conference → broadcast to all participants
    CONF_LEAVE,     // user left conference → broadcast to all participants
    CONF_PEERS,     // server → new joiner: list of existing peers
    CONF_OFFER,     // peer-to-peer SDP offer within conference
    CONF_ANSWER,    // peer-to-peer SDP answer within conference
    CONF_ICE,       // peer-to-peer ICE candidate within conference
    CONF_INVITE,    // invite a user to an active conference (relay to target)

    // Stories
    STORY_POSTED,   // server → all: new story uploaded

    // Pin / Unpin messages
    PIN,            // client → server: pin a message
    UNPIN,          // client → server: unpin a message

    // Reactions
    REACTION,           // add reaction to a message
    REACTION_REMOVE,    // remove reaction from a message

    // Polls
    POLL,               // create poll / poll data broadcast
    POLL_VOTE,          // vote on a poll
    POLL_CLOSE,         // close a poll

    // Disappearing messages
    DISAPPEARING_SET,   // set disappearing timer for a room

    // Keepalive
    PING,               // client → server heartbeat (no-op)
    PONG,               // server → client heartbeat response

    ERROR           // server → client error notification
}
