package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.entity.PollEntity;
import com.example.webrtcchat.service.PollService;
import com.example.webrtcchat.types.MessageType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/polls")
public class PollController {

    private final PollService pollService;
    private final ChatWebSocketHandler wsHandler;

    public PollController(PollService pollService, ChatWebSocketHandler wsHandler) {
        this.pollService = pollService;
        this.wsHandler = wsHandler;
    }

    @PostMapping
    public ResponseEntity<?> createPoll(@RequestBody Map<String, Object> body, Principal principal) {
        String roomId = (String) body.get("roomId");
        String question = (String) body.get("question");
        @SuppressWarnings("unchecked")
        List<String> options = (List<String>) body.get("options");
        Boolean multiChoice = (Boolean) body.getOrDefault("multiChoice", false);
        Boolean anonymous = (Boolean) body.getOrDefault("anonymous", false);

        if (roomId == null || question == null || options == null || options.size() < 2) {
            return ResponseEntity.badRequest().body(Map.of("error", "roomId, question, and at least 2 options required"));
        }

        String messageId = UUID.randomUUID().toString();
        PollEntity poll = pollService.createPoll(roomId, messageId, principal.getName(), question, options, multiChoice, anonymous);
        Map<String, Object> pollData = pollService.getPollData(poll.getId());

        // Broadcast poll as a message to the room
        MessageDto msg = new MessageDto();
        msg.setType(MessageType.POLL);
        msg.setId(messageId);
        msg.setRoomId(roomId);
        msg.setSender(principal.getName());
        msg.setContent("📊 " + question);
        msg.setTimestamp(poll.getCreatedAt());
        msg.setStatus("SENT");
        Map<String, String> extra = new java.util.LinkedHashMap<>();
        extra.put("pollId", poll.getId());
        extra.put("question", question);
        extra.put("multiChoice", String.valueOf(multiChoice));
        extra.put("anonymous", String.valueOf(anonymous));
        extra.put("optionCount", String.valueOf(options.size()));
        msg.setExtra(extra);
        msg.setPollData(pollData);

        wsHandler.broadcastMessageToRoom(roomId, msg);

        return ResponseEntity.ok(pollData);
    }

    @PostMapping("/{pollId}/vote")
    public ResponseEntity<?> vote(@PathVariable String pollId, @RequestBody Map<String, Object> body, Principal principal) {
        Number optionIdNum = (Number) body.get("optionId");
        if (optionIdNum == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "optionId required"));
        }
        Long optionId = optionIdNum.longValue();

        boolean ok = pollService.vote(pollId, optionId, principal.getName());
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of("error", "Vote failed (poll closed or already voted)"));
        }

        Map<String, Object> pollData = pollService.getPollData(pollId);
        if (pollData != null) {
            // Broadcast updated poll data
            MessageDto msg = new MessageDto();
            msg.setType(MessageType.POLL_VOTE);
            msg.setId((String) pollData.get("messageId"));
            msg.setRoomId((String) pollData.get("roomId"));
            msg.setSender(principal.getName());
            msg.setTimestamp(java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            Map<String, String> extra = new java.util.LinkedHashMap<>();
            extra.put("pollId", pollId);
            extra.put("optionId", String.valueOf(optionId));
            extra.put("totalVotes", String.valueOf(pollData.get("totalVotes")));
            msg.setExtra(extra);
            wsHandler.broadcastMessageToRoom((String) pollData.get("roomId"), msg);
        }

        return ResponseEntity.ok(pollData);
    }

    @PostMapping("/{pollId}/close")
    public ResponseEntity<?> closePoll(@PathVariable String pollId, Principal principal) {
        boolean ok = pollService.closePoll(pollId, principal.getName());
        if (!ok) return ResponseEntity.badRequest().body(Map.of("error", "Cannot close poll"));

        Map<String, Object> pollData = pollService.getPollData(pollId);
        if (pollData != null) {
            MessageDto msg = new MessageDto();
            msg.setType(MessageType.POLL_CLOSE);
            msg.setId((String) pollData.get("messageId"));
            msg.setRoomId((String) pollData.get("roomId"));
            msg.setSender(principal.getName());
            msg.setTimestamp(java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            Map<String, String> extra = new java.util.LinkedHashMap<>();
            extra.put("pollId", pollId);
            msg.setExtra(extra);
            wsHandler.broadcastMessageToRoom((String) pollData.get("roomId"), msg);
        }

        return ResponseEntity.ok(pollData);
    }

    @GetMapping("/{pollId}")
    public ResponseEntity<?> getPoll(@PathVariable String pollId) {
        Map<String, Object> pollData = pollService.getPollData(pollId);
        if (pollData == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(pollData);
    }

    @GetMapping("/message/{messageId}")
    public ResponseEntity<?> getPollByMessageId(@PathVariable String messageId) {
        Map<String, Object> pollData = pollService.getPollByMessageId(messageId);
        if (pollData == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(pollData);
    }
}
