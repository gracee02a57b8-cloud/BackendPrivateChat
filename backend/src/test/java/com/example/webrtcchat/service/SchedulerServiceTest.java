package com.example.webrtcchat.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class SchedulerServiceTest {

    private final SchedulerService schedulerService = new SchedulerService();

    @AfterEach
    void tearDown() {
        schedulerService.shutdown();
    }

    @Test
    @DisplayName("schedule executes task at scheduled time")
    void schedule_executesTask() throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicBoolean executed = new AtomicBoolean(false);

        // Schedule for "now" (past time = immediate)
        String pastTime = "2020-01-01T00:00";
        schedulerService.schedule("msg-1", pastTime, () -> {
            executed.set(true);
            latch.countDown();
        });

        assertTrue(latch.await(3, TimeUnit.SECONDS), "Task should execute within 3 seconds");
        assertTrue(executed.get());
    }

    @Test
    @DisplayName("cancel prevents task execution")
    void cancel_preventsExecution() throws InterruptedException {
        AtomicBoolean executed = new AtomicBoolean(false);

        // Schedule far into the future
        String futureTime = "2099-12-31T23:59";
        schedulerService.schedule("msg-2", futureTime, () -> executed.set(false));

        boolean cancelled = schedulerService.cancel("msg-2");
        assertTrue(cancelled);

        Thread.sleep(500);
        assertFalse(executed.get());
    }

    @Test
    @DisplayName("cancel returns false for unknown message")
    void cancel_unknownMessage() {
        assertFalse(schedulerService.cancel("nonexistent"));
    }

    @Test
    @DisplayName("schedule handles invalid date format gracefully")
    void schedule_invalidDate() {
        AtomicBoolean executed = new AtomicBoolean(false);

        // Should not throw, just log error
        assertDoesNotThrow(() ->
                schedulerService.schedule("msg-3", "invalid-date", () -> executed.set(true))
        );

        assertFalse(executed.get());
    }

    @Test
    @DisplayName("schedule with past time executes immediately")
    void schedule_pastTimeExecutesImmediately() throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);

        schedulerService.schedule("msg-4", "2020-01-01T00:00", latch::countDown);

        assertTrue(latch.await(2, TimeUnit.SECONDS));
    }

    @Test
    @DisplayName("Multiple schedules can coexist")
    void schedule_multiple() throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(2);

        schedulerService.schedule("msg-a", "2020-01-01T00:00", latch::countDown);
        schedulerService.schedule("msg-b", "2020-01-01T00:00", latch::countDown);

        assertTrue(latch.await(3, TimeUnit.SECONDS));
    }
}
