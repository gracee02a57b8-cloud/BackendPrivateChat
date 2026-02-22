package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.types.MessageType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ChatService chatService;

    private MessageDto sampleMessage;

    @BeforeEach
    void setUp() {
        sampleMessage = new MessageDto();
        sampleMessage.setId("msg-1");
        sampleMessage.setSender("alice");
        sampleMessage.setContent("Hello!");
        sampleMessage.setTimestamp("2026-01-01 12:00:00");
        sampleMessage.setType(MessageType.CHAT);
        sampleMessage.setRoomId("general");
        sampleMessage.setStatus("SENT");
    }

    // === send ===

    @Test
    @DisplayName("send saves message to repository")
    void send_savesMessageEntity() {
        chatService.send("general", sampleMessage);

        ArgumentCaptor<MessageEntity> captor = ArgumentCaptor.forClass(MessageEntity.class);
        verify(messageRepository).save(captor.capture());

        MessageEntity saved = captor.getValue();
        assertEquals("msg-1", saved.getId());
        assertEquals("alice", saved.getSender());
        assertEquals("Hello!", saved.getContent());
        assertEquals("general", saved.getRoomId());
        assertEquals(MessageType.CHAT, saved.getType());
    }

    // === getHistory (paginated) ===

    @Test
    @DisplayName("getHistory returns messages in ascending order")
    void getHistory_returnsAscending() {
        MessageEntity m1 = createEntity("1", "alice", "First", "2026-01-01 12:00:00");
        MessageEntity m2 = createEntity("2", "bob", "Second", "2026-01-01 12:01:00");
        // Repository returns DESC order
        when(messageRepository.findRecentByRoomId(eq("general"), any(Pageable.class)))
                .thenReturn(List.of(m2, m1));

        List<MessageDto> result = chatService.getHistory("general", 0, 100);

        assertEquals(2, result.size());
        assertEquals("First", result.get(0).getContent());  // reversed to ASC
        assertEquals("Second", result.get(1).getContent());
    }

    @Test
    @DisplayName("getHistory with pagination passes correct PageRequest")
    void getHistory_pagination() {
        when(messageRepository.findRecentByRoomId(anyString(), any(Pageable.class)))
                .thenReturn(List.of());

        chatService.getHistory("room1", 2, 50);

        verify(messageRepository).findRecentByRoomId(eq("room1"), eq(PageRequest.of(2, 50)));
    }

    @Test
    @DisplayName("getHistory default returns page 0 size 100")
    void getHistory_default() {
        when(messageRepository.findRecentByRoomId(anyString(), any(Pageable.class)))
                .thenReturn(List.of());

        chatService.getHistory("general");

        verify(messageRepository).findRecentByRoomId(eq("general"), eq(PageRequest.of(0, 100)));
    }

    // === findMessage ===

    @Test
    @DisplayName("findMessage returns message when found in correct room")
    void findMessage_found() {
        MessageEntity entity = createEntity("msg-1", "alice", "Hello", "2026-01-01 12:00:00");
        entity.setRoomId("general");
        when(messageRepository.findById("msg-1")).thenReturn(Optional.of(entity));

        MessageDto result = chatService.findMessage("general", "msg-1");

        assertNotNull(result);
        assertEquals("msg-1", result.getId());
    }

    @Test
    @DisplayName("findMessage returns null for wrong room")
    void findMessage_wrongRoom() {
        MessageEntity entity = createEntity("msg-1", "alice", "Hello", "2026-01-01 12:00:00");
        entity.setRoomId("other-room");
        when(messageRepository.findById("msg-1")).thenReturn(Optional.of(entity));

        assertNull(chatService.findMessage("general", "msg-1"));
    }

    @Test
    @DisplayName("findMessage returns null for null id")
    void findMessage_nullId() {
        assertNull(chatService.findMessage("general", null));
    }

    // === editMessage ===

    @Test
    @DisplayName("editMessage updates content and sets edited flag")
    void editMessage_success() {
        MessageEntity entity = createEntity("msg-1", "alice", "Old", "2026-01-01 12:00:00");
        entity.setRoomId("general");
        when(messageRepository.findById("msg-1")).thenReturn(Optional.of(entity));

        boolean result = chatService.editMessage("general", "msg-1", "New content");

        assertTrue(result);
        assertEquals("New content", entity.getContent());
        assertTrue(entity.isEdited());
        verify(messageRepository).save(entity);
    }

    @Test
    @DisplayName("editMessage returns false for wrong room")
    void editMessage_wrongRoom() {
        MessageEntity entity = createEntity("msg-1", "alice", "Old", "2026-01-01 12:00:00");
        entity.setRoomId("other");
        when(messageRepository.findById("msg-1")).thenReturn(Optional.of(entity));

        assertFalse(chatService.editMessage("general", "msg-1", "New"));
    }

    @Test
    @DisplayName("editMessage returns false for non-existent message")
    void editMessage_notFound() {
        when(messageRepository.findById("nonexistent")).thenReturn(Optional.empty());
        assertFalse(chatService.editMessage("general", "nonexistent", "New"));
    }

    // === deleteMessage ===

    @Test
    @DisplayName("deleteMessage removes message from repository")
    void deleteMessage_success() {
        MessageEntity entity = createEntity("msg-1", "alice", "Hello", "2026-01-01 12:00:00");
        entity.setRoomId("general");
        when(messageRepository.findById("msg-1")).thenReturn(Optional.of(entity));

        assertTrue(chatService.deleteMessage("general", "msg-1"));
        verify(messageRepository).delete(entity);
    }

    @Test
    @DisplayName("deleteMessage returns false for wrong room")
    void deleteMessage_wrongRoom() {
        MessageEntity entity = createEntity("msg-1", "alice", "Hello", "2026-01-01 12:00:00");
        entity.setRoomId("other");
        when(messageRepository.findById("msg-1")).thenReturn(Optional.of(entity));

        assertFalse(chatService.deleteMessage("general", "msg-1"));
    }

    // === Online user management ===

    @Test
    @DisplayName("addUser and getOnlineUsers work correctly")
    void addUser_getsOnline() {
        chatService.addUser("alice");
        chatService.addUser("bob");

        List<String> online = chatService.getOnlineUsers();
        assertEquals(2, online.size());
        assertTrue(online.contains("alice"));
        assertTrue(online.contains("bob"));
    }

    @Test
    @DisplayName("removeUser removes from online set")
    void removeUser_removesFromOnline() {
        chatService.addUser("alice");
        chatService.addUser("bob");
        chatService.removeUser("alice");

        List<String> online = chatService.getOnlineUsers();
        assertEquals(1, online.size());
        assertFalse(online.contains("alice"));
        assertTrue(online.contains("bob"));
    }

    @Test
    @DisplayName("isUserOnline returns correct status")
    void isUserOnline_correctStatus() {
        chatService.addUser("alice");
        assertTrue(chatService.isUserOnline("alice"));
        assertFalse(chatService.isUserOnline("bob"));
    }

    @Test
    @DisplayName("addUser is idempotent (Set semantics)")
    void addUser_idempotent() {
        chatService.addUser("alice");
        chatService.addUser("alice");
        assertEquals(1, chatService.getOnlineUsers().size());
    }

    // === markMessagesAsRead ===

    @Test
    @DisplayName("markMessagesAsRead marks unread messages and returns sender map")
    void markMessagesAsRead_success() {
        MessageEntity msg1 = createEntity("m1", "alice", "Hi", "2026-01-01 12:00:00");
        msg1.setRoomId("general");
        msg1.setStatus("SENT");
        msg1.setType(MessageType.CHAT);

        MessageEntity msg2 = createEntity("m2", "alice", "Hello", "2026-01-01 12:01:00");
        msg2.setRoomId("general");
        msg2.setStatus("DELIVERED");
        msg2.setType(MessageType.CHAT);

        when(messageRepository.findByRoomIdAndTypeInAndSenderNotAndStatusNot(
                eq("general"),
                eq(List.of(MessageType.CHAT, MessageType.VOICE, MessageType.VIDEO_CIRCLE)),
                eq("bob"), eq("READ")))
                .thenReturn(List.of(msg1, msg2));

        Map<String, List<String>> result = chatService.markMessagesAsRead("general", "bob");

        assertEquals(1, result.size());
        assertTrue(result.containsKey("alice"));
        assertEquals(2, result.get("alice").size());
        assertEquals("READ", msg1.getStatus());
        assertEquals("READ", msg2.getStatus());
        verify(messageRepository).saveAll(List.of(msg1, msg2));
    }

    @Test
    @DisplayName("markMessagesAsRead with no unread returns empty map")
    void markMessagesAsRead_noUnread() {
        when(messageRepository.findByRoomIdAndTypeInAndSenderNotAndStatusNot(
                anyString(), anyList(), anyString(), anyString()))
                .thenReturn(List.of());

        Map<String, List<String>> result = chatService.markMessagesAsRead("general", "bob");
        assertTrue(result.isEmpty());
    }

    // === clearHistory ===

    @Test
    @DisplayName("clearHistory deletes all messages in room")
    void clearHistory_deletesAll() {
        chatService.clearHistory("room1");
        verify(messageRepository).deleteByRoomId("room1");
    }

    // === searchUsers ===

    @Test
    @DisplayName("searchUsers delegates to repository")
    void searchUsers_delegates() {
        UserEntity user = new UserEntity("alice", "pass", "2026-01-01");
        when(userRepository.findByUsernameContainingIgnoreCase("ali")).thenReturn(List.of(user));

        List<String> result = chatService.searchUsers("ali");
        assertEquals(1, result.size());
        assertEquals("alice", result.get(0));
    }

    @Test
    @DisplayName("searchUsers with blank query returns all users")
    void searchUsers_blankReturnsAll() {
        UserEntity u1 = new UserEntity("alice", "pass", "2026-01-01");
        UserEntity u2 = new UserEntity("bob", "pass", "2026-01-01");
        when(userRepository.findAll()).thenReturn(List.of(u1, u2));

        List<String> result = chatService.searchUsers("");
        assertEquals(2, result.size());
    }

    // === Helpers ===

    // === Voice message tests ===

    @Test
    @DisplayName("send VOICE message preserves duration and waveform")
    void send_voiceMessage_preservesDurationAndWaveform() {
        MessageDto voice = new MessageDto();
        voice.setId("voice-1");
        voice.setSender("alice");
        voice.setContent(null);
        voice.setTimestamp("2026-01-01 12:00:00");
        voice.setType(MessageType.VOICE);
        voice.setStatus("SENT");
        voice.setFileUrl("/uploads/voice_123.webm");
        voice.setFileName("voice_123.webm");
        voice.setFileSize(24576L);
        voice.setFileType("audio/webm");
        voice.setDuration(15);
        voice.setWaveform("[0.1,0.5,0.8,0.3,0.6]");

        chatService.send("room1", voice);

        ArgumentCaptor<MessageEntity> captor = ArgumentCaptor.forClass(MessageEntity.class);
        verify(messageRepository).save(captor.capture());

        MessageEntity saved = captor.getValue();
        assertEquals("voice-1", saved.getId());
        assertEquals(MessageType.VOICE, saved.getType());
        assertEquals(Integer.valueOf(15), saved.getDuration());
        assertEquals("[0.1,0.5,0.8,0.3,0.6]", saved.getWaveform());
        assertEquals("/uploads/voice_123.webm", saved.getFileUrl());
        assertEquals("audio/webm", saved.getFileType());
    }

    @Test
    @DisplayName("send VOICE message with null duration and waveform")
    void send_voiceMessage_nullDurationAndWaveform() {
        MessageDto voice = new MessageDto();
        voice.setId("voice-2");
        voice.setSender("bob");
        voice.setTimestamp("2026-01-01 12:00:00");
        voice.setType(MessageType.VOICE);
        voice.setStatus("SENT");
        voice.setDuration(null);
        voice.setWaveform(null);

        chatService.send("room1", voice);

        ArgumentCaptor<MessageEntity> captor = ArgumentCaptor.forClass(MessageEntity.class);
        verify(messageRepository).save(captor.capture());

        MessageEntity saved = captor.getValue();
        assertEquals(MessageType.VOICE, saved.getType());
        assertNull(saved.getDuration());
        assertNull(saved.getWaveform());
    }

    // === Video circle message tests ===

    @Test
    @DisplayName("send VIDEO_CIRCLE message preserves duration and thumbnailUrl")
    void send_videoCircleMessage_preservesDurationAndThumbnail() {
        MessageDto vc = new MessageDto();
        vc.setId("vc-1");
        vc.setSender("alice");
        vc.setContent(null);
        vc.setTimestamp("2026-01-01 12:00:00");
        vc.setType(MessageType.VIDEO_CIRCLE);
        vc.setStatus("SENT");
        vc.setFileUrl("/uploads/video_circle_123.webm");
        vc.setFileName("video_circle_123.webm");
        vc.setFileSize(1_048_576L);
        vc.setFileType("video/webm");
        vc.setDuration(25);
        vc.setThumbnailUrl("/uploads/thumb_123.jpg");

        chatService.send("room1", vc);

        ArgumentCaptor<MessageEntity> captor = ArgumentCaptor.forClass(MessageEntity.class);
        verify(messageRepository).save(captor.capture());

        MessageEntity saved = captor.getValue();
        assertEquals("vc-1", saved.getId());
        assertEquals(MessageType.VIDEO_CIRCLE, saved.getType());
        assertEquals(Integer.valueOf(25), saved.getDuration());
        assertEquals("/uploads/thumb_123.jpg", saved.getThumbnailUrl());
        assertEquals("/uploads/video_circle_123.webm", saved.getFileUrl());
        assertEquals("video/webm", saved.getFileType());
    }

    @Test
    @DisplayName("send VIDEO_CIRCLE with null thumbnailUrl")
    void send_videoCircleMessage_nullThumbnail() {
        MessageDto vc = new MessageDto();
        vc.setId("vc-2");
        vc.setSender("bob");
        vc.setTimestamp("2026-01-01 12:00:00");
        vc.setType(MessageType.VIDEO_CIRCLE);
        vc.setStatus("SENT");
        vc.setDuration(10);
        vc.setThumbnailUrl(null);

        chatService.send("room1", vc);

        ArgumentCaptor<MessageEntity> captor = ArgumentCaptor.forClass(MessageEntity.class);
        verify(messageRepository).save(captor.capture());

        MessageEntity saved = captor.getValue();
        assertEquals(MessageType.VIDEO_CIRCLE, saved.getType());
        assertEquals(Integer.valueOf(10), saved.getDuration());
        assertNull(saved.getThumbnailUrl());
    }

    // === markMessagesAsRead includes VOICE and VIDEO_CIRCLE ===

    @Test
    @DisplayName("markMessagesAsRead marks VOICE and VIDEO_CIRCLE messages as read")
    void markMessagesAsRead_voiceAndVideoCircle() {
        MessageEntity voiceMsg = createEntity("m-voice", "alice", null, "2026-01-01 12:00:00");
        voiceMsg.setRoomId("general");
        voiceMsg.setStatus("SENT");
        voiceMsg.setType(MessageType.VOICE);
        voiceMsg.setDuration(10);

        MessageEntity vcMsg = createEntity("m-vc", "alice", null, "2026-01-01 12:01:00");
        vcMsg.setRoomId("general");
        vcMsg.setStatus("DELIVERED");
        vcMsg.setType(MessageType.VIDEO_CIRCLE);
        vcMsg.setDuration(20);

        when(messageRepository.findByRoomIdAndTypeInAndSenderNotAndStatusNot(
                eq("general"),
                eq(List.of(MessageType.CHAT, MessageType.VOICE, MessageType.VIDEO_CIRCLE)),
                eq("bob"), eq("READ")))
                .thenReturn(List.of(voiceMsg, vcMsg));

        Map<String, List<String>> result = chatService.markMessagesAsRead("general", "bob");

        assertEquals(1, result.size());
        assertTrue(result.containsKey("alice"));
        assertEquals(2, result.get("alice").size());
        assertEquals("READ", voiceMsg.getStatus());
        assertEquals("READ", vcMsg.getStatus());
        verify(messageRepository).saveAll(List.of(voiceMsg, vcMsg));
    }

    // === Helpers (original) ===

    private MessageEntity createEntity(String id, String sender, String content, String timestamp) {
        MessageEntity e = new MessageEntity();
        e.setId(id);
        e.setSender(sender);
        e.setContent(content);
        e.setTimestamp(timestamp);
        e.setType(MessageType.CHAT);
        return e;
    }
}
