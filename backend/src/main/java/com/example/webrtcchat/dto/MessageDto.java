package com.example.webrtcchat.dto;

import com.example.webrtcchat.types.MessageType;

public class MessageDto {

    private String sender;
    private String content;
    private String timestamp;
    private MessageType type;
    private String roomId;
    private String fileUrl;
    private String fileName;
    private long fileSize;
    private String fileType;
    private String id;
    private String status;
    private boolean edited;
    private String scheduledAt;

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

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isEdited() { return edited; }
    public void setEdited(boolean edited) { this.edited = edited; }

    public String getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(String scheduledAt) { this.scheduledAt = scheduledAt; }
}