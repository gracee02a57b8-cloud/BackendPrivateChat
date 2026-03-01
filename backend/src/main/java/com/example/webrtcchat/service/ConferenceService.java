package com.example.webrtcchat.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory conference (group call) management.
 * Conferences are ephemeral — they exist only while participants are connected.
 * Max 10 participants per conference.
 */
@Service
public class ConferenceService {

    private static final Logger log = LoggerFactory.getLogger(ConferenceService.class);
    private static final int MAX_PARTICIPANTS = 10;
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * Conference state: confId → ConferenceRoom.
     */
    private final Map<String, ConferenceRoom> conferences = new ConcurrentHashMap<>();

    /**
     * Reverse lookup: username → confId (a user can only be in one conference at a time).
     */
    private final Map<String, String> userConference = new ConcurrentHashMap<>();

    /**
     * Create a new conference, or join the existing one for the same roomId.
     *
     * @param creator the username of the creator
     * @return conference ID (may be existing)
     */
    public String createConference(String creator, String roomId) {
        // If there is already an active conference for this room — join it instead
        if (roomId != null) {
            for (ConferenceRoom existing : conferences.values()) {
                if (roomId.equals(existing.getRoomId())) {
                    if (existing.getParticipants().contains(creator)) {
                        // Already in this conference
                        return existing.getId();
                    }
                    if (existing.getParticipants().size() >= MAX_PARTICIPANTS) {
                        break; // full — fall through to create new
                    }
                    // Leave any OTHER conference first, then join this one
                    leaveConference(creator);
                    existing.addParticipant(creator);
                    userConference.put(creator, existing.getId());
                    log.info("[Conference] '{}' joined existing conference '{}' for room '{}'. Participants: {}",
                            creator, existing.getId(), roomId, existing.getParticipants().size());
                    return existing.getId();
                }
            }
        }

        // No active conference for this room — create a new one
        leaveConference(creator);

        String confId = UUID.randomUUID().toString();
        ConferenceRoom room = new ConferenceRoom(confId, creator, roomId);
        room.addParticipant(creator);
        conferences.put(confId, room);
        userConference.put(creator, confId);

        log.info("[Conference] '{}' created conference '{}'. Participants: 1", creator, confId);
        return confId;
    }

    /**
     * Find an active conference for a given room.
     *
     * @param roomId the chat room ID
     * @return conference info map, or null if none active
     */
    public Map<String, Object> getConferenceByRoomId(String roomId) {
        if (roomId == null) return null;
        for (ConferenceRoom room : conferences.values()) {
            if (roomId.equals(room.getRoomId())) {
                return getConferenceInfo(room.getId());
            }
        }
        return null;
    }

    /**
     * Join an existing conference.
     *
     * @param confId the conference ID
     * @param username the user joining
     * @return true if joined successfully, false if full or not found
     */
    public boolean joinConference(String confId, String username) {
        ConferenceRoom room = conferences.get(confId);
        if (room == null) return false;
        if (room.getParticipants().size() >= MAX_PARTICIPANTS) return false;
        if (room.getParticipants().contains(username)) return true; // already in

        // Leave any existing conference first
        leaveConference(username);

        room.addParticipant(username);
        userConference.put(username, confId);

        log.info("[Conference] '{}' joined conference '{}'. Participants: {}",
                username, confId, room.getParticipants().size());
        return true;
    }

    /**
     * Leave a conference.
     *
     * @param username the user leaving
     * @return the confId that was left (or null if not in any)
     */
    public String leaveConference(String username) {
        String confId = userConference.remove(username);
        if (confId == null) return null;

        ConferenceRoom room = conferences.get(confId);
        if (room == null) return confId;

        room.removeParticipant(username);
        log.info("[Conference] '{}' left conference '{}'. Remaining: {}",
                username, confId, room.getParticipants().size());

        // Auto-cleanup empty conferences
        if (room.getParticipants().isEmpty()) {
            conferences.remove(confId);
            log.info("[Conference] Conference '{}' removed (empty)", confId);
        }

        return confId;
    }

    /**
     * Get all participants in a conference.
     */
    public Set<String> getParticipants(String confId) {
        ConferenceRoom room = conferences.get(confId);
        if (room == null) return Collections.emptySet();
        return Collections.unmodifiableSet(new LinkedHashSet<>(room.getParticipants()));
    }

    /**
     * Check if a conference exists.
     */
    public boolean exists(String confId) {
        return conferences.containsKey(confId);
    }

    /**
     * Get conference info.
     */
    public Map<String, Object> getConferenceInfo(String confId) {
        ConferenceRoom room = conferences.get(confId);
        if (room == null) return null;
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("confId", confId);
        info.put("roomId", room.getRoomId());
        info.put("creator", room.getCreator());
        info.put("participants", new ArrayList<>(room.getParticipants()));
        info.put("count", room.getParticipants().size());
        info.put("maxParticipants", MAX_PARTICIPANTS);
        info.put("createdAt", room.getCreatedAt());
        return info;
    }

    /**
     * Get the conference ID for a user (or null).
     */
    public String getUserConference(String username) {
        return userConference.get(username);
    }

    /**
     * Check if a user is in a specific conference.
     */
    public boolean isInConference(String confId, String username) {
        ConferenceRoom room = conferences.get(confId);
        if (room == null) return false;
        return room.getParticipants().contains(username);
    }

    // ======================== Inner class ========================

    static class ConferenceRoom {
        private final String id;
        private final String creator;
        private final String roomId;
        private final Set<String> participants = ConcurrentHashMap.newKeySet();
        private final String createdAt;

        ConferenceRoom(String id, String creator, String roomId) {
            this.id = id;
            this.creator = creator;
            this.roomId = roomId;
            this.createdAt = LocalDateTime.now().format(FORMATTER);
        }

        String getId() { return id; }
        String getCreator() { return creator; }
        String getRoomId() { return roomId; }
        Set<String> getParticipants() { return participants; }
        String getCreatedAt() { return createdAt; }

        void addParticipant(String username) { participants.add(username); }
        void removeParticipant(String username) { participants.remove(username); }
    }
}
