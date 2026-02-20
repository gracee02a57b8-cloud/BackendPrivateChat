package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.MessageDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class ChatService {

    private final Map<String, List<MessageDto>> historyByRoom = new ConcurrentHashMap<>();
    private final List<String> users = new CopyOnWriteArrayList<>();

    public void send(String roomId, MessageDto message) {
        historyByRoom.computeIfAbsent(roomId, k -> new CopyOnWriteArrayList<>()).add(message);
    }

    public List<MessageDto> getHistory(String roomId) {
        List<MessageDto> history = historyByRoom.get(roomId);
        return history != null ? List.copyOf(history) : List.of();
    }

    public List<MessageDto> getHistory() {
        return getHistory("general");
    }

    public void addUser(String user) {
        if (!users.contains(user)) {
            users.add(user);
        }
    }

    public void removeUser(String user) {
        users.remove(user);
    }

    public List<String> getOnlineUsers() {
        return List.copyOf(users);
    }

    public List<String> searchUsers(String query) {
        if (query == null || query.isBlank()) return getOnlineUsers();
        String lower = query.toLowerCase();
        return users.stream()
                .filter(u -> u.toLowerCase().contains(lower))
                .toList();
    }
}