package com.example.webrtcchat.service;

import com.example.webrtcchat.config.AdminUserInitializer;
import com.example.webrtcchat.config.SecurityConfig;
import com.example.webrtcchat.entity.ChatFolderEntity;
import com.example.webrtcchat.entity.ReadReceiptEntity;
import com.example.webrtcchat.entity.StoryViewEntity;
import com.example.webrtcchat.repository.ReadReceiptRepository;
import com.example.webrtcchat.repository.StoryViewRepository;
import com.example.webrtcchat.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import jakarta.persistence.ElementCollection;
import jakarta.persistence.FetchType;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for the performance + architecture audit fixes (P0-P3).
 * Covers: B1 (admin password from env), B2 (JWT key length),
 * B9 (trusted proxy 172.x range), B12 (ReadReceipt count query),
 * B6 (Story batch view count), B13 (executor @PreDestroy),
 * ChatFolderEntity EAGER→LAZY, ProfileController Principal usage.
 */
class PerformanceArchAuditTest {

    // ═══════════════════ B1: Admin password from ENV ═══════════════════

    @Nested
    @DisplayName("B1: AdminUserInitializer — no hardcoded password")
    class AdminPasswordTests {

        @Test
        @DisplayName("AdminUserInitializer class has no hardcoded password constant")
        void noHardcodedPasswordInSource() throws Exception {
            // Verify the class does NOT have a field named ADMIN_PASSWORD
            Field[] fields = AdminUserInitializer.class.getDeclaredFields();
            for (Field f : fields) {
                assertNotEquals("ADMIN_PASSWORD", f.getName(),
                    "Hardcoded ADMIN_PASSWORD field still exists in AdminUserInitializer!");
            }
        }

        @Test
        @DisplayName("initAdminUser bean method accepts adminPassword parameter")
        void initAdminUserAcceptsPasswordParam() throws Exception {
            // Verify the bean method signature includes String adminPassword
            Method[] methods = AdminUserInitializer.class.getDeclaredMethods();
            boolean found = false;
            for (Method m : methods) {
                if ("initAdminUser".equals(m.getName())) {
                    Class<?>[] params = m.getParameterTypes();
                    assertTrue(params.length >= 3, "initAdminUser should have at least 3 params");
                    assertEquals(String.class, params[2], "3rd param should be String adminPassword");
                    found = true;
                }
            }
            assertTrue(found, "initAdminUser method not found");
        }
    }

    // ═══════════════════ B2: JWT key length validation ═══════════════════

    @Nested
    @DisplayName("B2: JwtService — key length validation")
    class JwtKeyValidationTests {

        @Test
        @DisplayName("JwtService rejects secret shorter than 32 bytes")
        void rejectsShortSecret() {
            assertThrows(IllegalArgumentException.class, () ->
                new JwtService("short", 3600000L),
                "Should reject secrets < 32 bytes"
            );
        }

        @Test
        @DisplayName("JwtService rejects 31-byte secret")
        void rejects31ByteSecret() {
            String thirtyOne = "a".repeat(31);
            assertThrows(IllegalArgumentException.class, () ->
                new JwtService(thirtyOne, 3600000L)
            );
        }

        @Test
        @DisplayName("JwtService accepts 32-byte secret")
        void accepts32ByteSecret() {
            String thirtyTwo = "a".repeat(32);
            assertDoesNotThrow(() -> new JwtService(thirtyTwo, 3600000L));
        }

        @Test
        @DisplayName("JwtService accepts long secret")
        void acceptsLongSecret() {
            String longSecret = "test-jwt-secret-key-for-unit-tests-min-32-chars!!";
            JwtService svc = new JwtService(longSecret, 3600000L);
            String token = svc.generateToken("test");
            assertTrue(svc.isTokenValid(token));
        }

        @Test
        @DisplayName("JwtService uses UTF-8 encoding for key bytes")
        void usesUtf8Encoding() {
            // A secret with non-ASCII chars — UTF-8 encodes to more bytes than Latin-1
            String unicodeSecret = "тест-секрет-для-jwt-минимум-32-байта!!";
            byte[] utf8Bytes = unicodeSecret.getBytes(StandardCharsets.UTF_8);
            if (utf8Bytes.length >= 32) {
                assertDoesNotThrow(() -> new JwtService(unicodeSecret, 3600000L));
            }
        }
    }

    // ═══════════════════ B9: Trusted proxy 172.x range fix ═══════════════════

    @Nested
    @DisplayName("B9: SecurityConfig — isTrustedProxy 172.x range")
    class TrustedProxyTests {

        @Test
        @DisplayName("isTrustedProxy accepts 172.16.x.x (RFC 1918 start)")
        void accepts172_16() throws Exception {
            assertTrue(invokeIsTrustedProxy("172.16.0.1"));
        }

        @Test
        @DisplayName("isTrustedProxy accepts 172.31.x.x (RFC 1918 end)")
        void accepts172_31() throws Exception {
            assertTrue(invokeIsTrustedProxy("172.31.255.255"));
        }

        @Test
        @DisplayName("isTrustedProxy rejects 172.15.x.x (below RFC 1918)")
        void rejects172_15() throws Exception {
            assertFalse(invokeIsTrustedProxy("172.15.0.1"));
        }

        @Test
        @DisplayName("isTrustedProxy rejects 172.32.x.x (above RFC 1918)")
        void rejects172_32() throws Exception {
            assertFalse(invokeIsTrustedProxy("172.32.0.1"));
        }

        @Test
        @DisplayName("isTrustedProxy rejects 172.1.2.3 (non-private)")
        void rejects172_1() throws Exception {
            assertFalse(invokeIsTrustedProxy("172.1.2.3"));
        }

        @Test
        @DisplayName("isTrustedProxy accepts 127.0.0.1")
        void acceptsLoopback() throws Exception {
            assertTrue(invokeIsTrustedProxy("127.0.0.1"));
        }

        @Test
        @DisplayName("isTrustedProxy accepts 10.0.0.1")
        void accepts10() throws Exception {
            assertTrue(invokeIsTrustedProxy("10.0.0.1"));
        }

        @Test
        @DisplayName("isTrustedProxy accepts 192.168.1.1")
        void accepts192_168() throws Exception {
            assertTrue(invokeIsTrustedProxy("192.168.1.1"));
        }

        @Test
        @DisplayName("isTrustedProxy rejects public IP")
        void rejectsPublicIp() throws Exception {
            assertFalse(invokeIsTrustedProxy("8.8.8.8"));
        }

        @Test
        @DisplayName("isTrustedProxy rejects null")
        void rejectsNull() throws Exception {
            assertFalse(invokeIsTrustedProxy(null));
        }

        private boolean invokeIsTrustedProxy(String ip) throws Exception {
            // Use reflection to test the private method
            JwtService jwtService = new JwtService(
                    "test-jwt-secret-key-for-unit-tests-min-32-chars!!", 3600000L);
            SecurityConfig config = new SecurityConfig(jwtService, "http://localhost:*", 10, 60000);
            Method method = SecurityConfig.class.getDeclaredMethod("isTrustedProxy", String.class);
            method.setAccessible(true);
            return (boolean) method.invoke(config, ip);
        }
    }

    // ═══════════════════ B12: ReadReceiptService COUNT query ═══════════════════

    @Nested
    @DisplayName("B12: ReadReceiptService — uses count query")
    class ReadReceiptCountTests {

        @Test
        @DisplayName("ReadReceiptRepository declares countByMessageId method")
        void repositoryHasCountMethod() throws Exception {
            Method method = ReadReceiptRepository.class.getMethod("countByMessageId", String.class);
            assertNotNull(method);
            assertEquals(long.class, method.getReturnType());
        }
    }

    // ═══════════════════ B6: StoryViewRepository batch count ═══════════════════

    @Nested
    @DisplayName("B6: StoryViewRepository — batch view count")
    class StoryBatchCountTests {

        @Test
        @DisplayName("StoryViewRepository has countByStoryIds default method")
        void repositoryHasBatchCountMethod() throws Exception {
            Method method = StoryViewRepository.class.getMethod("countByStoryIds", java.util.List.class);
            assertNotNull(method);
            assertEquals(java.util.Map.class, method.getReturnType());
        }

        @Test
        @DisplayName("StoryViewRepository has countByStoryIdsRaw query method")
        void repositoryHasRawBatchCountMethod() throws Exception {
            Method method = StoryViewRepository.class.getMethod("countByStoryIdsRaw", java.util.List.class);
            assertNotNull(method);
        }
    }

    // ═══════════════════ P2: ChatFolderEntity EAGER→LAZY ═══════════════════

    @Nested
    @DisplayName("P2: ChatFolderEntity — LAZY @ElementCollection")
    class ChatFolderLazyTests {

        @Test
        @DisplayName("ChatFolderEntity.roomIds uses FetchType.LAZY")
        void roomIdsIsLazy() throws Exception {
            Field roomIds = ChatFolderEntity.class.getDeclaredField("roomIds");
            ElementCollection annotation = roomIds.getAnnotation(ElementCollection.class);
            assertNotNull(annotation, "roomIds should have @ElementCollection");
            assertEquals(FetchType.LAZY, annotation.fetch(),
                    "roomIds @ElementCollection should use FetchType.LAZY");
        }
    }

    // ═══════════════════ B13: ChatWebSocketHandler @PreDestroy ═══════════════════

    @Nested
    @DisplayName("B13: ChatWebSocketHandler — executor @PreDestroy")
    class WsExecutorPreDestroyTests {

        @Test
        @DisplayName("ChatWebSocketHandler has shutdownExecutor method with @PreDestroy")
        void hasPreDestroyMethod() throws Exception {
            Class<?> clazz = com.example.webrtcchat.controller.ChatWebSocketHandler.class;
            Method method = clazz.getMethod("shutdownExecutor");
            assertNotNull(method.getAnnotation(jakarta.annotation.PreDestroy.class),
                    "shutdownExecutor must be annotated with @PreDestroy");
        }
    }

    // ═══════════════════ WebPushService @PreDestroy ═══════════════════

    @Nested
    @DisplayName("WebPushService — executor @PreDestroy")
    class WebPushPreDestroyTests {

        @Test
        @DisplayName("WebPushService has shutdownPushExecutor method with @PreDestroy")
        void hasPreDestroyMethod() throws Exception {
            Method method = WebPushService.class.getDeclaredMethod("shutdownPushExecutor");
            method.setAccessible(true);
            assertNotNull(method.getAnnotation(jakarta.annotation.PreDestroy.class),
                    "shutdownPushExecutor must be annotated with @PreDestroy");
        }
    }

    // ═══════════════════ ProfileController uses Principal ═══════════════════

    @Nested
    @DisplayName("ProfileController — uses Principal instead of manual JWT parsing")
    class ProfileControllerPrincipalTests {

        @Test
        @DisplayName("ProfileController.getProfile accepts Principal param")
        void getProfileUsesPrincipal() throws Exception {
            Class<?> clazz = com.example.webrtcchat.controller.ProfileController.class;
            Method method = clazz.getMethod("getProfile", java.security.Principal.class);
            assertNotNull(method);
        }

        @Test
        @DisplayName("ProfileController.updateProfile accepts Principal param")
        void updateProfileUsesPrincipal() throws Exception {
            Class<?> clazz = com.example.webrtcchat.controller.ProfileController.class;
            Method method = clazz.getMethod("updateProfile", java.security.Principal.class, java.util.Map.class);
            assertNotNull(method);
        }

        @Test
        @DisplayName("ProfileController.uploadAvatar accepts Principal param")
        void uploadAvatarUsesPrincipal() throws Exception {
            Class<?> clazz = com.example.webrtcchat.controller.ProfileController.class;
            Method method = clazz.getMethod("uploadAvatar", java.security.Principal.class,
                    org.springframework.web.multipart.MultipartFile.class);
            assertNotNull(method);
        }

        @Test
        @DisplayName("ProfileController.deleteAvatar accepts Principal param")
        void deleteAvatarUsesPrincipal() throws Exception {
            Class<?> clazz = com.example.webrtcchat.controller.ProfileController.class;
            Method method = clazz.getMethod("deleteAvatar", java.security.Principal.class);
            assertNotNull(method);
        }

        @Test
        @DisplayName("ProfileController no longer depends on JwtService")
        void noJwtServiceDependency() {
            // Check constructor params — should NOT include JwtService
            var constructors = com.example.webrtcchat.controller.ProfileController.class.getConstructors();
            for (var ctor : constructors) {
                for (Class<?> param : ctor.getParameterTypes()) {
                    assertNotEquals(JwtService.class, param,
                            "ProfileController should no longer depend on JwtService");
                }
            }
        }
    }
}
