package com.example.webrtcchat.dto;

import com.example.webrtcchat.types.MessageType;

import java.util.Map;

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
    private Map<String, String> extra;

    // Poll data (enriched for POLL type messages)
    private Map<String, Object> pollData;

    // Reply fields
    private String replyToId;
    private String replyToSender;
    private String replyToContent;

    // Mentions (JSON array of usernames)
    private String mentions;

    // Voice message fields
    private Integer duration;
    private String waveform;

    // Video circle fields
    private String thumbnailUrl;

    // E2E encryption fields
    private boolean encrypted;
    private boolean groupEncrypted;
    private String encryptedContent;
    private String iv;
    private String ratchetKey;
    private Integer messageNumber;
    private Integer previousChainLength;
    private String ephemeralKey;
    private String senderIdentityKey;
    private Integer oneTimeKeyId;

    // Pin fields
    private boolean pinned;
    private String pinnedBy;

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

    public Map<String, String> getExtra() { return extra; }
    public void setExtra(Map<String, String> extra) { this.extra = extra; }

    public boolean isEncrypted() { return encrypted; }
    public void setEncrypted(boolean encrypted) { this.encrypted = encrypted; }

    public boolean isGroupEncrypted() { return groupEncrypted; }
    public void setGroupEncrypted(boolean groupEncrypted) { this.groupEncrypted = groupEncrypted; }

    public String getEncryptedContent() { return encryptedContent; }
    public void setEncryptedContent(String encryptedContent) { this.encryptedContent = encryptedContent; }

    public String getIv() { return iv; }
    public void setIv(String iv) { this.iv = iv; }

    public String getRatchetKey() { return ratchetKey; }
    public void setRatchetKey(String ratchetKey) { this.ratchetKey = ratchetKey; }

    public Integer getMessageNumber() { return messageNumber; }
    public void setMessageNumber(Integer messageNumber) { this.messageNumber = messageNumber; }

    public Integer getPreviousChainLength() { return previousChainLength; }
    public void setPreviousChainLength(Integer previousChainLength) { this.previousChainLength = previousChainLength; }

    public String getEphemeralKey() { return ephemeralKey; }
    public void setEphemeralKey(String ephemeralKey) { this.ephemeralKey = ephemeralKey; }

    public String getSenderIdentityKey() { return senderIdentityKey; }
    public void setSenderIdentityKey(String senderIdentityKey) { this.senderIdentityKey = senderIdentityKey; }

    public Integer getOneTimeKeyId() { return oneTimeKeyId; }
    public void setOneTimeKeyId(Integer oneTimeKeyId) { this.oneTimeKeyId = oneTimeKeyId; }

    public String getReplyToId() { return replyToId; }
    public void setReplyToId(String replyToId) { this.replyToId = replyToId; }

    public String getReplyToSender() { return replyToSender; }
    public void setReplyToSender(String replyToSender) { this.replyToSender = replyToSender; }

    public String getReplyToContent() { return replyToContent; }
    public void setReplyToContent(String replyToContent) { this.replyToContent = replyToContent; }

    public String getMentions() { return mentions; }
    public void setMentions(String mentions) { this.mentions = mentions; }

    public Integer getDuration() { return duration; }
    public void setDuration(Integer duration) { this.duration = duration; }

    public String getWaveform() { return waveform; }
    public void setWaveform(String waveform) { this.waveform = waveform; }

    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }

    public boolean isPinned() { return pinned; }
    public void setPinned(boolean pinned) { this.pinned = pinned; }

    public String getPinnedBy() { return pinnedBy; }
    public void setPinnedBy(String pinnedBy) { this.pinnedBy = pinnedBy; }

    public Map<String, Object> getPollData() { return pollData; }
    public void setPollData(Map<String, Object> pollData) { this.pollData = pollData; }
}