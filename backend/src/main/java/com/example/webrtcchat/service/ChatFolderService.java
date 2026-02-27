package com.example.webrtcchat.service;

import com.example.webrtcchat.entity.ChatFolderEntity;
import com.example.webrtcchat.repository.ChatFolderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChatFolderService {

    private final ChatFolderRepository chatFolderRepository;

    public ChatFolderService(ChatFolderRepository chatFolderRepository) {
        this.chatFolderRepository = chatFolderRepository;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getFolders(String username) {
        return chatFolderRepository.findByUsernameOrderBySortOrderAsc(username)
                .stream().map(this::toMap).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> createFolder(String username, String name, String emoji) {
        long count = chatFolderRepository.countByUsername(username);
        ChatFolderEntity entity = new ChatFolderEntity();
        entity.setUsername(username);
        entity.setName(name);
        entity.setEmoji(emoji != null ? emoji : "📁");
        entity.setSortOrder((int) count);
        entity.setRoomIds(new HashSet<>());
        chatFolderRepository.save(entity);
        return toMap(entity);
    }

    @Transactional
    public Map<String, Object> updateFolder(Long folderId, String username, String name, String emoji) {
        Optional<ChatFolderEntity> opt = chatFolderRepository.findById(folderId);
        if (opt.isEmpty()) return null;
        ChatFolderEntity entity = opt.get();
        if (!entity.getUsername().equals(username)) return null;
        if (name != null) entity.setName(name);
        if (emoji != null) entity.setEmoji(emoji);
        chatFolderRepository.save(entity);
        return toMap(entity);
    }

    @Transactional
    public boolean deleteFolder(Long folderId, String username) {
        Optional<ChatFolderEntity> opt = chatFolderRepository.findById(folderId);
        if (opt.isEmpty()) return false;
        if (!opt.get().getUsername().equals(username)) return false;
        chatFolderRepository.delete(opt.get());
        return true;
    }

    @Transactional
    public Map<String, Object> addRoomToFolder(Long folderId, String username, String roomId) {
        Optional<ChatFolderEntity> opt = chatFolderRepository.findById(folderId);
        if (opt.isEmpty()) return null;
        ChatFolderEntity entity = opt.get();
        if (!entity.getUsername().equals(username)) return null;
        entity.getRoomIds().add(roomId);
        chatFolderRepository.save(entity);
        return toMap(entity);
    }

    @Transactional
    public Map<String, Object> removeRoomFromFolder(Long folderId, String username, String roomId) {
        Optional<ChatFolderEntity> opt = chatFolderRepository.findById(folderId);
        if (opt.isEmpty()) return null;
        ChatFolderEntity entity = opt.get();
        if (!entity.getUsername().equals(username)) return null;
        entity.getRoomIds().remove(roomId);
        chatFolderRepository.save(entity);
        return toMap(entity);
    }

    private Map<String, Object> toMap(ChatFolderEntity entity) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", entity.getId());
        map.put("name", entity.getName());
        map.put("emoji", entity.getEmoji());
        map.put("sortOrder", entity.getSortOrder());
        map.put("roomIds", entity.getRoomIds());
        return map;
    }
}
