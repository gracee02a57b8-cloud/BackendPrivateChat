package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.types.MessageType;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ChatService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    // Online users — runtime state, backed by ConcurrentHashMap.newKeySet() (R3)
    private final Set<String> onlineUsers = ConcurrentHashMap.newKeySet();

    public ChatService(MessageRepository messageRepository, UserRepository userRepository) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void send(String roomId, MessageDto message) {
        MessageEntity entity = toEntity(message);
        entity.setRoomId(roomId);
        messageRepository.save(entity);
    }

    /**
     * Get paginated history for a room (I12). Returns messages in ascending order.
     */
    @Transactional(readOnly = true)
    public List<MessageDto> getHistory(String roomId, int page, int size) {
        List<MessageEntity> entities = messageRepository.findRecentByRoomId(
                roomId, PageRequest.of(page, size));
        // Reverse to get ascending order (query returns DESC)
        List<MessageDto> result = new ArrayList<>(entities.stream().map(this::toDto).toList());
        Collections.reverse(result);
        return result;
    }

    @Transactional(readOnly = true)
    public List<MessageDto> getHistory(String roomId) {
        return getHistory(roomId, 0, 100);
    }

    @Transactional(readOnly = true)
    public MessageDto findMessage(String roomId, String msgId) {
        if (msgId == null) return null;
        return messageRepository.findById(msgId)
                .filter(e -> roomId.equals(e.getRoomId()))
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional
    public boolean editMessage(String roomId, String msgId, String newContent) {
        Optional<MessageEntity> opt = messageRepository.findById(msgId);
        if (opt.isEmpty() || !roomId.equals(opt.get().getRoomId())) return false;
        MessageEntity entity = opt.get();
        entity.setContent(newContent);
        entity.setEdited(true);
        messageRepository.save(entity);
        return true;
    }

    @Transactional
    public boolean deleteMessage(String roomId, String msgId) {
        Optional<MessageEntity> opt = messageRepository.findById(msgId);
        if (opt.isEmpty() || !roomId.equals(opt.get().getRoomId())) return false;
        messageRepository.delete(opt.get());
        return true;
    }

    public List<MessageDto> getHistory() {
        return getHistory("general");
    }

    @Transactional
    public void clearHistory(String roomId) {
        messageRepository.deleteByRoomId(roomId);
    }

    /**
     * Mark all unread messages from other senders as READ.
     * Returns map of sender -> list of message IDs that were marked.
     */
    @Transactional
    public Map<String, List<String>> markMessagesAsRead(String roomId, String reader) {
        List<MessageEntity> unread = messageRepository
                .findByRoomIdAndTypeAndSenderNotAndStatusNot(roomId, MessageType.CHAT, reader, "READ");

        Map<String, List<String>> senderToMsgIds = new HashMap<>();
        for (MessageEntity msg : unread) {
            msg.setStatus("READ");
            senderToMsgIds.computeIfAbsent(msg.getSender(), k -> new ArrayList<>()).add(msg.getId());
        }
        if (!unread.isEmpty()) {
            messageRepository.saveAll(unread);
        }
        return senderToMsgIds;
    }

    // === Online user management (in-memory runtime state) ===

    public void addUser(String user) {
        onlineUsers.add(user);
    }

    public void removeUser(String user) {
        onlineUsers.remove(user);
    }

    @Transactional
    public void updateLastSeen(String username) {
        userRepository.findByUsername(username).ifPresent(user -> {
            user.setLastSeen(java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            userRepository.save(user);
        });
    }

    @Transactional(readOnly = true)
    public String getLastSeen(String username) {
        return userRepository.findByUsername(username)
                .map(UserEntity::getLastSeen)
                .orElse(null);
    }

    public List<String> getOnlineUsers() {
        return List.copyOf(onlineUsers);
    }

    public boolean isUserOnline(String user) {
        return onlineUsers.contains(user);
    }

    @Transactional(readOnly = true)
    public List<String> getAllUsers() {
        return userRepository.findAll().stream()
                .map(UserEntity::getUsername).toList();
    }

    @Transactional(readOnly = true)
    public List<String> searchUsers(String query) {
        if (query == null || query.isBlank()) return getAllUsers();
        return userRepository.findByUsernameContainingIgnoreCase(query)
                .stream().map(UserEntity::getUsername).toList();
    }

    // === Entity <-> DTO conversion ===

    private MessageEntity toEntity(MessageDto dto) {
        MessageEntity e = new MessageEntity();
        e.setId(dto.getId());
        e.setSender(dto.getSender());
        e.setContent(dto.getContent());
        e.setTimestamp(dto.getTimestamp());
        e.setType(dto.getType());
        e.setRoomId(dto.getRoomId());
        e.setFileUrl(dto.getFileUrl());
        e.setFileName(dto.getFileName());
        e.setFileSize(dto.getFileSize());
        e.setFileType(dto.getFileType());
        e.setStatus(dto.getStatus());
        e.setEdited(dto.isEdited());
        e.setScheduledAt(dto.getScheduledAt());
        // E2E encryption fields
        e.setEncrypted(dto.isEncrypted());
        e.setEncryptedContent(dto.getEncryptedContent());
        e.setIv(dto.getIv());
        e.setRatchetKey(dto.getRatchetKey());
        e.setMessageNumber(dto.getMessageNumber());
        e.setPreviousChainLength(dto.getPreviousChainLength());
        e.setEphemeralKey(dto.getEphemeralKey());
        e.setSenderIdentityKey(dto.getSenderIdentityKey());
        e.setOneTimeKeyId(dto.getOneTimeKeyId());
        // Reply fields
        e.setReplyToId(dto.getReplyToId());
        e.setReplyToSender(dto.getReplyToSender());
        e.setReplyToContent(dto.getReplyToContent());
        e.setMentions(dto.getMentions());
        // Voice fields
        e.setDuration(dto.getDuration());
        e.setWaveform(dto.getWaveform());
        return e;
    }

    private MessageDto toDto(MessageEntity e) {
        MessageDto dto = new MessageDto();
        dto.setId(e.getId());
        dto.setSender(e.getSender());
        dto.setContent(e.getContent());
        dto.setTimestamp(e.getTimestamp());
        dto.setType(e.getType());
        dto.setRoomId(e.getRoomId());
        dto.setFileUrl(e.getFileUrl());
        dto.setFileName(e.getFileName());
        dto.setFileSize(e.getFileSize());
        dto.setFileType(e.getFileType());
        dto.setStatus(e.getStatus());
        dto.setEdited(e.isEdited());
        dto.setScheduledAt(e.getScheduledAt());
        // E2E encryption fields
        dto.setEncrypted(e.isEncrypted());
        dto.setEncryptedContent(e.getEncryptedContent());
        dto.setIv(e.getIv());
        dto.setRatchetKey(e.getRatchetKey());
        dto.setMessageNumber(e.getMessageNumber());
        dto.setPreviousChainLength(e.getPreviousChainLength());
        dto.setEphemeralKey(e.getEphemeralKey());
        dto.setSenderIdentityKey(e.getSenderIdentityKey());
        dto.setOneTimeKeyId(e.getOneTimeKeyId());
        // Reply fields
        dto.setReplyToId(e.getReplyToId());
        dto.setReplyToSender(e.getReplyToSender());
        dto.setReplyToContent(e.getReplyToContent());
        dto.setMentions(e.getMentions());
        // Voice fields
        dto.setDuration(e.getDuration());
        dto.setWaveform(e.getWaveform());
        return dto;
    }
}