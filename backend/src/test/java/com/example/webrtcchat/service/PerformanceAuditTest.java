package com.example.webrtcchat.service;

import com.example.webrtcchat.repository.RoomRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.scheduling.annotation.Scheduled;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.concurrent.ExecutorService;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests verifying all performance & configuration audit fixes (sections 3 & 4).
 * Note: 3.1 (single room load) tests live in ChatWebSocketHandlerTest (same package).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PerformanceAuditTest {

    // ═══════════════════════════════════════════════════════
    //  3.1 — Tests in ChatWebSocketHandlerTest (controller package)
    // ═══════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════
    //  3.5 — WebPushService has dedicated PUSH_EXECUTOR
    // ═══════════════════════════════════════════════════════

    @Nested
    @DisplayName("3.5 — Dedicated push executor")
    class PushExecutorTest {

        @Test
        @DisplayName("PUSH_EXECUTOR field exists and is an ExecutorService")
        void pushExecutor_exists() throws Exception {
            Field field = WebPushService.class.getDeclaredField("PUSH_EXECUTOR");
            field.setAccessible(true);
            Object executor = field.get(null); // static field
            assertNotNull(executor, "PUSH_EXECUTOR must not be null");
            assertInstanceOf(ExecutorService.class, executor, "PUSH_EXECUTOR must be an ExecutorService");
        }

        @Test
        @DisplayName("PUSH_EXECUTOR is not shut down at startup")
        void pushExecutor_notShutdown() throws Exception {
            Field field = WebPushService.class.getDeclaredField("PUSH_EXECUTOR");
            field.setAccessible(true);
            ExecutorService executor = (ExecutorService) field.get(null);
            assertFalse(executor.isShutdown(), "PUSH_EXECUTOR should not be shut down");
        }
    }

    // ═══════════════════════════════════════════════════════
    //  3.6 — Scheduler interval is 30 seconds (not 10)
    // ═══════════════════════════════════════════════════════

    @Nested
    @DisplayName("3.6 — Scheduler interval 30s")
    class SchedulerIntervalTest {

        @Test
        @DisplayName("deleteExpiredMessages runs at 30_000ms interval")
        void schedulerInterval_is30s() throws Exception {
            Method method = DisappearingMessageScheduler.class.getMethod("deleteExpiredMessages");
            Scheduled annotation = method.getAnnotation(Scheduled.class);

            assertNotNull(annotation, "@Scheduled annotation must be present");
            assertEquals(30_000L, annotation.fixedRate(),
                    "Scheduler fixedRate must be 30000ms (30s), not 10000ms");
        }
    }

    // ═══════════════════════════════════════════════════════
    //  3.7 — findUserRooms uses INNER JOIN (not LEFT JOIN)
    // ═══════════════════════════════════════════════════════

    @Nested
    @DisplayName("3.7 — INNER JOIN in findUserRooms")
    class InnerJoinTest {

        @Test
        @DisplayName("findUserRooms @Query uses JOIN (not LEFT JOIN)")
        void findUserRooms_usesInnerJoin() throws Exception {
            Method method = RoomRepository.class.getMethod("findUserRooms", String.class);
            org.springframework.data.jpa.repository.Query queryAnnotation =
                    method.getAnnotation(org.springframework.data.jpa.repository.Query.class);

            assertNotNull(queryAnnotation, "@Query annotation must be present");
            String jpql = queryAnnotation.value();

            assertFalse(jpql.toUpperCase().contains("LEFT JOIN"),
                    "findUserRooms must NOT use LEFT JOIN, got: " + jpql);
            assertTrue(jpql.contains("JOIN r.members"),
                    "findUserRooms must use INNER JOIN on members, got: " + jpql);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  3.2 — Batch contact loading (findByUsernameIn)
    // ═══════════════════════════════════════════════════════

    @Nested
    @DisplayName("3.2 — UserRepository batch method exists")
    class BatchContactLoadingTest {

        @Test
        @DisplayName("findByUsernameIn method exists in UserRepository")
        void findByUsernameIn_exists() throws Exception {
            Method method = com.example.webrtcchat.repository.UserRepository.class
                    .getMethod("findByUsernameIn", List.class);
            assertNotNull(method, "findByUsernameIn(List) must exist in UserRepository");
            assertEquals(List.class, method.getReturnType(),
                    "findByUsernameIn must return a List");
        }
    }
}
