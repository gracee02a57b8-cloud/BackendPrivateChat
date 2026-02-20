package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.MessageDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class ChatService {

    private final List<MessageDto> history = new CopyOnWriteArrayList<>();
    private final List<String> users = new CopyOnWriteArrayList<>();

    public void send(MessageDto message) {
        history.add(message);
    }

    public List<MessageDto> getHistory() {
        return List.copyOf(history);
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
}