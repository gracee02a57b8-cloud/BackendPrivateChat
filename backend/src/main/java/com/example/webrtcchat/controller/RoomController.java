package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.dto.RoomDto;
import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.entity.RoomEntity;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.repository.RoomRepository;
import com.example.webrtcchat.service.ChatService;
import com.example.webrtcchat.service.LinkPreviewService;
import com.example.webrtcchat.service.ReadReceiptService;
import com.example.webrtcchat.service.RoomMuteService;
import com.example.webrtcchat.service.RoomService;
import com.example.webrtcchat.types.MessageType;
import com.example.webrtcchat.types.RoomType;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final RoomService roomService;
    private final ChatService chatService;
    private final MessageRepository messageRepository;
    private final ChatWebSocketHandler wsHandler;
    private final RoomMuteService roomMuteService;
    private final ReadReceiptService readReceiptService;
    private final LinkPreviewService linkPreviewService;
    private final RoomRepository roomRepository;

    public RoomController(RoomService roomService, ChatService chatService,
                          MessageRepository messageRepository, ChatWebSocketHandler wsHandler,
                          RoomMuteService roomMuteService, ReadReceiptService readReceiptService,
                          LinkPreviewService linkPreviewService, RoomRepository roomRepository) {
        this.roomService = roomService;
        this.chatService = chatService;
        this.messageRepository = messageRepository;
        this.wsHandler = wsHandler;
        this.roomMuteService = roomMuteService;
        this.readReceiptService = readReceiptService;
        this.linkPreviewService = linkPreviewService;
        this.roomRepository = roomRepository;
    }

    @GetMapping
    public ResponseEntity<List<RoomDto>> getUserRooms(Principal principal) {
        String username = principal.getName();
        List<RoomDto> rooms = roomService.getUserRooms(username);
        // Enrich with mute status
        java.util.Set<String> mutedIds = roomMuteService.getMutedRoomIds(username);
        rooms.forEach(r -> r.setMuted(mutedIds.contains(r.getId())));
        return ResponseEntity.ok(rooms);
    }

    @PostMapping("/private/{username}")
    public ResponseEntity<RoomDto> getPrivateRoom(@PathVariable String username, Principal principal) {
        if (username.equals(principal.getName())) {
            return ResponseEntity.badRequest().build();
        }
        RoomDto room = roomService.getOrCreatePrivateRoom(principal.getName(), username);
        return ResponseEntity.ok(room);
    }

    @PostMapping("/saved")
    public ResponseEntity<RoomDto> getSavedRoom(Principal principal) {
        RoomDto room = roomService.getOrCreateSavedRoom(principal.getName());
        return ResponseEntity.ok(room);
    }

    @PostMapping("/create")
    public ResponseEntity<RoomDto> createRoom(@RequestBody Map<String, Object> body, Principal principal) {
        String name = (String) body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (name.trim().length() > 50) {
            return ResponseEntity.badRequest().build();
        }
        String description = (String) body.get("description");
        String avatarUrl = (String) body.get("avatarUrl");
        RoomDto room = roomService.createRoom(name.trim(), principal.getName(), description, avatarUrl);

        // Add selected members to the room
        Object memberUsernamesObj = body.get("memberUsernames");
        if (memberUsernamesObj instanceof java.util.List<?> memberList) {
            for (Object member : memberList) {
                if (member instanceof String memberUsername && !memberUsername.isBlank()) {
                    roomService.joinRoom(room.getId(), memberUsername);
                }
            }
            // Refresh room to include all members
            room = roomService.getRoomById(room.getId());
        }

        return ResponseEntity.ok(room);
    }

    @PostMapping("/join/{roomId}")
    public ResponseEntity<RoomDto> joinRoom(@PathVariable String roomId, Principal principal) {
        RoomDto room = roomService.joinRoom(roomId, principal.getName());
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(room);
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<RoomDto> getRoom(@PathVariable String roomId, Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        // Check membership (C8): non-general rooms require membership
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(room);
    }

    @GetMapping("/{roomId}/history")
    public ResponseEntity<List<MessageDto>> getRoomHistory(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size,
            Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        // Check membership (C8): non-general rooms require membership
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        int safeSize = Math.min(size, 200);
        return ResponseEntity.ok(chatService.getHistory(roomId, page, safeSize));
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<Map<String, String>> deleteRoom(@PathVariable String roomId, Principal principal) {
        String result = roomService.deleteRoom(roomId, principal.getName());
        if (result == null) {
            return ResponseEntity.status(403).build();
        }
        if ("deleted".equals(result)) {
            chatService.clearHistory(roomId);
        }
        return ResponseEntity.ok(Map.of("result", result));
    }

    @GetMapping("/{roomId}/media-stats")
    public ResponseEntity<Map<String, Long>> getMediaStats(@PathVariable String roomId, Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        Map<String, Long> stats = Map.of(
                "photos", messageRepository.countPhotosByRoomId(roomId),
                "videos", messageRepository.countVideosByRoomId(roomId),
                "files", messageRepository.countFilesByRoomId(roomId),
                "links", messageRepository.countLinksByRoomId(roomId)
        );
        return ResponseEntity.ok(stats);
    }

    // ── Pinned messages ──

    @GetMapping("/{roomId}/pinned")
    public ResponseEntity<List<MessageDto>> getPinnedMessages(@PathVariable String roomId, Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return ResponseEntity.notFound().build();
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(chatService.getPinnedMessages(roomId));
    }

    // ── Send message via REST (offline fallback) ──

    @PostMapping("/{roomId}/messages")
    public ResponseEntity<MessageDto> sendMessage(@PathVariable String roomId,
                                                  @RequestBody MessageDto body,
                                                  Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return ResponseEntity.notFound().build();

        String username = principal.getName();
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(username)) {
            return ResponseEntity.status(403).build();
        }

        body.setSender(username);
        body.setTimestamp(LocalDateTime.now().format(FORMATTER));
        if (body.getType() == null ||
            (body.getType() != MessageType.VOICE && body.getType() != MessageType.VIDEO_CIRCLE)) {
            body.setType(MessageType.CHAT);
        }
        if (body.getId() == null || body.getId().isEmpty()) {
            body.setId(UUID.randomUUID().toString());
        }
        body.setRoomId(roomId);
        body.setStatus("SENT");

        chatService.send(roomId, body);

        // Broadcast to online room members via WS
        wsHandler.broadcastMessageToRoom(roomId, body);

        return ResponseEntity.ok(body);
    }

    // ── Message search ──

    @GetMapping("/{roomId}/search")
    public ResponseEntity<?> searchMessages(@PathVariable String roomId,
                                            @RequestParam String q,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "50") int size,
                                            Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return ResponseEntity.notFound().build();
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        if (q == null || q.isBlank()) return ResponseEntity.ok(List.of());

        List<MessageEntity> results = messageRepository.searchMessages(roomId, q.trim(), PageRequest.of(page, Math.min(size, 100)));
        List<Map<String, Object>> mapped = results.stream().map(m -> {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("id", m.getId());
            map.put("sender", m.getSender());
            map.put("content", m.getContent());
            map.put("timestamp", m.getTimestamp());
            map.put("roomId", m.getRoomId());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(mapped);
    }

    @GetMapping("/search/global")
    public ResponseEntity<?> searchMessagesGlobal(@RequestParam String q,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "50") int size,
                                                  Principal principal) {
        if (q == null || q.isBlank()) return ResponseEntity.ok(List.of());
        List<RoomDto> rooms = roomService.getUserRooms(principal.getName());
        List<String> roomIds = rooms.stream().map(RoomDto::getId).collect(Collectors.toList());
        if (roomIds.isEmpty()) return ResponseEntity.ok(List.of());

        List<MessageEntity> results = messageRepository.searchMessagesGlobal(roomIds, q.trim(), PageRequest.of(page, Math.min(size, 100)));
        List<Map<String, Object>> mapped = results.stream().map(m -> {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("id", m.getId());
            map.put("sender", m.getSender());
            map.put("content", m.getContent());
            map.put("timestamp", m.getTimestamp());
            map.put("roomId", m.getRoomId());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(mapped);
    }

    // ── Mute / Unmute ──

    @PostMapping("/{roomId}/mute")
    public ResponseEntity<?> muteRoom(@PathVariable String roomId,
                                      @RequestBody(required = false) Map<String, String> body,
                                      Principal principal) {
        String until = body != null ? body.get("mutedUntil") : null;
        roomMuteService.muteRoom(principal.getName(), roomId, until);
        return ResponseEntity.ok(Map.of("status", "muted", "roomId", roomId));
    }

    @DeleteMapping("/{roomId}/mute")
    public ResponseEntity<?> unmuteRoom(@PathVariable String roomId, Principal principal) {
        roomMuteService.unmuteRoom(principal.getName(), roomId);
        return ResponseEntity.ok(Map.of("status", "unmuted", "roomId", roomId));
    }

    @GetMapping("/{roomId}/mute")
    public ResponseEntity<?> getMuteStatus(@PathVariable String roomId, Principal principal) {
        boolean muted = roomMuteService.isRoomMuted(principal.getName(), roomId);
        return ResponseEntity.ok(Map.of("muted", muted));
    }

    // ── Disappearing messages ──

    @PostMapping("/{roomId}/disappearing")
    public ResponseEntity<?> setDisappearing(@PathVariable String roomId,
                                             @RequestBody Map<String, Object> body,
                                             Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return ResponseEntity.notFound().build();
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }

        Number seconds = (Number) body.get("seconds");
        int secs = seconds != null ? seconds.intValue() : 0;

        // Update in DB
        roomRepository.findById(roomId).ifPresent(entity -> {
            entity.setDisappearingSeconds(secs);
            roomRepository.save(entity);
        });

        // Broadcast to room members
        MessageDto msg = new MessageDto();
        msg.setType(MessageType.DISAPPEARING_SET);
        msg.setId(UUID.randomUUID().toString());
        msg.setRoomId(roomId);
        msg.setSender(principal.getName());
        msg.setContent(secs > 0 ? "⏰ Исчезающие сообщения: " + formatDuration(secs) : "⏰ Исчезающие сообщения отключены");
        msg.setTimestamp(LocalDateTime.now().format(FORMATTER));
        Map<String, String> extra = new java.util.LinkedHashMap<>();
        extra.put("seconds", String.valueOf(secs));
        msg.setExtra(extra);
        wsHandler.broadcastMessageToRoom(roomId, msg);

        return ResponseEntity.ok(Map.of("seconds", secs));
    }

    // ── Read receipts (group) ──

    @GetMapping("/{roomId}/messages/{messageId}/readers")
    public ResponseEntity<?> getMessageReaders(@PathVariable String roomId, @PathVariable String messageId, Principal principal) {
        RoomDto room = roomService.getRoomById(roomId);
        if (room == null) return ResponseEntity.notFound().build();
        if (room.getType() != RoomType.GENERAL && !room.getMembers().contains(principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        List<Map<String, String>> readers = readReceiptService.getReaders(messageId);
        return ResponseEntity.ok(Map.of("readers", readers, "count", readers.size()));
    }

    @PostMapping("/{roomId}/messages/{messageId}/read")
    public ResponseEntity<?> markMessageRead(@PathVariable String roomId, @PathVariable String messageId, Principal principal) {
        readReceiptService.recordRead(messageId, roomId, principal.getName());
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    // ── Link preview ──

    @GetMapping("/link-preview")
    public ResponseEntity<?> getLinkPreview(@RequestParam String url) {
        Map<String, String> preview = linkPreviewService.fetchPreview(url);
        if (preview == null) return ResponseEntity.ok(Map.of());
        return ResponseEntity.ok(preview);
    }

    private String formatDuration(int seconds) {
        if (seconds < 60) return seconds + " сек";
        if (seconds < 3600) return (seconds / 60) + " мин";
        if (seconds < 86400) return (seconds / 3600) + " ч";
        return (seconds / 86400) + " д";
    }
}
