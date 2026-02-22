package com.example.webrtcchat.service;

import com.example.webrtcchat.entity.UserEntity;
import com.example.webrtcchat.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LastSeenTest {

    @Mock
    private UserRepository userRepository;

    // We need MessageRepository too since ChatService requires it
    @Mock
    private com.example.webrtcchat.repository.MessageRepository messageRepository;

    @InjectMocks
    private ChatService chatService;

    @Test
    @DisplayName("updateLastSeen sets timestamp on existing user")
    void updateLastSeen_setsTimestamp() {
        UserEntity user = new UserEntity("alice", "pass", "2026-01-01");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));

        chatService.updateLastSeen("alice");

        ArgumentCaptor<UserEntity> captor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(captor.capture());

        String lastSeen = captor.getValue().getLastSeen();
        assertNotNull(lastSeen);
        // Should be in format yyyy-MM-dd HH:mm:ss
        assertTrue(lastSeen.matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}"),
                "lastSeen should be formatted as yyyy-MM-dd HH:mm:ss, got: " + lastSeen);
    }

    @Test
    @DisplayName("updateLastSeen does nothing for unknown user")
    void updateLastSeen_unknownUser() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        chatService.updateLastSeen("ghost");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("getLastSeen returns value for existing user with lastSeen")
    void getLastSeen_returnsValue() {
        UserEntity user = new UserEntity("bob", "pass", "2026-01-01");
        user.setLastSeen("2026-02-22 14:30:00");
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(user));

        String result = chatService.getLastSeen("bob");
        assertEquals("2026-02-22 14:30:00", result);
    }

    @Test
    @DisplayName("getLastSeen returns null for user without lastSeen")
    void getLastSeen_returnsNullNoLastSeen() {
        UserEntity user = new UserEntity("carol", "pass", "2026-01-01");
        when(userRepository.findByUsername("carol")).thenReturn(Optional.of(user));

        String result = chatService.getLastSeen("carol");
        assertNull(result);
    }

    @Test
    @DisplayName("getLastSeen returns null for unknown user")
    void getLastSeen_returnsNullUnknown() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        String result = chatService.getLastSeen("ghost");
        assertNull(result);
    }

    @Test
    @DisplayName("updateLastSeen updates timestamp format correctly")
    void updateLastSeen_correctFormat() {
        UserEntity user = new UserEntity("dave", "pass", "2026-01-01");
        user.setLastSeen("2026-01-01 00:00:00");
        when(userRepository.findByUsername("dave")).thenReturn(Optional.of(user));

        chatService.updateLastSeen("dave");

        ArgumentCaptor<UserEntity> captor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(captor.capture());

        String newLastSeen = captor.getValue().getLastSeen();
        assertNotNull(newLastSeen);
        // Should be different from old value (updated to current time)
        assertNotEquals("2026-01-01 00:00:00", newLastSeen);
    }

    @Test
    @DisplayName("UserEntity lastSeen field defaults to null")
    void userEntity_lastSeenDefault() {
        UserEntity user = new UserEntity();
        assertNull(user.getLastSeen());
    }

    @Test
    @DisplayName("UserEntity lastSeen getter/setter works")
    void userEntity_lastSeenGetterSetter() {
        UserEntity user = new UserEntity();
        user.setLastSeen("2026-02-22 12:00:00");
        assertEquals("2026-02-22 12:00:00", user.getLastSeen());
    }
}
