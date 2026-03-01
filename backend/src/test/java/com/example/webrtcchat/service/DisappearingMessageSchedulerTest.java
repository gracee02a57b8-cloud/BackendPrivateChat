package com.example.webrtcchat.service;

import com.example.webrtcchat.controller.ChatWebSocketHandler;
import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.types.MessageType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DisappearingMessageSchedulerTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private ChatWebSocketHandler wsHandler;

    @InjectMocks
    private DisappearingMessageScheduler scheduler;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private MessageEntity createMsg(String id, String roomId, String sender, String disappearsAt) {
        MessageEntity e = new MessageEntity();
        e.setId(id);
        e.setRoomId(roomId);
        e.setSender(sender);
        e.setType(MessageType.CHAT);
        e.setContent("Hello");
        e.setDisappearsAt(disappearsAt);
        return e;
    }

    // === deleteExpiredMessages ===

    @Test
    @DisplayName("does nothing when no expired messages")
    void deleteExpiredMessages_noExpired() {
        when(messageRepository.findExpiredDisappearingMessages(anyString()))
                .thenReturn(Collections.emptyList());

        scheduler.deleteExpiredMessages();

        verify(messageRepository, never()).deleteAll(any());
        verify(wsHandler, never()).broadcastMessageToRoom(anyString(), any(MessageDto.class));
    }

    @Test
    @DisplayName("deletes expired messages and broadcasts DELETE")
    void deleteExpiredMessages_deletesAndBroadcasts() {
        String past = LocalDateTime.now().minusMinutes(1).format(FORMATTER);
        MessageEntity msg1 = createMsg("m1", "room1", "alice", past);
        MessageEntity msg2 = createMsg("m2", "room1", "bob", past);

        when(messageRepository.findExpiredDisappearingMessages(anyString()))
                .thenReturn(List.of(msg1, msg2));

        scheduler.deleteExpiredMessages();

        // Should broadcast DELETE for each message
        ArgumentCaptor<MessageDto> captor = ArgumentCaptor.forClass(MessageDto.class);
        verify(wsHandler, times(2)).broadcastMessageToRoom(eq("room1"), captor.capture());

        List<MessageDto> deleteMsgs = captor.getAllValues();
        assertEquals("m1", deleteMsgs.get(0).getId());
        assertEquals(MessageType.DELETE, deleteMsgs.get(0).getType());
        assertEquals("m2", deleteMsgs.get(1).getId());
        assertEquals(MessageType.DELETE, deleteMsgs.get(1).getType());

        // Should delete all expired messages
        verify(messageRepository).deleteAll(List.of(msg1, msg2));
    }

    @Test
    @DisplayName("broadcasts to correct rooms when messages are in different rooms")
    void deleteExpiredMessages_multipleRooms() {
        String past = LocalDateTime.now().minusMinutes(1).format(FORMATTER);
        MessageEntity msg1 = createMsg("m1", "room1", "alice", past);
        MessageEntity msg2 = createMsg("m2", "room2", "bob", past);

        when(messageRepository.findExpiredDisappearingMessages(anyString()))
                .thenReturn(List.of(msg1, msg2));

        scheduler.deleteExpiredMessages();

        verify(wsHandler).broadcastMessageToRoom(eq("room1"), argThat(m -> "m1".equals(m.getId())));
        verify(wsHandler).broadcastMessageToRoom(eq("room2"), argThat(m -> "m2".equals(m.getId())));
    }

    @Test
    @DisplayName("DELETE broadcast contains correct fields")
    void deleteExpiredMessages_broadcastFields() {
        String past = LocalDateTime.now().minusMinutes(1).format(FORMATTER);
        MessageEntity msg = createMsg("m1", "room1", "alice", past);

        when(messageRepository.findExpiredDisappearingMessages(anyString()))
                .thenReturn(List.of(msg));

        scheduler.deleteExpiredMessages();

        ArgumentCaptor<MessageDto> captor = ArgumentCaptor.forClass(MessageDto.class);
        verify(wsHandler).broadcastMessageToRoom(eq("room1"), captor.capture());

        MessageDto deleteMsg = captor.getValue();
        assertEquals("m1", deleteMsg.getId());
        assertEquals("room1", deleteMsg.getRoomId());
        assertEquals(MessageType.DELETE, deleteMsg.getType());
        assertEquals("system", deleteMsg.getSender());
        assertNotNull(deleteMsg.getTimestamp());
    }

    @Test
    @DisplayName("queries repository with current timestamp")
    void deleteExpiredMessages_usesCurrentTime() {
        when(messageRepository.findExpiredDisappearingMessages(anyString()))
                .thenReturn(Collections.emptyList());

        scheduler.deleteExpiredMessages();

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(messageRepository).findExpiredDisappearingMessages(captor.capture());

        // Verify the passed time is close to now (within 5 seconds)
        String passedTime = captor.getValue();
        LocalDateTime parsed = LocalDateTime.parse(passedTime, FORMATTER);
        LocalDateTime now = LocalDateTime.now();
        assertTrue(java.time.Duration.between(parsed, now).abs().getSeconds() < 5,
                "Passed time should be close to now");
    }

    @Test
    @DisplayName("handles single expired message")
    void deleteExpiredMessages_singleMessage() {
        String past = LocalDateTime.now().minusSeconds(30).format(FORMATTER);
        MessageEntity msg = createMsg("m1", "room1", "alice", past);

        when(messageRepository.findExpiredDisappearingMessages(anyString()))
                .thenReturn(List.of(msg));

        scheduler.deleteExpiredMessages();

        verify(wsHandler, times(1)).broadcastMessageToRoom(eq("room1"), any(MessageDto.class));
        verify(messageRepository).deleteAll(List.of(msg));
    }
}
