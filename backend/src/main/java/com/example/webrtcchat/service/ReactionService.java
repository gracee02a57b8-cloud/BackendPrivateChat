package com.example.webrtcchat.service;

import com.example.webrtcchat.entity.ReactionEntity;
import com.example.webrtcchat.repository.ReactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReactionService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final ReactionRepository reactionRepository;

    public ReactionService(ReactionRepository reactionRepository) {
        this.reactionRepository = reactionRepository;
    }

    @Transactional
    public ReactionEntity addReaction(String messageId, String roomId, String username, String emoji) {
        // Check if already exists
        Optional<ReactionEntity> existing = reactionRepository.findByMessageIdAndUsernameAndEmoji(messageId, username, emoji);
        if (existing.isPresent()) return existing.get();

        ReactionEntity entity = new ReactionEntity();
        entity.setMessageId(messageId);
        entity.setRoomId(roomId);
        entity.setUsername(username);
        entity.setEmoji(emoji);
        entity.setCreatedAt(LocalDateTime.now().format(FORMATTER));
        return reactionRepository.save(entity);
    }

    @Transactional
    public boolean removeReaction(String messageId, String username, String emoji) {
        Optional<ReactionEntity> existing = reactionRepository.findByMessageIdAndUsernameAndEmoji(messageId, username, emoji);
        if (existing.isPresent()) {
            reactionRepository.delete(existing.get());
            return true;
        }
        return false;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getReactionsForMessage(String messageId) {
        List<ReactionEntity> reactions = reactionRepository.findByMessageId(messageId);
        // Group by emoji
        Map<String, List<String>> grouped = reactions.stream()
                .collect(Collectors.groupingBy(ReactionEntity::getEmoji,
                        Collectors.mapping(ReactionEntity::getUsername, Collectors.toList())));

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : grouped.entrySet()) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("emoji", entry.getKey());
            r.put("users", entry.getValue());
            r.put("count", entry.getValue().size());
            result.add(r);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> getReactionsForMessages(List<String> messageIds) {
        Map<String, List<Map<String, Object>>> result = new HashMap<>();
        for (String msgId : messageIds) {
            List<Map<String, Object>> reactions = getReactionsForMessage(msgId);
            if (!reactions.isEmpty()) {
                result.put(msgId, reactions);
            }
        }
        return result;
    }
}
