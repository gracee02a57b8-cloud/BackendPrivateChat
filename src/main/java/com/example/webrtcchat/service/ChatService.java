package com.example.webrtcchat.service;

import com.example.webrtcchat.dto.MessageDto;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class ChatService {
  private final List<MessageDto> history = new ArrayList<>();
  private final List<String> users = new ArrayList<>();

  public void send(MessageDto message) {
    history.add(message);
  }

  public List<MessageDto> getHistory() {
    return history;
  }

  public void addUser(String user) {
    users.add(user);
  }

  public void removeUser(String user) {
    users.remove(user);
  }
}