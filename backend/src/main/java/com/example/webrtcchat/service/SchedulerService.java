package com.example.webrtcchat.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.*;

@Service
public class SchedulerService {

    private static final Logger log = LoggerFactory.getLogger(SchedulerService.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(2);
    private final Map<String, ScheduledFuture<?>> scheduled = new ConcurrentHashMap<>();

    public void schedule(String messageId, String scheduledAt, Runnable task) {
        try {
            LocalDateTime target = LocalDateTime.parse(scheduledAt, FORMATTER);
            long delayMs = Duration.between(LocalDateTime.now(), target).toMillis();
            if (delayMs < 0) delayMs = 0;

            ScheduledFuture<?> future = executor.schedule(() -> {
                task.run();
                scheduled.remove(messageId);
            }, delayMs, TimeUnit.MILLISECONDS);

            scheduled.put(messageId, future);
            log.info("Scheduled message {} for {} (delay={}ms)", messageId, scheduledAt, delayMs);
        } catch (Exception e) {
            log.error("Failed to schedule message {}: {}", messageId, e.getMessage());
        }
    }

    public boolean cancel(String messageId) {
        ScheduledFuture<?> future = scheduled.remove(messageId);
        if (future != null) {
            future.cancel(false);
            return true;
        }
        return false;
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdownNow();
    }
}
