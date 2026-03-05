package com.example.webrtcchat.service;

import com.example.webrtcchat.controller.ChatWebSocketHandler;
import com.example.webrtcchat.controller.FileController;
import com.example.webrtcchat.dto.MessageDto;
import com.example.webrtcchat.entity.MessageEntity;
import com.example.webrtcchat.types.MessageType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive verification that NO encryption is applied to any data channel:
 * - Text messages (CHAT, PRIVATE)
 * - Voice messages (VOICE)
 * - Video circle messages (VIDEO_CIRCLE)
 * - File uploads/downloads
 * - WebRTC call signaling (CALL_OFFER, CALL_ANSWER, ICE_CANDIDATE)
 * - Conference signaling (CONF_*)
 *
 * All data is stored and transmitted in plaintext (transport-level TLS/HTTPS only).
 */
class NoEncryptionVerificationTest {

    // ======================================================================
    // E2E encryption fields that must NOT exist in DTO or Entity
    // ======================================================================
    private static final Set<String> E2E_ENCRYPTION_FIELDS = Set.of(
            "encrypted", "groupEncrypted", "encryptedContent",
            "iv", "ratchetKey", "messageNumber", "previousChainLength",
            "ephemeralKey", "senderIdentityKey", "oneTimeKeyId",
            "ciphertext", "nonce", "encryptionKey", "decryptionKey",
            "symmetricKey", "publicKey", "privateKey", "sharedSecret",
            "keyPair", "sessionKey", "encryptedPayload"
    );

    // E2E encryption class names that must NOT exist
    private static final Set<String> REMOVED_ENCRYPTION_CLASSES = Set.of(
            "com.example.webrtcchat.service.EncryptionService",
            "com.example.webrtcchat.service.E2eService",
            "com.example.webrtcchat.service.CryptoService",
            "com.example.webrtcchat.service.KeyBundleService",
            "com.example.webrtcchat.entity.KeyBundleEntity",
            "com.example.webrtcchat.entity.OneTimePreKeyEntity",
            "com.example.webrtcchat.controller.KeyBundleController",
            "com.example.webrtcchat.controller.EncryptionController"
    );

    // ======================================================================
    // 1. Text Messages — NO encryption
    // ======================================================================
    @Nested
    @DisplayName("Text Messages — no encryption")
    class TextMessageTests {

        @Test
        @DisplayName("MessageDto has no encryption fields — text messages stored in plaintext")
        void messageDtoHasNoEncryptionFields() {
            Set<String> dtoFields = Arrays.stream(MessageDto.class.getDeclaredFields())
                    .map(Field::getName)
                    .collect(Collectors.toSet());

            for (String field : E2E_ENCRYPTION_FIELDS) {
                assertFalse(dtoFields.contains(field),
                        "MessageDto contains encryption field '" + field + "' — messages should NOT be encrypted");
            }
        }

        @Test
        @DisplayName("MessageEntity has no encryption columns — messages saved as plaintext in DB")
        void messageEntityHasNoEncryptionColumns() {
            Set<String> entityFields = Arrays.stream(MessageEntity.class.getDeclaredFields())
                    .map(Field::getName)
                    .collect(Collectors.toSet());

            for (String field : E2E_ENCRYPTION_FIELDS) {
                assertFalse(entityFields.contains(field),
                        "MessageEntity contains encryption column '" + field + "' — messages should NOT be encrypted");
            }
        }

        @Test
        @DisplayName("MessageDto content field is plain String, not encrypted blob")
        void messageDtoContentIsPlainString() throws NoSuchFieldException {
            Field contentField = MessageDto.class.getDeclaredField("content");
            assertEquals(String.class, contentField.getType(),
                    "MessageDto.content must be plain String (not byte[], not encrypted wrapper)");
        }

        @Test
        @DisplayName("MessageEntity content is plain String column, not encrypted")
        void messageEntityContentIsPlainString() throws NoSuchFieldException {
            Field contentField = MessageEntity.class.getDeclaredField("content");
            assertEquals(String.class, contentField.getType(),
                    "MessageEntity.content must be plain String (not byte[], not encrypted wrapper)");
        }

        @Test
        @DisplayName("MessageDto has no encrypt/decrypt methods")
        void messageDtoHasNoEncryptMethods() {
            Set<String> methods = Arrays.stream(MessageDto.class.getDeclaredMethods())
                    .map(Method::getName)
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());

            assertFalse(methods.stream().anyMatch(m -> m.contains("encrypt")),
                    "MessageDto should have no encrypt/decrypt methods");
            assertFalse(methods.stream().anyMatch(m -> m.contains("decrypt")),
                    "MessageDto should have no encrypt/decrypt methods");
            assertFalse(methods.stream().anyMatch(m -> m.contains("cipher")),
                    "MessageDto should have no cipher methods");
        }
    }

    // ======================================================================
    // 2. Voice Messages — NO encryption
    // ======================================================================
    @Nested
    @DisplayName("Voice Messages — no encryption")
    class VoiceMessageTests {

        @Test
        @DisplayName("VOICE message type exists and uses same unencrypted DTO")
        void voiceMessageTypeExists() {
            assertDoesNotThrow(() -> MessageType.valueOf("VOICE"),
                    "VOICE message type must exist");
        }

        @Test
        @DisplayName("Voice message fields (duration, waveform) are plain types")
        void voiceFieldsArePlainTypes() throws NoSuchFieldException {
            Field durationField = MessageDto.class.getDeclaredField("duration");
            Field waveformField = MessageDto.class.getDeclaredField("waveform");

            assertEquals(Integer.class, durationField.getType(),
                    "duration must be plain Integer, not encrypted");
            assertEquals(String.class, waveformField.getType(),
                    "waveform must be plain String, not encrypted");
        }

        @Test
        @DisplayName("Voice message fileUrl is plain String — audio file not encrypted")
        void voiceFileUrlIsPlainString() throws NoSuchFieldException {
            Field fileUrlField = MessageDto.class.getDeclaredField("fileUrl");
            assertEquals(String.class, fileUrlField.getType(),
                    "Voice message fileUrl must be plain String — audio not encrypted");
        }

        @Test
        @DisplayName("MessageEntity voice fields stored as plaintext in DB")
        void entityVoiceFieldsArePlaintext() throws NoSuchFieldException {
            Field duration = MessageEntity.class.getDeclaredField("duration");
            Field waveform = MessageEntity.class.getDeclaredField("waveform");

            assertEquals(Integer.class, duration.getType(),
                    "Entity duration must be plain Integer");
            assertEquals(String.class, waveform.getType(),
                    "Entity waveform must be plain String");
        }
    }

    // ======================================================================
    // 3. Video Circle Messages — NO encryption
    // ======================================================================
    @Nested
    @DisplayName("Video Circle Messages — no encryption")
    class VideoCircleMessageTests {

        @Test
        @DisplayName("VIDEO_CIRCLE message type exists and uses same unencrypted DTO")
        void videoCircleTypeExists() {
            assertDoesNotThrow(() -> MessageType.valueOf("VIDEO_CIRCLE"),
                    "VIDEO_CIRCLE message type must exist");
        }

        @Test
        @DisplayName("Video circle thumbnail is plain String — video not encrypted")
        void thumbnailUrlIsPlainString() throws NoSuchFieldException {
            Field thumbnailUrl = MessageDto.class.getDeclaredField("thumbnailUrl");
            assertEquals(String.class, thumbnailUrl.getType(),
                    "thumbnailUrl must be plain String — video not encrypted");
        }

        @Test
        @DisplayName("Video circle shares the same unencrypted file storage path")
        void videoCircleUsesUnencryptedFileUrl() throws NoSuchFieldException {
            // VIDEO_CIRCLE uses the same fileUrl field as regular files — no encryption
            Field fileUrl = MessageDto.class.getDeclaredField("fileUrl");
            assertEquals(String.class, fileUrl.getType(),
                    "VIDEO_CIRCLE fileUrl must be plain String");
        }
    }

    // ======================================================================
    // 4. File Uploads/Downloads — NO encryption
    // ======================================================================
    @Nested
    @DisplayName("File Uploads/Downloads — no encryption")
    class FileTests {

        @Test
        @DisplayName("FileController has no encryption/decryption methods")
        void fileControllerHasNoEncryption() {
            Set<String> methods = Arrays.stream(FileController.class.getDeclaredMethods())
                    .map(Method::getName)
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());

            assertFalse(methods.stream().anyMatch(m -> m.contains("encrypt")),
                    "FileController should have no encrypt methods — files stored as plaintext");
            assertFalse(methods.stream().anyMatch(m -> m.contains("decrypt")),
                    "FileController should have no decrypt methods — files served as plaintext");
            assertFalse(methods.stream().anyMatch(m -> m.contains("cipher")),
                    "FileController should have no cipher methods");
        }

        @Test
        @DisplayName("FileController does not depend on any encryption service")
        void fileControllerNoCryptoFields() {
            Set<String> fieldTypes = Arrays.stream(FileController.class.getDeclaredFields())
                    .map(f -> f.getType().getSimpleName().toLowerCase())
                    .collect(Collectors.toSet());

            assertFalse(fieldTypes.stream().anyMatch(t ->
                            t.contains("encrypt") || t.contains("crypto") || t.contains("cipher")),
                    "FileController must not depend on any encryption service");
        }

        @Test
        @DisplayName("File message metadata (fileName, fileSize, fileType) are plain types")
        void fileMetadataIsPlain() throws NoSuchFieldException {
            Field fileName = MessageDto.class.getDeclaredField("fileName");
            Field fileSize = MessageDto.class.getDeclaredField("fileSize");
            Field fileType = MessageDto.class.getDeclaredField("fileType");
            Field fileUrl = MessageDto.class.getDeclaredField("fileUrl");

            assertEquals(String.class, fileName.getType());
            assertEquals(long.class, fileSize.getType());
            assertEquals(String.class, fileType.getType());
            assertEquals(String.class, fileUrl.getType());
        }
    }

    // ======================================================================
    // 5. WebRTC Call Signaling — NO encryption (relay only)
    // ======================================================================
    @Nested
    @DisplayName("WebRTC Call Signaling — no encryption")
    class CallSignalingTests {

        @Test
        @DisplayName("Call signaling types exist — server acts as plain relay")
        void callSignalingTypesExist() {
            assertDoesNotThrow(() -> MessageType.valueOf("CALL_OFFER"));
            assertDoesNotThrow(() -> MessageType.valueOf("CALL_ANSWER"));
            assertDoesNotThrow(() -> MessageType.valueOf("CALL_REJECT"));
            assertDoesNotThrow(() -> MessageType.valueOf("CALL_END"));
            assertDoesNotThrow(() -> MessageType.valueOf("CALL_BUSY"));
            assertDoesNotThrow(() -> MessageType.valueOf("ICE_CANDIDATE"));
            assertDoesNotThrow(() -> MessageType.valueOf("CALL_REOFFER"));
            assertDoesNotThrow(() -> MessageType.valueOf("CALL_REANSWER"));
        }

        @Test
        @DisplayName("ChatWebSocketHandler has no encryption fields — signaling relayed in plaintext")
        void handlerHasNoEncryptionFields() {
            Set<String> fieldTypes = Arrays.stream(ChatWebSocketHandler.class.getDeclaredFields())
                    .map(f -> f.getType().getSimpleName().toLowerCase())
                    .collect(Collectors.toSet());

            assertFalse(fieldTypes.stream().anyMatch(t ->
                            t.contains("encrypt") || t.contains("crypto") || t.contains("cipher")),
                    "ChatWebSocketHandler must not have encryption service dependencies");
        }

        @Test
        @DisplayName("ChatWebSocketHandler has no encrypt/decrypt methods")
        void handlerHasNoEncryptMethods() {
            Set<String> methods = Arrays.stream(ChatWebSocketHandler.class.getDeclaredMethods())
                    .map(Method::getName)
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());

            assertFalse(methods.stream().anyMatch(m -> m.contains("encrypt")),
                    "Handler should not encrypt call signaling data");
            assertFalse(methods.stream().anyMatch(m -> m.contains("decrypt")),
                    "Handler should not decrypt call signaling data");
        }

        @Test
        @DisplayName("CALL_LOG message type stores call history as plain text")
        void callLogIsPlaintext() {
            assertDoesNotThrow(() -> MessageType.valueOf("CALL_LOG"),
                    "CALL_LOG type must exist for plaintext call history");
        }
    }

    // ======================================================================
    // 6. Conference (Group Call) Signaling — NO encryption
    // ======================================================================
    @Nested
    @DisplayName("Conference Signaling — no encryption")
    class ConferenceTests {

        @Test
        @DisplayName("Conference signaling types exist — server relays in plaintext")
        void conferenceTypesExist() {
            assertDoesNotThrow(() -> MessageType.valueOf("CONF_JOIN"));
            assertDoesNotThrow(() -> MessageType.valueOf("CONF_LEAVE"));
            assertDoesNotThrow(() -> MessageType.valueOf("CONF_PEERS"));
            assertDoesNotThrow(() -> MessageType.valueOf("CONF_OFFER"));
            assertDoesNotThrow(() -> MessageType.valueOf("CONF_ANSWER"));
            assertDoesNotThrow(() -> MessageType.valueOf("CONF_ICE"));
            assertDoesNotThrow(() -> MessageType.valueOf("CONF_INVITE"));
        }
    }

    // ======================================================================
    // 7. ChatService — NO encryption in persistence layer
    // ======================================================================
    @Nested
    @DisplayName("ChatService — no encryption in persistence")
    class ChatServicePersistenceTests {

        @Test
        @DisplayName("ChatService has no encryption/decryption methods")
        void chatServiceHasNoEncryption() {
            Set<String> methods = Arrays.stream(ChatService.class.getDeclaredMethods())
                    .map(Method::getName)
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());

            assertFalse(methods.stream().anyMatch(m -> m.contains("encrypt")),
                    "ChatService should not encrypt messages before saving");
            assertFalse(methods.stream().anyMatch(m -> m.contains("decrypt")),
                    "ChatService should not decrypt messages when loading");
            assertFalse(methods.stream().anyMatch(m -> m.contains("cipher")),
                    "ChatService should not use any cipher operations");
        }

        @Test
        @DisplayName("ChatService does not depend on any encryption service")
        void chatServiceNoCryptoDependency() {
            Set<String> fieldTypes = Arrays.stream(ChatService.class.getDeclaredFields())
                    .map(f -> f.getType().getSimpleName().toLowerCase())
                    .collect(Collectors.toSet());

            assertFalse(fieldTypes.stream().anyMatch(t ->
                            t.contains("encrypt") || t.contains("crypto") || t.contains("cipher")),
                    "ChatService must not depend on any encryption service");
        }
    }

    // ======================================================================
    // 8. Encryption infrastructure MUST NOT exist
    // ======================================================================
    @Nested
    @DisplayName("Encryption infrastructure removed")
    class EncryptionInfrastructureTests {

        @Test
        @DisplayName("No EncryptionService class exists")
        void noEncryptionServiceClass() {
            for (String className : REMOVED_ENCRYPTION_CLASSES) {
                assertThrows(ClassNotFoundException.class,
                        () -> Class.forName(className),
                        "Encryption class should not exist: " + className);
            }
        }

        @Test
        @DisplayName("MessageDto has no E2E getters/setters")
        void noE2eGettersSetters() {
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
                    "getOneTimeKeyId", "setOneTimeKeyId",
                    "getCiphertext", "setCiphertext",
                    "getNonce", "setNonce"
            );

            for (String m : forbiddenMethods) {
                assertFalse(methods.contains(m),
                        "MessageDto should not have E2E method: " + m);
            }
        }

        @Test
        @DisplayName("MessageEntity has no E2E getters/setters")
        void entityNoE2eGettersSetters() {
            Set<String> methods = Arrays.stream(MessageEntity.class.getDeclaredMethods())
                    .map(Method::getName)
                    .collect(Collectors.toSet());

            Set<String> forbiddenMethods = Set.of(
                    "isEncrypted", "setEncrypted",
                    "getEncryptedContent", "setEncryptedContent",
                    "getIv", "setIv",
                    "getCiphertext", "setCiphertext",
                    "getNonce", "setNonce"
            );

            for (String m : forbiddenMethods) {
                assertFalse(methods.contains(m),
                        "MessageEntity should not have E2E method: " + m);
            }
        }
    }

    // ======================================================================
    // 9. Data integrity — plaintext content is preserved as-is
    // ======================================================================
    @Nested
    @DisplayName("Data integrity — plaintext preserved")
    class DataIntegrityTests {

        @Test
        @DisplayName("Text message content round-trips through DTO without transformation")
        void textMessageContentPreserved() {
            MessageDto dto = new MessageDto();
            String plaintext = "Привет! Hello! 你好! 🎉 <script>alert('xss')</script>";
            dto.setContent(plaintext);
            assertEquals(plaintext, dto.getContent(),
                    "Content must be preserved as-is — no encryption transformation");
        }

        @Test
        @DisplayName("Voice message URL preserved without encryption")
        void voiceUrlPreserved() {
            MessageDto dto = new MessageDto();
            dto.setType(MessageType.VOICE);
            dto.setFileUrl("/api/uploads/voice-abc123.webm");
            dto.setDuration(15);
            dto.setWaveform("[0.1,0.5,0.8,0.3]");

            assertEquals("/api/uploads/voice-abc123.webm", dto.getFileUrl());
            assertEquals(15, dto.getDuration());
            assertEquals("[0.1,0.5,0.8,0.3]", dto.getWaveform());
        }

        @Test
        @DisplayName("Video circle message URL preserved without encryption")
        void videoCircleUrlPreserved() {
            MessageDto dto = new MessageDto();
            dto.setType(MessageType.VIDEO_CIRCLE);
            dto.setFileUrl("/api/uploads/video-circle-xyz.webm");
            dto.setThumbnailUrl("/api/uploads/thumb-xyz.jpg");

            assertEquals("/api/uploads/video-circle-xyz.webm", dto.getFileUrl());
            assertEquals("/api/uploads/thumb-xyz.jpg", dto.getThumbnailUrl());
        }

        @Test
        @DisplayName("File message metadata preserved without encryption")
        void fileMetadataPreserved() {
            MessageDto dto = new MessageDto();
            dto.setFileUrl("/api/uploads/document-123.pdf");
            dto.setFileName("important-report.pdf");
            dto.setFileSize(1048576);
            dto.setFileType("application/pdf");

            assertEquals("/api/uploads/document-123.pdf", dto.getFileUrl());
            assertEquals("important-report.pdf", dto.getFileName());
            assertEquals(1048576, dto.getFileSize());
            assertEquals("application/pdf", dto.getFileType());
        }

        @Test
        @DisplayName("Entity content field stores plaintext (no Base64/hex encoding of encrypted data)")
        void entityStoresPlaintext() {
            MessageEntity entity = new MessageEntity();
            String message = "Обычное сообщение с эмодзи 🔥 и <html> тегами";
            entity.setContent(message);
            assertEquals(message, entity.getContent(),
                    "Entity must store content as plaintext without encryption");
        }

        @Test
        @DisplayName("Entity voice fields stored as plaintext")
        void entityVoicePlaintext() {
            MessageEntity entity = new MessageEntity();
            entity.setDuration(30);
            entity.setWaveform("[0.2,0.4,0.6,0.8,1.0]");
            entity.setFileUrl("/api/uploads/voice-msg.ogg");

            assertEquals(30, entity.getDuration());
            assertEquals("[0.2,0.4,0.6,0.8,1.0]", entity.getWaveform());
            assertEquals("/api/uploads/voice-msg.ogg", entity.getFileUrl());
        }
    }
}
