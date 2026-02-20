package com.example.webrtcchat.dto;

import com.example.webrtcchat.types.MessageType;

public class MessageDto {

    private String sender;
    private String content;
    private String timestamp;
    private MessageType type;
    private String roomId;

    public MessageDto() {}

    public MessageDto(String sender, String content, String timestamp, MessageType type) {
        this.sender = sender;
        this.content = content;
        this.timestamp = timestamp;
        this.type = type;
    }

    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public MessageType getType() { return type; }
    public void setType(MessageType type) { this.type = type; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
}