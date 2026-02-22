package com.example.webrtcchat.entity;

import com.example.webrtcchat.types.MessageType;
import jakarta.persistence.*;

@Entity
@Table(name = "messages", indexes = {
    @Index(name = "idx_messages_room_id", columnList = "roomId")
})
public class MessageEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(length = 50)
    private String sender;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String timestamp;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private MessageType type;

    @Column(length = 100)
    private String roomId;

    @Column(length = 500)
    private String fileUrl;

    private String fileName;

    private long fileSize;

    @Column(length = 100)
    private String fileType;

    @Column(length = 20)
    private String status;

    private boolean edited;

    private String scheduledAt;

    @Column(nullable = false)
    private boolean encrypted;

    @Column(name = "group_encrypted", nullable = false)
    private boolean groupEncrypted;

    @Column(name = "encrypted_content", columnDefinition = "TEXT")
    private String encryptedContent;

    @Column(length = 24)
    private String iv;

    @Column(name = "ratchet_key", columnDefinition = "TEXT")
    private String ratchetKey;

    @Column(name = "message_number")
    private Integer messageNumber;

    @Column(name = "previous_chain_length")
    private Integer previousChainLength;

    @Column(name = "ephemeral_key", columnDefinition = "TEXT")
    private String ephemeralKey;

    @Column(name = "sender_identity_key", columnDefinition = "TEXT")
    private String senderIdentityKey;

    @Column(name = "one_time_key_id")
    private Integer oneTimeKeyId;

    @Column(name = "reply_to_id", length = 36)
    private String replyToId;

    @Column(name = "reply_to_sender", length = 50)
    private String replyToSender;

    @Column(name = "reply_to_content", columnDefinition = "TEXT")
    private String replyToContent;

    @Column(columnDefinition = "TEXT")
    private String mentions;

    @Column
    private Integer duration;

    @Column(columnDefinition = "TEXT")
    private String waveform;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    @Column(name = "seq_id", insertable = false, updatable = false)
    private Long seqId;

    public MessageEntity() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

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

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isEdited() { return edited; }
    public void setEdited(boolean edited) { this.edited = edited; }

    public String getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(String scheduledAt) { this.scheduledAt = scheduledAt; }

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

    public Long getSeqId() { return seqId; }

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
}
