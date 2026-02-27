package com.example.webrtcchat.service;

import com.example.webrtcchat.entity.ReadReceiptEntity;
import com.example.webrtcchat.repository.ReadReceiptRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ReadReceiptService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final ReadReceiptRepository readReceiptRepository;

    public ReadReceiptService(ReadReceiptRepository readReceiptRepository) {
        this.readReceiptRepository = readReceiptRepository;
    }

    @Transactional
    public void recordRead(String messageId, String roomId, String username) {
        if (readReceiptRepository.existsByMessageIdAndUsername(messageId, username)) return;

        ReadReceiptEntity entity = new ReadReceiptEntity();
        entity.setMessageId(messageId);
        entity.setRoomId(roomId);
        entity.setUsername(username);
        entity.setReadAt(LocalDateTime.now().format(FORMATTER));
        readReceiptRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public List<Map<String, String>> getReaders(String messageId) {
        return readReceiptRepository.findByMessageId(messageId)
                .stream()
                .map(e -> {
                    Map<String, String> m = new HashMap<>();
                    m.put("username", e.getUsername());
                    m.put("readAt", e.getReadAt());
                    return m;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public int getReadCount(String messageId) {
        return readReceiptRepository.findByMessageId(messageId).size();
    }
}
