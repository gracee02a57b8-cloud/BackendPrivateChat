package com.example.webrtcchat.service;

import com.example.webrtcchat.entity.RoomMuteEntity;
import com.example.webrtcchat.repository.RoomMuteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RoomMuteService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final RoomMuteRepository roomMuteRepository;

    public RoomMuteService(RoomMuteRepository roomMuteRepository) {
        this.roomMuteRepository = roomMuteRepository;
    }

    /**
     * Mute a room for a user. mutedUntil = null means forever.
     */
    @Transactional
    public void muteRoom(String username, String roomId, String mutedUntil) {
        Optional<RoomMuteEntity> existing = roomMuteRepository.findByUsernameAndRoomId(username, roomId);
        if (existing.isPresent()) {
            existing.get().setMutedUntil(mutedUntil);
            roomMuteRepository.save(existing.get());
        } else {
            RoomMuteEntity entity = new RoomMuteEntity();
            entity.setUsername(username);
            entity.setRoomId(roomId);
            entity.setMutedUntil(mutedUntil);
            roomMuteRepository.save(entity);
        }
    }

    @Transactional
    public void unmuteRoom(String username, String roomId) {
        roomMuteRepository.findByUsernameAndRoomId(username, roomId)
                .ifPresent(roomMuteRepository::delete);
    }

    @Transactional(readOnly = true)
    public boolean isRoomMuted(String username, String roomId) {
        Optional<RoomMuteEntity> mute = roomMuteRepository.findByUsernameAndRoomId(username, roomId);
        if (mute.isEmpty()) return false;

        String until = mute.get().getMutedUntil();
        if (until == null || until.isEmpty()) return true; // muted forever

        try {
            LocalDateTime muteEnd = LocalDateTime.parse(until, FORMATTER);
            if (muteEnd.isBefore(LocalDateTime.now())) {
                // Mute expired — clean up
                roomMuteRepository.delete(mute.get());
                return false;
            }
            return true;
        } catch (Exception e) {
            return true; // if can't parse, assume muted
        }
    }

    @Transactional(readOnly = true)
    public Set<String> getMutedRoomIds(String username) {
        return roomMuteRepository.findByUsername(username)
                .stream()
                .map(RoomMuteEntity::getRoomId)
                .collect(Collectors.toSet());
    }
}
