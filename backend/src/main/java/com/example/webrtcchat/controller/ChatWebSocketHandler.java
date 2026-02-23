package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.dto.TaskDto;
import com.example.webrtcchat.entity.CallLogEntity;
import com.example.webrtcchat.repository.CallLogRepository;
import com.example.webrtcchat.service.ChatService;
import com.example.webrtcchat.service.ConferenceService;
import com.example.webrtcchat.service.JwtService;
import com.example.webrtcchat.service.RoomService;
import com.example.webrtcchat.service.SchedulerService;
import com.example.webrtcchat.service.TaskService;
import com.example.webrtcchat.types.MessageType;
import com.example.webrtcchat.types.RoomType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int MAX_MESSAGE_LENGTH = 10_000;

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    private final ChatService chatService;
    private final JwtService jwtService;
    private final RoomService roomService;
    private final SchedulerService schedulerService;
    private final TaskService taskService;
    private final ConferenceService conferenceService;
    private final CallLogRepository callLogRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Track active call start times: "caller:callee" → epoch millis
    private final Map<String, Long> activeCallStartTimes = new ConcurrentHashMap<>();
    // Track active call types: "caller:callee" → "audio"/"video"
    private final Map<String, String> activeCallTypes = new ConcurrentHashMap<>();

    public ChatWebSocketHandler(ChatService chatService, JwtService jwtService, RoomService roomService,
                                SchedulerService schedulerService, TaskService taskService,
                                ConferenceService conferenceService, CallLogRepository callLogRepository) {
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.roomService = roomService;
        this.schedulerService = schedulerService;
        this.taskService = taskService;
        this.conferenceService = conferenceService;
        this.callLogRepository = callLogRepository;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String token = extractToken(session);
        if (token == null || !jwtService.isTokenValid(token)) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
            return;
        }

        String username = jwtService.extractUsername(token);
        session.getAttributes().put("username", username);

        // Session cleanup (I7): close existing session for same user
        WebSocketSession oldSession = userSessions.get(username);
        if (oldSession != null && oldSession.isOpen() && !oldSession.getId().equals(session.getId())) {
            try {
                // Use custom code 4001 so client knows not to reconnect
                oldSession.close(new CloseStatus(4001, "Replaced by new session"));
            } catch (Exception e) {
                log.debug("Failed to close old session for user '{}'", username);
            }
            sessions.remove(oldSession.getId());
        }

        sessions.put(session.getId(), session);
        userSessions.put(username, session);
        chatService.addUser(username);

        log.info("User '{}' connected. Online: {}", username, chatService.getOnlineUsers().size());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String username = (String) session.getAttributes().get("username");
        if (username == null) return;

        // Input validation (I8): limit raw payload size
        if (message.getPayloadLength() > 50_000) {
            log.warn("Oversized message from '{}': {} bytes", username, message.getPayloadLength());
            return;
        }

        MessageDto incoming;
        try {
            incoming = objectMapper.readValue(message.getPayload(), MessageDto.class);
        } catch (Exception e) {
            log.warn("Invalid JSON from '{}': {}", username, e.getMessage());
            return;
        }

        // Input validation (I8): limit content length
        if (incoming.getContent() != null && incoming.getContent().length() > MAX_MESSAGE_LENGTH) {
            incoming.setContent(incoming.getContent().substring(0, MAX_MESSAGE_LENGTH));
        }

        // Handle READ_RECEIPT
        if (incoming.getType() == MessageType.READ_RECEIPT) {
            handleReadReceipt(username, incoming.getRoomId());
            return;
        }

        // Handle TYPING - broadcast to room members except sender
        if (incoming.getType() == MessageType.TYPING) {
            handleTyping(username, incoming.getRoomId());
            return;
        }

        // Handle AVATAR_UPDATE - broadcast to all online users
        if (incoming.getType() == MessageType.AVATAR_UPDATE) {
            handleAvatarUpdate(username, incoming);
            return;
        }

        // Handle conference (group call) signaling
        if (incoming.getType() == MessageType.CONF_OFFER
                || incoming.getType() == MessageType.CONF_ANSWER
                || incoming.getType() == MessageType.CONF_ICE) {
            handleConferenceRelay(username, incoming);
            return;
        }
        if (incoming.getType() == MessageType.CONF_JOIN) {
            handleConferenceJoin(username, incoming);
            return;
        }
        if (incoming.getType() == MessageType.CONF_LEAVE) {
            handleConferenceLeave(username, incoming);
            return;
        }

        // Handle WebRTC call signaling + E2E group key relay (relay to target user)
        if (incoming.getType() == MessageType.CALL_OFFER
                || incoming.getType() == MessageType.CALL_ANSWER
                || incoming.getType() == MessageType.CALL_REJECT
                || incoming.getType() == MessageType.CALL_END
                || incoming.getType() == MessageType.CALL_BUSY
                || incoming.getType() == MessageType.ICE_CANDIDATE
                || incoming.getType() == MessageType.GROUP_KEY) {
            handleCallSignaling(username, incoming);
            return;
        }

        // Handle EDIT
        if (incoming.getType() == MessageType.EDIT) {
            handleEdit(username, incoming);
            return;
        }

        // Handle DELETE
        if (incoming.getType() == MessageType.DELETE) {
            handleDelete(username, incoming);
            return;
        }

        // Handle SCHEDULED
        if (incoming.getType() == MessageType.SCHEDULED) {
            handleScheduled(username, incoming);
            return;
        }

        // Regular CHAT message
        incoming.setSender(username);
        incoming.setTimestamp(now());
        // Preserve VOICE / VIDEO_CIRCLE type from frontend, otherwise set CHAT
        if (incoming.getType() != MessageType.VOICE && incoming.getType() != MessageType.VIDEO_CIRCLE
                && incoming.getType() != MessageType.AVATAR_UPDATE) {
            incoming.setType(MessageType.CHAT);
        }
        incoming.setId(UUID.randomUUID().toString());
        incoming.setStatus("SENT");

        String roomId = incoming.getRoomId();
        if (roomId == null || roomId.isEmpty()) {
            log.warn("User '{}' sent message without roomId", username);
            return;
        }
        incoming.setRoomId(roomId);

        // Room membership check (C9)
        if (!isUserInRoom(username, roomId)) {
            log.warn("User '{}' tried to send to room '{}' without membership", username, roomId);
            return;
        }

        chatService.send(roomId, incoming);
        broadcastToRoom(roomId, incoming);

        // Check if any recipient is online → mark as DELIVERED
        sendDeliveryStatus(username, incoming, roomId);

        // Send REPLY_NOTIFICATION to the original message author
        if (incoming.getReplyToSender() != null
                && !incoming.getReplyToSender().isEmpty()
                && !incoming.getReplyToSender().equals(username)) {
            sendReplyNotification(username, incoming);
        }

        // Send MENTION_NOTIFICATION to each @mentioned user
        if (incoming.getMentions() != null && !incoming.getMentions().isEmpty()) {
            sendMentionNotifications(username, incoming);
        }
    }

    /**
     * Check if user is a member of the room (C9).
     */
    private boolean isUserInRoom(String username, String roomId) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return false;
        if (room.getType() == RoomType.GENERAL) return true;
        return room.getMembers().contains(username);
    }

    private void handleEdit(String username, MessageDto incoming) {
        String roomId = incoming.getRoomId();
        String msgId = incoming.getId();
        if (roomId == null || msgId == null) return;
        if (!isUserInRoom(username, roomId)) return;

        MessageDto original = chatService.findMessage(roomId, msgId);
        if (original == null || !original.getSender().equals(username)) return;

        // Validate edit content length (I8)
        String newContent = incoming.getContent();
        if (newContent != null && newContent.length() > MAX_MESSAGE_LENGTH) {
            newContent = newContent.substring(0, MAX_MESSAGE_LENGTH);
        }

        chatService.editMessage(roomId, msgId, newContent);

        MessageDto broadcast = new MessageDto();
        broadcast.setType(MessageType.EDIT);
        broadcast.setId(msgId);
        broadcast.setRoomId(roomId);
        broadcast.setContent(newContent);
        broadcast.setSender(username);
        broadcast.setEdited(true);
        broadcastToRoom(roomId, broadcast);
    }

    private void handleDelete(String username, MessageDto incoming) {
        String roomId = incoming.getRoomId();
        String msgId = incoming.getId();
        if (roomId == null || msgId == null) return;
        if (!isUserInRoom(username, roomId)) return;

        MessageDto original = chatService.findMessage(roomId, msgId);
        if (original == null || !original.getSender().equals(username)) return;

        chatService.deleteMessage(roomId, msgId);

        MessageDto broadcast = new MessageDto();
        broadcast.setType(MessageType.DELETE);
        broadcast.setId(msgId);
        broadcast.setRoomId(roomId);
        broadcast.setSender(username);
        broadcastToRoom(roomId, broadcast);
    }

    private void handleScheduled(String username, MessageDto incoming) {
        String roomId = incoming.getRoomId();
        if (roomId == null || roomId.isEmpty()) return;
        if (!isUserInRoom(username, roomId)) return;
        String scheduledAt = incoming.getScheduledAt();
        if (scheduledAt == null) return;

        incoming.setSender(username);
        incoming.setId(UUID.randomUUID().toString());
        incoming.setRoomId(roomId);

        final String finalRoomId = roomId;
        schedulerService.schedule(incoming.getId(), scheduledAt, () -> {
            incoming.setType(MessageType.CHAT);
            incoming.setTimestamp(now());
            incoming.setStatus("SENT");
            incoming.setScheduledAt(null);
            chatService.send(finalRoomId, incoming);
            broadcastToRoom(finalRoomId, incoming);
            sendDeliveryStatus(incoming.getSender(), incoming, finalRoomId);
        });

        // Send confirmation back to sender
        MessageDto confirm = new MessageDto();
        confirm.setType(MessageType.SCHEDULED);
        confirm.setId(incoming.getId());
        confirm.setContent(incoming.getContent());
        confirm.setScheduledAt(scheduledAt);
        confirm.setRoomId(roomId);
        confirm.setSender(username);
        confirm.setTimestamp(now());
        WebSocketSession senderSession = userSessions.get(username);
        if (senderSession != null) {
            sendSafe(senderSession, serialize(confirm));
        }
    }

    public void broadcastTaskNotification(MessageType type, TaskDto task) {
        MessageDto notification = new MessageDto();
        notification.setType(type);
        notification.setId(task.getId());
        notification.setSender(task.getCreatedBy());
        notification.setContent(task.getTitle());
        notification.setRoomId(task.getRoomId());
        notification.setTimestamp(now());

        // Pass task details in extra map for rich notification popup
        java.util.Map<String, String> extra = new java.util.LinkedHashMap<>();
        if (task.getDescription() != null) extra.put("description", task.getDescription());
        if (task.getAssignedTo() != null) extra.put("assignedTo", task.getAssignedTo());
        if (task.getDeadline() != null) extra.put("deadline", task.getDeadline());
        if (task.getStatus() != null) extra.put("taskStatus", task.getStatus());
        if (!extra.isEmpty()) notification.setExtra(extra);

        // Notify creator
        WebSocketSession creatorSession = userSessions.get(task.getCreatedBy());
        if (creatorSession != null) {
            sendSafe(creatorSession, serialize(notification));
        }

        // Notify assignee
        if (task.getAssignedTo() != null && !task.getAssignedTo().equals(task.getCreatedBy())) {
            WebSocketSession assigneeSession = userSessions.get(task.getAssignedTo());
            if (assigneeSession != null) {
                sendSafe(assigneeSession, serialize(notification));
            }
        }
    }

    private void handleTyping(String username, String roomId) {
        if (roomId == null) return;
        MessageDto typing = new MessageDto();
        typing.setType(MessageType.TYPING);
        typing.setSender(username);
        typing.setRoomId(roomId);

        String json = serialize(typing);
        if (json == null) return;

        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return;

        if (room.getType() == RoomType.GENERAL) {
            userSessions.forEach((user, s) -> {
                if (!user.equals(username)) sendSafe(s, json);
            });
        } else {
            room.getMembers().forEach(member -> {
                if (!member.equals(username)) {
                    WebSocketSession s = userSessions.get(member);
                    if (s != null) sendSafe(s, json);
                }
            });
        }
    }

    /**
     * Broadcast AVATAR_UPDATE to all online users so they update the avatar in real time.
     */
    private void handleAvatarUpdate(String username, MessageDto incoming) {
        MessageDto broadcast = new MessageDto();
        broadcast.setType(MessageType.AVATAR_UPDATE);
        broadcast.setSender(username);
        broadcast.setContent(incoming.getContent()); // avatarUrl stored in content field
        broadcast.setTimestamp(now());

        String json = serialize(broadcast);
        if (json == null) return;

        // Send to all online users (including sender, to confirm)
        userSessions.forEach((user, s) -> sendSafe(s, json));
    }

    /**
     * Handle WebRTC call signaling: relay messages directly to the target user.
     * Target username is taken from extra.target field.
     * For CALL_OFFER: check if target is online, otherwise send CALL_END back.
     * Also logs call history for CALL_OFFER, CALL_END, CALL_REJECT, CALL_BUSY.
     */
    private void handleCallSignaling(String username, MessageDto incoming) {
        Map<String, String> extra = incoming.getExtra();
        if (extra == null) return;
        String target = extra.get("target");
        if (target == null || target.isEmpty()) return;

        // Set sender and timestamp
        incoming.setSender(username);
        incoming.setTimestamp(now());

        WebSocketSession targetSession = userSessions.get(target);

        // Track call start on CALL_OFFER
        if (incoming.getType() == MessageType.CALL_OFFER) {
            String callKey = callKey(username, target);
            activeCallStartTimes.put(callKey, System.currentTimeMillis());
            String callType = extra.getOrDefault("callType", "audio");
            activeCallTypes.put(callKey, callType);
        }

        // If CALL_OFFER and target is offline → send CALL_END back to caller + log
        if (incoming.getType() == MessageType.CALL_OFFER && (targetSession == null || !targetSession.isOpen())) {
            saveCallLog(username, target, extra.getOrDefault("callType", "audio"), "unavailable", 0);
            cleanupCallTracking(username, target);

            MessageDto unavailable = new MessageDto();
            unavailable.setType(MessageType.CALL_END);
            unavailable.setSender(target);
            unavailable.setTimestamp(now());
            Map<String, String> endExtra = new HashMap<>();
            endExtra.put("reason", "unavailable");
            endExtra.put("target", username);
            unavailable.setExtra(endExtra);
            WebSocketSession callerSession = userSessions.get(username);
            if (callerSession != null) {
                sendSafe(callerSession, serialize(unavailable));
            }
            return;
        }

        // Log on call termination events
        if (incoming.getType() == MessageType.CALL_REJECT) {
            String callKey = findCallKey(username, target);
            String callType = activeCallTypes.getOrDefault(callKey, "audio");
            saveCallLog(resolveCallCaller(callKey, username, target), resolveCallCallee(callKey, username, target), callType, "rejected", 0);
            cleanupCallTracking(username, target);
        } else if (incoming.getType() == MessageType.CALL_BUSY) {
            String callKey = findCallKey(username, target);
            String callType = activeCallTypes.getOrDefault(callKey, "audio");
            saveCallLog(resolveCallCaller(callKey, username, target), resolveCallCallee(callKey, username, target), callType, "busy", 0);
            cleanupCallTracking(username, target);
        } else if (incoming.getType() == MessageType.CALL_END) {
            String callKey = findCallKey(username, target);
            Long startTime = activeCallStartTimes.get(callKey);
            String callType = activeCallTypes.getOrDefault(callKey, "audio");
            int duration = 0;
            String status = "missed";
            if (startTime != null) {
                duration = (int) ((System.currentTimeMillis() - startTime) / 1000);
                // If duration > 3 seconds, it was likely answered
                status = duration > 3 ? "completed" : "missed";
            }
            String reason = extra.getOrDefault("reason", "");
            if ("hangup".equals(reason)) status = "completed";
            saveCallLog(resolveCallCaller(callKey, username, target), resolveCallCallee(callKey, username, target), callType, status, duration);
            cleanupCallTracking(username, target);
        }

        // Relay message to target user
        if (targetSession != null && targetSession.isOpen()) {
            sendSafe(targetSession, serialize(incoming));
        }
    }

    private String callKey(String u1, String u2) {
        return u1 + ":" + u2;
    }

    private String findCallKey(String u1, String u2) {
        // Try both directions
        String key1 = u1 + ":" + u2;
        String key2 = u2 + ":" + u1;
        if (activeCallStartTimes.containsKey(key1)) return key1;
        if (activeCallStartTimes.containsKey(key2)) return key2;
        return key1; // fallback
    }

    private String resolveCallCaller(String callKey, String u1, String u2) {
        if (callKey != null && callKey.contains(":")) return callKey.split(":")[0];
        return u1;
    }

    private String resolveCallCallee(String callKey, String u1, String u2) {
        if (callKey != null && callKey.contains(":")) return callKey.split(":")[1];
        return u2;
    }

    private void cleanupCallTracking(String u1, String u2) {
        activeCallStartTimes.remove(u1 + ":" + u2);
        activeCallStartTimes.remove(u2 + ":" + u1);
        activeCallTypes.remove(u1 + ":" + u2);
        activeCallTypes.remove(u2 + ":" + u1);
    }

    private void saveCallLog(String caller, String callee, String callType, String status, int duration) {
        try {
            CallLogEntity log = new CallLogEntity(
                    UUID.randomUUID().toString(),
                    caller, callee, callType, status, duration, now()
            );
            callLogRepository.save(log);
        } catch (Exception e) {
            ChatWebSocketHandler.log.error("Failed to save call log: {}", e.getMessage());
        }
    }

    // ======================== Conference Signaling ========================

    /**
     * Handle CONF_JOIN: user joins a conference, notify all existing participants.
     */
    private void handleConferenceJoin(String username, MessageDto incoming) {
        Map<String, String> extra = incoming.getExtra();
        if (extra == null) return;
        String confId = extra.get("confId");
        if (confId == null || confId.isEmpty()) return;

        boolean joined = conferenceService.joinConference(confId, username);
        if (!joined) {
            // Conference full or not found — notify the user
            MessageDto error = new MessageDto();
            error.setType(MessageType.CONF_LEAVE);
            error.setSender("system");
            error.setTimestamp(now());
            Map<String, String> errExtra = new HashMap<>();
            errExtra.put("confId", confId);
            errExtra.put("reason", "full");
            error.setExtra(errExtra);
            WebSocketSession s = userSessions.get(username);
            if (s != null) sendSafe(s, serialize(error));
            return;
        }

        // Send CONF_PEERS to the new joiner (list of existing peers EXCLUDING themselves)
        java.util.Set<String> participants = conferenceService.getParticipants(confId);
        java.util.List<String> peersExceptNew = participants.stream()
                .filter(p -> !p.equals(username)).toList();

        MessageDto peersMsg = new MessageDto();
        peersMsg.setType(MessageType.CONF_PEERS);
        peersMsg.setSender("system");
        peersMsg.setTimestamp(now());
        Map<String, String> peersExtra = new HashMap<>();
        peersExtra.put("confId", confId);
        peersExtra.put("peers", String.join(",", peersExceptNew));
        peersExtra.put("count", String.valueOf(participants.size()));
        peersMsg.setExtra(peersExtra);
        WebSocketSession joinerSession = userSessions.get(username);
        if (joinerSession != null) sendSafe(joinerSession, serialize(peersMsg));

        // Broadcast CONF_JOIN to all OTHER participants
        MessageDto joinMsg = new MessageDto();
        joinMsg.setType(MessageType.CONF_JOIN);
        joinMsg.setSender(username);
        joinMsg.setTimestamp(now());
        Map<String, String> joinExtra = new HashMap<>();
        joinExtra.put("confId", confId);
        joinExtra.put("count", String.valueOf(participants.size()));
        joinMsg.setExtra(joinExtra);
        String joinJson = serialize(joinMsg);

        for (String peer : peersExceptNew) {
            WebSocketSession s = userSessions.get(peer);
            if (s != null) sendSafe(s, joinJson);
        }
    }

    /**
     * Handle CONF_LEAVE: user leaves a conference, notify all remaining participants.
     */
    private void handleConferenceLeave(String username, MessageDto incoming) {
        Map<String, String> extra = incoming.getExtra();
        String confId = null;
        if (extra != null) confId = extra.get("confId");
        if (confId == null) confId = conferenceService.getUserConference(username);
        if (confId == null) return;

        // Get remaining participants BEFORE removing
        java.util.Set<String> remaining = conferenceService.getParticipants(confId);
        remaining = new java.util.LinkedHashSet<>(remaining);
        remaining.remove(username);

        conferenceService.leaveConference(username);

        // Broadcast CONF_LEAVE to remaining
        MessageDto leaveMsg = new MessageDto();
        leaveMsg.setType(MessageType.CONF_LEAVE);
        leaveMsg.setSender(username);
        leaveMsg.setTimestamp(now());
        Map<String, String> leaveExtra = new HashMap<>();
        leaveExtra.put("confId", confId);
        leaveExtra.put("count", String.valueOf(remaining.size()));
        leaveMsg.setExtra(leaveExtra);
        String leaveJson = serialize(leaveMsg);

        for (String peer : remaining) {
            WebSocketSession s = userSessions.get(peer);
            if (s != null) sendSafe(s, leaveJson);
        }
    }

    /**
     * Relay CONF_OFFER, CONF_ANSWER, CONF_ICE to the target user within a conference.
     * Uses extra.target for the recipient and extra.confId for conference context.
     */
    private void handleConferenceRelay(String username, MessageDto incoming) {
        Map<String, String> extra = incoming.getExtra();
        if (extra == null) return;
        String target = extra.get("target");
        String confId = extra.get("confId");
        if (target == null || confId == null) return;

        // Verify both users are in the conference
        if (!conferenceService.isInConference(confId, username)
                || !conferenceService.isInConference(confId, target)) {
            log.warn("[Conference] Relay rejected: {} → {} in conf {}", username, target, confId);
            return;
        }

        incoming.setSender(username);
        incoming.setTimestamp(now());

        WebSocketSession targetSession = userSessions.get(target);
        if (targetSession != null && targetSession.isOpen()) {
            sendSafe(targetSession, serialize(incoming));
        }
    }

    /**
     * Auto-leave conference when user disconnects.
     */
    private void autoLeaveConference(String username) {
        String confId = conferenceService.getUserConference(username);
        if (confId == null) return;

        // Create a synthetic CONF_LEAVE message
        MessageDto leaveMsg = new MessageDto();
        leaveMsg.setType(MessageType.CONF_LEAVE);
        Map<String, String> extra = new HashMap<>();
        extra.put("confId", confId);
        leaveMsg.setExtra(extra);
        handleConferenceLeave(username, leaveMsg);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String username = (String) session.getAttributes().get("username");
        sessions.remove(session.getId());

        if (username != null) {
            // Auto-leave any conference
            autoLeaveConference(username);

            // Only remove from userSessions if this IS the current session (I7)
            WebSocketSession current = userSessions.get(username);
            if (current != null && current.getId().equals(session.getId())) {
                userSessions.remove(username);
                chatService.removeUser(username);
                chatService.updateLastSeen(username);

                log.info("User '{}' disconnected. Online: {}", username, chatService.getOnlineUsers().size());
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("Transport error for session {}: {}", session.getId(), exception.getMessage());
        session.close(CloseStatus.SERVER_ERROR);
    }

    /**
     * Send a REPLY_NOTIFICATION to the author of the original message.
     */
    private void sendReplyNotification(String sender, MessageDto reply) {
        WebSocketSession targetSession = userSessions.get(reply.getReplyToSender());
        if (targetSession == null || !targetSession.isOpen()) return;

        MessageDto notification = new MessageDto();
        notification.setType(MessageType.REPLY_NOTIFICATION);
        notification.setId(UUID.randomUUID().toString());
        notification.setSender(sender);
        notification.setContent(reply.getContent());
        notification.setRoomId(reply.getRoomId());
        notification.setTimestamp(now());
        notification.setReplyToId(reply.getReplyToId());
        notification.setReplyToSender(reply.getReplyToSender());
        notification.setReplyToContent(reply.getReplyToContent());

        sendSafe(targetSession, serialize(notification));
    }

    /**
     * Parse the mentions JSON array and send MENTION_NOTIFICATION to each user.
     */
    private void sendMentionNotifications(String sender, MessageDto message) {
        try {
            // Mentions are stored as JSON array: ["user1","user2"]
            List<String> mentionedUsers = objectMapper.readValue(
                    message.getMentions(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));

            for (String mentioned : mentionedUsers) {
                if (mentioned.equals(sender)) continue; // don't notify self
                WebSocketSession targetSession = userSessions.get(mentioned);
                if (targetSession == null || !targetSession.isOpen()) continue;

                MessageDto notification = new MessageDto();
                notification.setType(MessageType.MENTION_NOTIFICATION);
                notification.setId(UUID.randomUUID().toString());
                notification.setSender(sender);
                notification.setContent(message.getContent());
                notification.setRoomId(message.getRoomId());
                notification.setTimestamp(now());
                notification.setMentions(message.getMentions());

                sendSafe(targetSession, serialize(notification));
            }
        } catch (Exception e) {
            log.warn("Failed to parse mentions for message {}: {}", message.getId(), e.getMessage());
        }
    }

    private void broadcastToRoom(String roomId, MessageDto message) {
        String json;
        try {
            json = objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            log.error("Failed to serialize message", e);
            return;
        }

        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return;

        if (room.getType() == RoomType.GENERAL) {
            userSessions.values().forEach(s -> sendSafe(s, json));
        } else {
            room.getMembers().forEach(member -> {
                WebSocketSession s = userSessions.get(member);
                if (s != null) sendSafe(s, json);
            });
        }
    }

    /**
     * Thread-safe send (I6): synchronized per session to prevent concurrent writes.
     */
    private void sendSafe(WebSocketSession session, String json) {
        if (json == null || session == null) return;
        try {
            if (session.isOpen()) {
                synchronized (session) {
                    session.sendMessage(new TextMessage(json));
                }
            }
        } catch (Exception e) {
            log.error("Failed to send message to session {}", session.getId(), e);
        }
    }

    private String serialize(MessageDto msg) {
        try {
            return objectMapper.writeValueAsString(msg);
        } catch (Exception e) {
            log.error("Failed to serialize message", e);
            return null;
        }
    }

    private void sendDeliveryStatus(String sender, MessageDto message, String roomId) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return;

        boolean hasOnlineRecipient;
        if (room.getType() == RoomType.GENERAL) {
            hasOnlineRecipient = userSessions.entrySet().stream()
                    .anyMatch(e -> !e.getKey().equals(sender) && e.getValue().isOpen());
        } else {
            hasOnlineRecipient = room.getMembers().stream()
                    .filter(m -> !m.equals(sender))
                    .anyMatch(m -> {
                        WebSocketSession s = userSessions.get(m);
                        return s != null && s.isOpen();
                    });
        }

        if (hasOnlineRecipient) {
            message.setStatus("DELIVERED");
            MessageDto update = new MessageDto();
            update.setType(MessageType.STATUS_UPDATE);
            update.setId(message.getId());
            update.setStatus("DELIVERED");
            update.setRoomId(roomId);

            WebSocketSession senderSession = userSessions.get(sender);
            if (senderSession != null) {
                sendSafe(senderSession, serialize(update));
            }
        }
    }

    private void handleReadReceipt(String reader, String roomId) {
        if (roomId == null) return;

        Map<String, List<String>> senderToMsgIds = chatService.markMessagesAsRead(roomId, reader);

        for (Map.Entry<String, List<String>> entry : senderToMsgIds.entrySet()) {
            WebSocketSession senderSession = userSessions.get(entry.getKey());
            if (senderSession != null && senderSession.isOpen()) {
                for (String msgId : entry.getValue()) {
                    MessageDto update = new MessageDto();
                    update.setType(MessageType.STATUS_UPDATE);
                    update.setId(msgId);
                    update.setStatus("READ");
                    update.setRoomId(roomId);
                    sendSafe(senderSession, serialize(update));
                }
            }
        }
    }

    private String extractToken(WebSocketSession session) {
        String query = session.getUri() != null ? session.getUri().getQuery() : null;
        if (query != null) {
            for (String param : query.split("&")) {
                if (param.startsWith("token=")) {
                    return param.substring(6);
                }
            }
        }
        return null;
    }

    private String now() {
        return LocalDateTime.now().format(FORMATTER);
    }
}
