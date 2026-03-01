package com.example.webrtcchat.controller;

import com.example.webrtcchat.service.ConferenceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

/**
 * REST endpoints for conference (group call) management.
 */
@RestController
@RequestMapping("/api/conference")
public class ConferenceController {

    private final ConferenceService conferenceService;

    public ConferenceController(ConferenceService conferenceService) {
        this.conferenceService = conferenceService;
    }

    /**
     * Create a new conference. Returns { confId, roomId, ... }.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createConference(
            Principal principal,
            @RequestBody(required = false) Map<String, String> body) {
        String roomId = (body != null) ? body.get("roomId") : null;
        String confId = conferenceService.createConference(principal.getName(), roomId);
        Map<String, Object> info = conferenceService.getConferenceInfo(confId);
        return ResponseEntity.ok(info);
    }

    /**
     * Join an existing conference.
     */
    @PostMapping("/{confId}/join")
    public ResponseEntity<Map<String, Object>> joinConference(
            @PathVariable String confId, Principal principal) {
        if (!conferenceService.exists(confId)) {
            return ResponseEntity.notFound().build();
        }
        boolean joined = conferenceService.joinConference(confId, principal.getName());
        if (!joined) {
            return ResponseEntity.status(409)
                    .body(Map.of("error", "Conference is full (max 10 participants)"));
        }
        Map<String, Object> info = conferenceService.getConferenceInfo(confId);
        return ResponseEntity.ok(info);
    }

    /**
     * Leave a conference.
     */
    @PostMapping("/{confId}/leave")
    public ResponseEntity<Void> leaveConference(
            @PathVariable String confId, Principal principal) {
        conferenceService.leaveConference(principal.getName());
        return ResponseEntity.ok().build();
    }

    /**
     * Get conference info (participants, count, etc.). Requires auth.
     */
    @GetMapping("/{confId}")
    public ResponseEntity<Map<String, Object>> getConference(@PathVariable String confId) {
        Map<String, Object> info = conferenceService.getConferenceInfo(confId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(info);
    }

    /**
     * Find active conference by chat room ID.
     */
    @GetMapping("/room/{roomId}")
    public ResponseEntity<Map<String, Object>> getConferenceByRoom(
            @PathVariable String roomId) {
        Map<String, Object> info = conferenceService.getConferenceByRoomId(roomId);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(info);
    }

    /**
     * Public conference info — no auth required.
     * Returns minimal info so invite links can show conference status to unregistered users.
     */
    @GetMapping("/{confId}/info")
    public ResponseEntity<Map<String, Object>> getConferencePublic(@PathVariable String confId) {
        if (!conferenceService.exists(confId)) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> full = conferenceService.getConferenceInfo(confId);
        // Return only safe fields (no participant usernames for public)
        Map<String, Object> pub = new java.util.LinkedHashMap<>();
        pub.put("confId", confId);
        pub.put("active", true);
        pub.put("count", full.get("count"));
        pub.put("maxParticipants", full.get("maxParticipants"));
        pub.put("createdAt", full.get("createdAt"));
        return ResponseEntity.ok(pub);
    }
}
