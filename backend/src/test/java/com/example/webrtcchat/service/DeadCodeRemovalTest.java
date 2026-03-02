package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.entity.MessageEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies that dead E2E encryption code has been fully removed
 * from the codebase (MessageDto, MessageEntity).
 */
class DeadCodeRemovalTest {

    private static final Set<String> REMOVED_E2E_FIELDS = Set.of(
            "encrypted", "groupEncrypted", "encryptedContent",
            "iv", "ratchetKey", "messageNumber", "previousChainLength",
            "ephemeralKey", "senderIdentityKey", "oneTimeKeyId"
    );

    @Test
    @DisplayName("MessageDto must not contain E2E encryption fields")
    void messageDtoHasNoE2eFields() {
        Set<String> dtoFields = Arrays.stream(MessageDto.class.getDeclaredFields())
                .map(Field::getName)
                .collect(Collectors.toSet());

        for (String removed : REMOVED_E2E_FIELDS) {
            assertFalse(dtoFields.contains(removed),
                    "MessageDto still contains removed E2E field: " + removed);
        }
    }

    @Test
    @DisplayName("MessageEntity must not contain E2E encryption columns")
    void messageEntityHasNoE2eFields() {
        Set<String> entityFields = Arrays.stream(MessageEntity.class.getDeclaredFields())
                .map(Field::getName)
                .collect(Collectors.toSet());

        for (String removed : REMOVED_E2E_FIELDS) {
            assertFalse(entityFields.contains(removed),
                    "MessageEntity still contains removed E2E field: " + removed);
        }
    }

    @Test
    @DisplayName("MessageDto must not have E2E getter/setter methods")
    void messageDtoHasNoE2eMethods() {
        Set<String> methods = Arrays.stream(MessageDto.class.getDeclaredMethods())
                .map(Method::getName)
                .collect(Collectors.toSet());

        Set<String> forbiddenMethods = Set.of(
                "isEncrypted", "setEncrypted",
                "isGroupEncrypted", "setGroupEncrypted",
                "getEncryptedContent", "setEncryptedContent",
                "getIv", "setIv",
                "getRatchetKey", "setRatchetKey",
                "getMessageNumber", "setMessageNumber",
                "getPreviousChainLength", "setPreviousChainLength",
                "getEphemeralKey", "setEphemeralKey",
                "getSenderIdentityKey", "setSenderIdentityKey",
                "getOneTimeKeyId", "setOneTimeKeyId"
        );

        for (String m : forbiddenMethods) {
            assertFalse(methods.contains(m),
                    "MessageDto still contains removed E2E method: " + m);
        }
    }

    @Test
    @DisplayName("MessageDto retains essential non-E2E fields (reply, pin, voice, file)")
    void messageDtoRetainsEssentialFields() {
        Set<String> dtoFields = Arrays.stream(MessageDto.class.getDeclaredFields())
                .map(Field::getName)
                .collect(Collectors.toSet());

        // Core fields
        assertTrue(dtoFields.contains("sender"), "sender field must exist");
        assertTrue(dtoFields.contains("content"), "content field must exist");
        assertTrue(dtoFields.contains("type"), "type field must exist");
        assertTrue(dtoFields.contains("roomId"), "roomId field must exist");

        // Reply fields
        assertTrue(dtoFields.contains("replyToId"), "replyToId field must exist");
        assertTrue(dtoFields.contains("replyToSender"), "replyToSender field must exist");
        assertTrue(dtoFields.contains("replyToContent"), "replyToContent field must exist");

        // Voice fields
        assertTrue(dtoFields.contains("duration"), "duration field must exist");
        assertTrue(dtoFields.contains("waveform"), "waveform field must exist");

        // Pin fields
        assertTrue(dtoFields.contains("pinned"), "pinned field must exist");
        assertTrue(dtoFields.contains("pinnedBy"), "pinnedBy field must exist");

        // File fields
        assertTrue(dtoFields.contains("fileUrl"), "fileUrl field must exist");
        assertTrue(dtoFields.contains("fileName"), "fileName field must exist");
    }

    @Test
    @DisplayName("KeyBundleController class must not exist")
    void keyBundleControllerRemoved() {
        assertThrows(ClassNotFoundException.class,
                () -> Class.forName("com.example.webrtcchat.controller.KeyBundleController"),
                "KeyBundleController should have been deleted");
    }

    @Test
    @DisplayName("KeyBundleService class must not exist")
    void keyBundleServiceRemoved() {
        assertThrows(ClassNotFoundException.class,
                () -> Class.forName("com.example.webrtcchat.service.KeyBundleService"),
                "KeyBundleService should have been deleted");
    }

    @Test
    @DisplayName("KeyBundleEntity class must not exist")
    void keyBundleEntityRemoved() {
        assertThrows(ClassNotFoundException.class,
                () -> Class.forName("com.example.webrtcchat.entity.KeyBundleEntity"),
                "KeyBundleEntity should have been deleted");
    }

    @Test
    @DisplayName("OneTimePreKeyEntity class must not exist")
    void oneTimePreKeyEntityRemoved() {
        assertThrows(ClassNotFoundException.class,
                () -> Class.forName("com.example.webrtcchat.entity.OneTimePreKeyEntity"),
                "OneTimePreKeyEntity should have been deleted");
    }
}
