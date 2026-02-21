package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.repository.MessageRepository;
import com.example.webrtcchat.repository.UserRepository;
import com.example.webrtcchat.types.MessageType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests that ALL E2E encryption fields, reply fields, and file fields
 * survive the full round-trip: MessageDto → MessageEntity → Database → MessageEntity → MessageDto.
 *
 * This is critical for end-to-end encryption: if any field is lost,
 * the receiving client cannot decrypt the message.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:e2efielddb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false",
        "jwt.secret=e2e-field-test-jwt-secret-key-min-32-chars-long!!",
        "jwt.expiration=3600000",
        "cors.allowed-origins=http://localhost:*",
        "upload.dir=${java.io.tmpdir}/barsik-e2e-test-uploads"
})
class E2EFieldPropagationTest {

    @Autowired
    private ChatService chatService;

    @Autowired
    private MessageRepository messageRepository;

    @Nested
    @DisplayName("E2E Encryption Fields Round-Trip")
    class EncryptionFieldsRoundTrip {

        @Test
        @DisplayName("All E2E fields survive send → getHistory round-trip")
        void allE2eFields_surviveRoundTrip() {
            String roomId = "e2e-room-" + UUID.randomUUID();
            MessageDto original = buildFullE2eMessage(roomId);

            // Save via ChatService
            chatService.send(roomId, original);

            // Retrieve via ChatService
            List<MessageDto> history = chatService.getHistory(roomId, 0, 10);
            assertEquals(1, history.size());

            MessageDto retrieved = history.get(0);

            // Verify ALL E2E encryption fields
            assertTrue(retrieved.isEncrypted(), "encrypted flag must survive");
            assertEquals("base64-encrypted-content-data", retrieved.getEncryptedContent(),
                    "encryptedContent must survive");
            assertEquals("base64-iv-12bytes", retrieved.getIv(),
                    "iv must survive");
            assertEquals("base64-ratchet-public-key", retrieved.getRatchetKey(),
                    "ratchetKey must survive");
            assertEquals(Integer.valueOf(42), retrieved.getMessageNumber(),
                    "messageNumber must survive");
            assertEquals(Integer.valueOf(7), retrieved.getPreviousChainLength(),
                    "previousChainLength must survive");
            assertEquals("base64-ephemeral-key-33bytes", retrieved.getEphemeralKey(),
                    "ephemeralKey must survive (initial message)");
            assertEquals("base64-sender-identity-key", retrieved.getSenderIdentityKey(),
                    "senderIdentityKey must survive");
            assertEquals(Integer.valueOf(3), retrieved.getOneTimeKeyId(),
                    "oneTimeKeyId must survive");
        }

        @Test
        @DisplayName("Non-encrypted message has encrypted=false and null crypto fields")
        void nonEncryptedMessage_fieldsAreNull() {
            String roomId = "plain-room-" + UUID.randomUUID();
            MessageDto plain = new MessageDto();
            plain.setId(UUID.randomUUID().toString());
            plain.setSender("alice");
            plain.setContent("Hello plaintext!");
            plain.setTimestamp("2026-01-01 12:00:00");
            plain.setType(MessageType.CHAT);
            plain.setStatus("SENT");

            chatService.send(roomId, plain);
            List<MessageDto> history = chatService.getHistory(roomId, 0, 10);
            assertEquals(1, history.size());

            MessageDto retrieved = history.get(0);
            assertFalse(retrieved.isEncrypted());
            assertNull(retrieved.getEncryptedContent());
            assertNull(retrieved.getIv());
            assertNull(retrieved.getRatchetKey());
            assertNull(retrieved.getMessageNumber());
            assertNull(retrieved.getPreviousChainLength());
            assertNull(retrieved.getEphemeralKey());
            assertNull(retrieved.getSenderIdentityKey());
            assertNull(retrieved.getOneTimeKeyId());
        }

        @Test
        @DisplayName("E2E fields with null ephemeralKey (non-initial message)")
        void nonInitialMessage_nullEphemeral() {
            String roomId = "ratchet-room-" + UUID.randomUUID();
            MessageDto msg = new MessageDto();
            msg.setId(UUID.randomUUID().toString());
            msg.setSender("alice");
            msg.setContent("[encrypted]");
            msg.setTimestamp("2026-01-01 12:00:00");
            msg.setType(MessageType.CHAT);
            msg.setStatus("SENT");
            msg.setEncrypted(true);
            msg.setEncryptedContent("ratchet-ciphertext");
            msg.setIv("ratchet-iv");
            msg.setRatchetKey("ratchet-key-data");
            msg.setMessageNumber(5);
            msg.setPreviousChainLength(3);
            // No ephemeralKey (non-initial ratchet message)
            // No senderIdentityKey
            // No oneTimeKeyId

            chatService.send(roomId, msg);
            List<MessageDto> history = chatService.getHistory(roomId, 0, 10);
            MessageDto retrieved = history.get(0);

            assertTrue(retrieved.isEncrypted());
            assertEquals("ratchet-ciphertext", retrieved.getEncryptedContent());
            assertNull(retrieved.getEphemeralKey(), "Non-initial message should have null ephemeralKey");
            assertNull(retrieved.getOneTimeKeyId(), "Non-initial message should have null oneTimeKeyId");
            assertEquals(5, retrieved.getMessageNumber());
            assertEquals(3, retrieved.getPreviousChainLength());
        }
    }

    @Nested
    @DisplayName("Reply Fields Round-Trip")
    class ReplyFieldsRoundTrip {

        @Test
        @DisplayName("Reply fields survive round-trip")
        void replyFields_surviveRoundTrip() {
            String roomId = "reply-room-" + UUID.randomUUID();
            MessageDto msg = new MessageDto();
            msg.setId(UUID.randomUUID().toString());
            msg.setSender("bob");
            msg.setContent("This is a reply");
            msg.setTimestamp("2026-01-01 12:01:00");
            msg.setType(MessageType.CHAT);
            msg.setStatus("SENT");
            msg.setReplyToId("original-msg-id");
            msg.setReplyToSender("alice");
            msg.setReplyToContent("Original message content");

            chatService.send(roomId, msg);
            List<MessageDto> history = chatService.getHistory(roomId, 0, 10);
            MessageDto retrieved = history.get(0);

            assertEquals("original-msg-id", retrieved.getReplyToId());
            assertEquals("alice", retrieved.getReplyToSender());
            assertEquals("Original message content", retrieved.getReplyToContent());
        }
    }

    @Nested
    @DisplayName("File Fields Round-Trip")
    class FileFieldsRoundTrip {

        @Test
        @DisplayName("File attachment fields survive round-trip")
        void fileFields_surviveRoundTrip() {
            String roomId = "file-room-" + UUID.randomUUID();
            MessageDto msg = new MessageDto();
            msg.setId(UUID.randomUUID().toString());
            msg.setSender("alice");
            msg.setContent("Check this file");
            msg.setTimestamp("2026-01-01 12:02:00");
            msg.setType(MessageType.CHAT);
            msg.setStatus("SENT");
            msg.setFileUrl("/uploads/abc123.pdf");
            msg.setFileName("report.pdf");
            msg.setFileSize(1_048_576L); // 1MB
            msg.setFileType("application/pdf");

            chatService.send(roomId, msg);
            List<MessageDto> history = chatService.getHistory(roomId, 0, 10);
            MessageDto retrieved = history.get(0);

            assertEquals("/uploads/abc123.pdf", retrieved.getFileUrl());
            assertEquals("report.pdf", retrieved.getFileName());
            assertEquals(1_048_576L, retrieved.getFileSize());
            assertEquals("application/pdf", retrieved.getFileType());
        }
    }

    @Nested
    @DisplayName("Mentions Round-Trip")
    class MentionsRoundTrip {

        @Test
        @DisplayName("Mentions JSON survives round-trip")
        void mentions_surviveRoundTrip() {
            String roomId = "mention-room-" + UUID.randomUUID();
            MessageDto msg = new MessageDto();
            msg.setId(UUID.randomUUID().toString());
            msg.setSender("alice");
            msg.setContent("Hey @bob @charlie check this");
            msg.setTimestamp("2026-01-01 12:03:00");
            msg.setType(MessageType.CHAT);
            msg.setStatus("SENT");
            msg.setMentions("[\"bob\",\"charlie\"]");

            chatService.send(roomId, msg);
            List<MessageDto> history = chatService.getHistory(roomId, 0, 10);
            MessageDto retrieved = history.get(0);

            assertEquals("[\"bob\",\"charlie\"]", retrieved.getMentions());
        }
    }

    @Nested
    @DisplayName("Combined Fields Round-Trip")
    class CombinedFieldsRoundTrip {

        @Test
        @DisplayName("Encrypted reply with file and mentions — all fields survive")
        void allFieldsCombined_survive() {
            String roomId = "combined-room-" + UUID.randomUUID();
            MessageDto msg = buildFullE2eMessage(roomId);
            // Add reply fields
            msg.setReplyToId("parent-msg-123");
            msg.setReplyToSender("charlie");
            msg.setReplyToContent("Original text");
            // Add file fields
            msg.setFileUrl("/uploads/encrypted-file.bin");
            msg.setFileName("secret.docx");
            msg.setFileSize(2_097_152L);
            msg.setFileType("application/vnd.openxmlformats");
            // Add mentions
            msg.setMentions("[\"dave\",\"eve\"]");

            chatService.send(roomId, msg);
            List<MessageDto> history = chatService.getHistory(roomId, 0, 10);
            assertEquals(1, history.size());
            MessageDto r = history.get(0);

            // E2E fields
            assertTrue(r.isEncrypted());
            assertEquals("base64-encrypted-content-data", r.getEncryptedContent());
            assertEquals("base64-iv-12bytes", r.getIv());
            assertEquals("base64-ratchet-public-key", r.getRatchetKey());
            assertEquals(42, r.getMessageNumber());
            assertEquals(7, r.getPreviousChainLength());
            assertEquals("base64-ephemeral-key-33bytes", r.getEphemeralKey());
            assertEquals("base64-sender-identity-key", r.getSenderIdentityKey());
            assertEquals(3, r.getOneTimeKeyId());
            // Reply fields
            assertEquals("parent-msg-123", r.getReplyToId());
            assertEquals("charlie", r.getReplyToSender());
            assertEquals("Original text", r.getReplyToContent());
            // File fields
            assertEquals("/uploads/encrypted-file.bin", r.getFileUrl());
            assertEquals("secret.docx", r.getFileName());
            assertEquals(2_097_152L, r.getFileSize());
            assertEquals("application/vnd.openxmlformats", r.getFileType());
            // Mentions
            assertEquals("[\"dave\",\"eve\"]", r.getMentions());
        }
    }

    @Nested
    @DisplayName("Edit Preserves Encrypted Flag")
    class EditPreservesFields {

        @Test
        @DisplayName("Editing a message preserves edited flag in DB")
        void editMessage_preservesEditedFlag() {
            String roomId = "edit-room-" + UUID.randomUUID();
            String msgId = UUID.randomUUID().toString();

            MessageDto msg = new MessageDto();
            msg.setId(msgId);
            msg.setSender("alice");
            msg.setContent("Original");
            msg.setTimestamp("2026-01-01 12:00:00");
            msg.setType(MessageType.CHAT);
            msg.setStatus("SENT");
            msg.setEncrypted(true);
            msg.setEncryptedContent("cipher1");
            msg.setIv("iv1");

            chatService.send(roomId, msg);

            // Edit the message
            boolean edited = chatService.editMessage(roomId, msgId, "Edited content");
            assertTrue(edited);

            // Fetch and verify
            MessageDto found = chatService.findMessage(roomId, msgId);
            assertNotNull(found);
            assertEquals("Edited content", found.getContent());
            assertTrue(found.isEdited());
            // E2E fields are still there (encryption metadata is retained)
            assertTrue(found.isEncrypted());
            assertEquals("cipher1", found.getEncryptedContent());
            assertEquals("iv1", found.getIv());
        }
    }

    // === Helper ===

    private MessageDto buildFullE2eMessage(String roomId) {
        MessageDto msg = new MessageDto();
        msg.setId(UUID.randomUUID().toString());
        msg.setSender("alice");
        msg.setContent("[encrypted]");
        msg.setTimestamp("2026-01-01 12:00:00");
        msg.setType(MessageType.CHAT);
        msg.setRoomId(roomId);
        msg.setStatus("SENT");
        // E2E fields (all 9)
        msg.setEncrypted(true);
        msg.setEncryptedContent("base64-encrypted-content-data");
        msg.setIv("base64-iv-12bytes");
        msg.setRatchetKey("base64-ratchet-public-key");
        msg.setMessageNumber(42);
        msg.setPreviousChainLength(7);
        msg.setEphemeralKey("base64-ephemeral-key-33bytes");
        msg.setSenderIdentityKey("base64-sender-identity-key");
        msg.setOneTimeKeyId(3);
        return msg;
    }
}
