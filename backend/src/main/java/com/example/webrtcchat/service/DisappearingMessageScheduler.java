package com.example.webrtcchat.service;

import com.example.webrtcchat.controller.ChatWebSocketHandler;
import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.types.MessageType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Periodically checks for messages whose disappearing timer has expired
 * and deletes them, broadcasting DELETE events to room members.
 */
@Component
public class DisappearingMessageScheduler {

    private static final Logger log = LoggerFactory.getLogger(DisappearingMessageScheduler.class);
    static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final MessageRepository messageRepository;
    private final ChatWebSocketHandler wsHandler;

    public DisappearingMessageScheduler(MessageRepository messageRepository,
                                         ChatWebSocketHandler wsHandler) {
        this.messageRepository = messageRepository;
        this.wsHandler = wsHandler;
    }

    @Scheduled(fixedRate = 10_000)
    @Transactional
    public void deleteExpiredMessages() {
        String now = LocalDateTime.now().format(FORMATTER);
        List<MessageEntity> expired = messageRepository.findExpiredDisappearingMessages(now);
        if (expired.isEmpty()) return;

        log.info("Deleting {} expired disappearing messages", expired.size());

        for (MessageEntity msg : expired) {
            MessageDto deleteMsg = new MessageDto();
            deleteMsg.setType(MessageType.DELETE);
            deleteMsg.setId(msg.getId());
            deleteMsg.setRoomId(msg.getRoomId());
            deleteMsg.setSender("system");
            deleteMsg.setTimestamp(now);
            wsHandler.broadcastMessageToRoom(msg.getRoomId(), deleteMsg);
        }

        messageRepository.deleteAll(expired);
    }
}
