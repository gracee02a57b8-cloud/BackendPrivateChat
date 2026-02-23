import { useState, useEffect, useRef, useCallback } from 'react';
import EmojiPicker from './EmojiPicker';
import MentionDropdown from './MentionDropdown';
import VoiceRecorder from './VoiceRecorder';
import VoiceMessage from './VoiceMessage';
import VideoCircleRecorder from './VideoCircleRecorder';
import VideoCircleMessage from './VideoCircleMessage';
import e2eManager from '../crypto/E2EManager';
import useDecryptedUrl from '../hooks/useDecryptedUrl';
import { copyToClipboard } from '../utils/clipboard';
import { showToast } from './Toast';
import GroupInfoPanel from './GroupInfoPanel';

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
}

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;

function linkifyContent(text, onJoinRoom) {
  if (!text) return text;
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (URL_REGEX.lastIndex = 0, URL_REGEX.test(part)) {
      // Check if it's an in-app join link
      try {
        const url = new URL(part);
        const joinId = url.searchParams.get('join');
        if (joinId && url.origin === window.location.origin && onJoinRoom) {
          return (
            <a
              key={i}
              href={part}
              className="msg-link msg-link-join"
              onClick={(e) => { e.preventDefault(); onJoinRoom(joinId); }}
            >
              🔗 Присоединиться к группе
            </a>
          );
        }
      } catch (_) {}
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="msg-link">
          {part}
        </a>
      );
    }
    return part;
  });
}

const AVATAR_COLORS = [
  '#e94560', '#4ecca3', '#f0a500', '#a855f7',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
];

/** Small wrapper for images that may need E2E decryption */
function DecryptedImage({ fileUrl, fileKey, fileName, fileSize, formatFileSize }) {
  const url = useDecryptedUrl(fileUrl, fileKey, 'image/jpeg');
  return (
    <div className="file-attachment image-attachment">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={fileName || 'image'} />
        </a>
      ) : (
        <div style={{ padding: 16, opacity: 0.5 }}>🔓 Расшифровка...</div>
      )}
      <div className="file-info">
        <span className="file-name">{fileName}</span>
        <span className="file-size">{formatFileSize(fileSize)}</span>
      </div>
    </div>
  );
}

/** Wrapper for file downloads that may need E2E decryption */
function DecryptedFile({ fileUrl, fileKey, fileName, fileSize, formatFileSize }) {
  const url = useDecryptedUrl(fileUrl, fileKey, 'application/octet-stream');
  return (
    <div className="file-attachment">
      <a href={url ? `${url}${fileKey ? '' : '?download=true'}` : '#'} className="file-download" download={fileName}>
        <span className="file-icon">📎</span>
        <div className="file-info">
          <span className="file-name">{fileName}</span>
          <span className="file-size">{formatFileSize(fileSize)}</span>
        </div>
        <span className="download-icon">{url ? '⬇️' : '🔓'}</span>
      </a>
    </div>
  );
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  return name.charAt(0).toUpperCase();
}

function formatDateDivider(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseTimestamp(ts) {
  if (!ts) return null;
  // Handle "HH:mm:ss" format — assume today
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(ts)) {
    const today = new Date();
    return today.toDateString();
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.toDateString();
}

function formatLastSeenHeader(ts) {
  if (!ts) return '● не в сети';
  const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '● не в сети';
  const now = new Date();
  const diff = now - d;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (diff < 60000) return 'был(а) только что';
  if (diff < 3600000) return `был(а) ${Math.floor(diff / 60000)} мин. назад`;
  if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
    return `был(а) в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear()) {
    return `был(а) вчера в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diff < 7 * 86400000) {
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return `был(а) в ${days[d.getDay()]}`;
  }
  return `был(а) ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
}

export default function ChatRoom({ id, messages, onSendMessage, onEditMessage, onDeleteMessage, onScheduleMessage, scheduledMessages, roomName, username, connected, token, activeRoom, onlineUsers, allUsers = [], typingUsers = [], onTyping, isE2E, onShowSecurityCode, avatarMap = {}, onStartCall, callState, onLeaveRoom, onBack, onForwardToSaved, onJoinRoom }) {
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [dragging, setDragging] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [pinnedMsgId, setPinnedMsgId] = useState(null);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [reactions, setReactions] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const searchInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const isAtBottom = useRef(true);

  // Auto-scroll only if user is at bottom
  useEffect(() => {
    if (isAtBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgCount(0);
    } else if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender !== username) {
        setNewMsgCount((prev) => prev + 1);
      }
    }
  }, [messages]);

  // Scroll detection
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const threshold = 100;
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      isAtBottom.current = atBottom;
      setShowScrollBtn(!atBottom);
      if (atBottom) setNewMsgCount(0);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setInput('');
    setEditingMsg(null);
    setShowSchedule(false);
    setNewMsgCount(0);
    isAtBottom.current = true;
    setShowScrollBtn(false);
    setReplyingTo(null);
    setSelectionPopup(null);
    setMentionQuery(null);
    setShowGroupInfo(false);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchIndex(0);
  }, [roomName]);

  // Close context menu on any click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() && !uploading) return;

    if (editingMsg) {
      onEditMessage(editingMsg.id, input.trim());
      setEditingMsg(null);
      setInput('');
      resetTextarea();
      return;
    }

    if (showSchedule && scheduleDate) {
      onScheduleMessage(input.trim(), scheduleDate);
      setInput('');
      setShowSchedule(false);
      setScheduleDate('');
      resetTextarea();
      return;
    }

    if (input.trim()) {
      // Extract @mentions from text
      const mentionRegex = /@(\w+)/g;
      const mentionMatches = [...input.matchAll(mentionRegex)];
      const mentionedUsers = [...new Set(mentionMatches.map(m => m[1]).filter(u => onlineUsers?.includes(u)))];

      const replyData = replyingTo ? {
        replyToId: replyingTo.id,
        replyToSender: replyingTo.sender,
        replyToContent: replyingTo.content?.slice(0, 200) || '',
      } : null;

      const mentionsData = mentionedUsers.length > 0 ? JSON.stringify(mentionedUsers) : null;

      onSendMessage(input.trim(), null, replyData, mentionsData);
      setInput('');
      setReplyingTo(null);
      setMentionQuery(null);
      resetTextarea();
    }
    setShowEmoji(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    autoGrowTextarea(e.target);
    if (onTyping) onTyping();

    // Detect @mention
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const mentionMatch = textBefore.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const autoGrowTextarea = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const resetTextarea = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMsgCount(0);
  };

  // Drag & Drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        showToast('Файл слишком большой (макс. 100 МБ)', 'error');
        return;
      }
      uploadFile(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      showToast('Файл слишком большой (макс. 100 МБ)', 'error');
      e.target.value = '';
      return;
    }
    uploadFile(file);
    e.target.value = '';
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (file.size > 100 * 1024 * 1024) {
            showToast('Файл слишком большой (макс. 100 МБ)', 'error');
            return;
          }
          uploadFile(file);
        }
        return;
      }
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setUploadProgress(0);

    let uploadBlob = file;
    let fileKey = null;

    // Encrypt file for E2E private rooms
    if (isE2E) {
      try {
        const result = await e2eManager.encryptFile(file);
        uploadBlob = result.encryptedBlob;
        fileKey = result.fileKey;
      } catch (err) {
        console.warn('[E2E] File encrypt failed, uploading plaintext:', err);
      }
    }

    const formData = new FormData();
    formData.append('file', uploadBlob, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload/file');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      setUploadProgress(null);
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        const fileData = {
          fileUrl: data.url,
          fileName: data.originalName,
          fileSize: data.size,
          fileType: data.contentType,
        };
        if (fileKey) fileData.fileKey = fileKey;
        onSendMessage(input.trim() || '', fileData);
        setInput('');
      } else {
        showToast('Ошибка загрузки файла', 'error');
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress(null);
      showToast('Ошибка загрузки файла', 'error');
    };

    xhr.send(formData);
  };

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    if (el) {
      const start = el.selectionStart || input.length;
      const end = el.selectionEnd || input.length;
      const newVal = input.slice(0, start) + emoji + input.slice(end);
      setInput(newVal);
      setTimeout(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
        autoGrowTextarea(el);
      }, 0);
    } else {
      setInput(input + emoji);
    }
  };

  const copyMessage = (msg) => {
    copyToClipboard(msg.content || '');
    setContextMenu(null);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}?join=${activeRoom?.id || ''}`;
    copyToClipboard(url).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 1500);
    });
  };

  const handleContextMenu = (e, msg) => {
    if (msg.type === 'JOIN' || msg.type === 'LEAVE') return;
    e.preventDefault();

    // Position to the right of the message bubble
    const bubble = e.target.closest('.message-bubble') || e.target.closest('.message');
    const isOwn = msg.sender === username;
    let x, y;
    if (bubble) {
      const rect = bubble.getBoundingClientRect();
      x = isOwn ? rect.left - 10 : rect.right + 10;
      y = rect.top;
    } else {
      x = e.clientX;
      y = e.clientY;
    }

    // Clamp so menu doesn't overflow the viewport
    const menuW = 220, menuH = 340;
    if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 12;
    if (x < 8) x = 8;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 12;
    if (y < 8) y = 8;

    setContextMenu({ x, y, msg });
  };

  const handlePinMsg = (msg) => {
    setPinnedMsgId(prev => prev === msg.id ? null : msg.id);
    setContextMenu(null);
  };

  const handleForwardMsg = (msg) => {
    setContextMenu(null);
    // Copy text to input with a forward prefix
    const forwardText = `↪ ${msg.sender}: ${msg.content || ''}`;
    setInput(forwardText);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const QUICK_REACTIONS = ['❤️', '😆', '🐱', '😄', '🔥', '🎉', '🤝'];

  const handleQuickReaction = (msg, emoji) => {
    setContextMenu(null);
    // For now, reactions are visual-only (no backend persistence)
    // We'll add a reaction display on the message
    setReactions(prev => {
      const msgReactions = { ...(prev[msg.id] || {}) };
      const users = msgReactions[emoji] || [];
      if (users.includes(username)) {
        msgReactions[emoji] = users.filter(u => u !== username);
        if (msgReactions[emoji].length === 0) delete msgReactions[emoji];
      } else {
        msgReactions[emoji] = [...users, username];
      }
      return { ...prev, [msg.id]: msgReactions };
    });
  };

  const startEdit = (msg) => {
    setEditingMsg(msg);
    setInput(msg.content || '');
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setInput('');
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 2000);
    }
  };

  // ──── Search logic ────
  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      setSearchIndex(0);
      return;
    }
    const lower = q.toLowerCase();
    const results = messages.filter(
      m => m.content && m.type !== 'JOIN' && m.type !== 'LEAVE' && m.content.toLowerCase().includes(lower)
    );
    setSearchResults(results);
    setSearchIndex(results.length > 0 ? results.length - 1 : 0);
    if (results.length > 0) {
      scrollToMessage(results[results.length - 1].id);
    }
  };

  const searchPrev = () => {
    if (searchResults.length === 0) return;
    const newIdx = searchIndex > 0 ? searchIndex - 1 : searchResults.length - 1;
    setSearchIndex(newIdx);
    scrollToMessage(searchResults[newIdx].id);
  };

  const searchNext = () => {
    if (searchResults.length === 0) return;
    const newIdx = searchIndex < searchResults.length - 1 ? searchIndex + 1 : 0;
    setSearchIndex(newIdx);
    scrollToMessage(searchResults[newIdx].id);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchIndex(0);
  };

  const openSearch = () => {
    setShowSearch(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const startReply = (msg) => {
    setReplyingTo(msg);
    setEditingMsg(null);
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelectionPopup(null);
      return;
    }

    // Find the message bubble ancestor
    let node = sel.anchorNode;
    let msgEl = null;
    while (node && node !== document.body) {
      if (node.nodeType === 1 && node.dataset?.msgId) {
        msgEl = node;
        break;
      }
      node = node.parentElement;
    }
    if (!msgEl) { setSelectionPopup(null); return; }

    const msgId = msgEl.dataset.msgId;
    const msg = messages.find(m => m.id === msgId);
    if (!msg || msg.type !== 'CHAT') { setSelectionPopup(null); return; }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = messagesContainerRef.current?.getBoundingClientRect() || { top: 0, left: 0 };

    setSelectionPopup({
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top - 40,
      selectedText: sel.toString().trim(),
      msg,
    });
  }, [messages]);

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [handleTextSelection]);

  const replyToSelection = () => {
    if (!selectionPopup) return;
    setReplyingTo({
      ...selectionPopup.msg,
      content: selectionPopup.selectedText,
    });
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleMentionSelect = (user) => {
    if (!user) { setMentionQuery(null); return; }
    const el = inputRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart;
    const textBefore = input.slice(0, cursorPos);
    const atPos = textBefore.lastIndexOf('@');
    if (atPos === -1) return;
    const newVal = input.slice(0, atPos) + `@${user} ` + input.slice(cursorPos);
    setInput(newVal);
    setMentionQuery(null);
    setTimeout(() => {
      el.focus();
      const pos = atPos + user.length + 2;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleDeleteMsg = (msg) => {
    setContextMenu(null);
    setDeleteConfirm(msg);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      onDeleteMessage(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const getOtherUserInPM = () => {
    if (!activeRoom || activeRoom.type !== 'PRIVATE') return null;
    const parts = activeRoom.name.split(' & ');
    return parts.find((p) => p !== username) || null;
  };

  const getMessageClass = (msg) => {
    if (msg.type === 'JOIN' || msg.type === 'LEAVE') return 'message system';
    if (msg.sender === username) return 'message own';
    return 'message other';
  };

  const renderAttachment = (msg) => {
    if (!msg.fileUrl) return null;

    // Video circle message
    if (msg.type === 'VIDEO_CIRCLE') {
      return (
        <VideoCircleMessage
          fileUrl={msg.fileUrl}
          duration={msg.duration}
          thumbnailUrl={msg.thumbnailUrl}
          isOwn={msg.sender === username}
          fileKey={msg._fileKey}
          thumbnailKey={msg._thumbnailKey}
        />
      );
    }

    // Voice message
    const isVoice = msg.type === 'VOICE' || (msg.duration != null && msg.fileType?.startsWith('audio/'));
    if (isVoice) {
      return (
        <VoiceMessage
          fileUrl={msg.fileUrl}
          duration={msg.duration}
          waveformData={msg.waveform}
          isOwn={msg.sender === username}
          fileKey={msg._fileKey}
        />
      );
    }

    const isImage = msg.fileType && msg.fileType.startsWith('image/');
    if (isImage) {
      if (msg._fileKey) {
        return <DecryptedImage fileUrl={msg.fileUrl} fileKey={msg._fileKey} fileName={msg.fileName} fileSize={msg.fileSize} formatFileSize={formatFileSize} />;
      }
      return (
        <div className="file-attachment image-attachment">
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
            <img src={msg.fileUrl} alt={msg.fileName || 'image'} />
          </a>
          <div className="file-info">
            <span className="file-name">{msg.fileName}</span>
            <span className="file-size">{formatFileSize(msg.fileSize)}</span>
          </div>
        </div>
      );
    }
    if (msg._fileKey) {
      return <DecryptedFile fileUrl={msg.fileUrl} fileKey={msg._fileKey} fileName={msg.fileName} fileSize={msg.fileSize} formatFileSize={formatFileSize} />;
    }
    return (
      <div className="file-attachment">
        <a href={`${msg.fileUrl}?download=true`} className="file-download" download>
          <span className="file-icon">📎</span>
          <div className="file-info">
            <span className="file-name">{msg.fileName}</span>
            <span className="file-size">{formatFileSize(msg.fileSize)}</span>
          </div>
          <span className="download-icon">⬇️</span>
        </a>
      </div>
    );
  };

  return (
    <div
      id={id}
      className="chat-main"
      role="main"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {dragging && (
        <div className="drag-overlay">
          <div className="drag-overlay-content">
            <span className="drag-icon">📁</span>
            <span>Перетащите файл сюда</span>
          </div>
        </div>
      )}

      <div className="chat-header">
        {/* Back button (mobile) */}
        <button className="chat-header-back" onClick={onBack} aria-label="Назад">←</button>

        {/* Header avatar */}
        {activeRoom?.type === 'SAVED_MESSAGES' && (
          <div className="chat-header-avatar sb-saved-avatar">
            🔖
          </div>
        )}
        {activeRoom?.type === 'PRIVATE' && (() => {
          const otherUser = getOtherUserInPM();
          const av = avatarMap[otherUser];
          return (
            <div className="chat-header-avatar" style={{ background: av ? 'transparent' : getAvatarColor(otherUser || '') }}>
              {av ? <img src={av} alt="" className="chat-header-avatar-img" /> : getInitials(otherUser || '?')}
            </div>
          );
        })()}
        {activeRoom?.type === 'ROOM' && (
          <div className="chat-header-avatar group-avatar" style={{ background: getAvatarColor(roomName) }}>
            {getInitials(roomName)}
          </div>
        )}

        <div
          className={`chat-header-info${activeRoom?.type === 'ROOM' ? ' chat-header-clickable' : ''}`}
          onClick={activeRoom?.type === 'ROOM' ? () => setShowGroupInfo(true) : undefined}
        >
          <div className="chat-header-title-row">
            <h3>{roomName}</h3>
            {activeRoom?.type === 'ROOM' && <span className="chat-header-chevron">›</span>}
          </div>
          {activeRoom?.type === 'PRIVATE' && (() => {
            const otherUser = getOtherUserInPM();
            const isOnline = otherUser && onlineUsers?.includes(otherUser);
            if (isOnline) {
              return <span className="header-online-status online">● в сети</span>;
            }
            const userInfo = allUsers.find(u => u.username === otherUser);
            const lastSeen = userInfo?.lastSeen;
            return (
              <span className="header-online-status">
                {lastSeen ? formatLastSeenHeader(lastSeen) : '● не в сети'}
              </span>
            );
          })()}
          {activeRoom?.type === 'SAVED_MESSAGES' && (
            <span className="header-online-status">личное хранилище</span>
          )}
          {activeRoom?.type === 'ROOM' && (() => {
            const memberCount = activeRoom.members?.length || 0;
            const onlineCount = (activeRoom.members || []).filter(m => onlineUsers?.includes(m)).length;
            return (
              <span className="header-online-status">
                {memberCount} участн.{onlineCount > 0 ? `, ${onlineCount} в сети` : ''}
              </span>
            );
          })()}
        </div>
        <div className="chat-header-actions">
          {activeRoom?.type === 'PRIVATE' && onStartCall && (
            <button
              className="call-header-btn"
              onClick={() => onStartCall('audio')}
              disabled={callState !== 'idle' && callState !== undefined}
              title="Позвонить"
            >
              📞
            </button>
          )}
          <button className="search-header-btn" onClick={openSearch} title="Поиск по сообщениям">
            🔍
          </button>
          {isE2E && (
            <button className="e2e-badge" onClick={onShowSecurityCode} title="Сквозное шифрование — нажмите для проверки">
              🔒 E2E
            </button>
          )}
          <button className="copy-link-btn" onClick={handleCopyLink} title="Скопировать ссылку на чат">
            🔗 Поделиться
          </button>
          {copyToast && <span className="copy-toast">Ссылка скопирована!</span>}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="chat-search-bar">
          <input
            ref={searchInputRef}
            type="text"
            className="chat-search-input"
            placeholder="Поиск по сообщениям..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSearch();
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); searchNext(); }
              if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); searchPrev(); }
            }}
          />
          {searchQuery && (
            <span className="chat-search-count">
              {searchResults.length > 0 ? `${searchIndex + 1} из ${searchResults.length}` : 'Не найдено'}
            </span>
          )}
          <button className="search-nav-btn" onClick={searchPrev} disabled={searchResults.length === 0} title="Предыдущее">▲</button>
          <button className="search-nav-btn" onClick={searchNext} disabled={searchResults.length === 0} title="Следующее">▼</button>
          <button className="search-close-btn" onClick={closeSearch} title="Закрыть">✕</button>
        </div>
      )}

      <div className="messages" ref={messagesContainerRef}>
        {/* Pinned message banner */}
        {pinnedMsgId && (() => {
          const pinned = messages.find(m => m.id === pinnedMsgId);
          if (!pinned) return null;
          return (
            <div className="pinned-bar" onClick={() => scrollToMessage(pinnedMsgId)}>
              <span className="pinned-icon">📌</span>
              <div className="pinned-info">
                <span className="pinned-label">Закреплённое сообщение</span>
                <span className="pinned-text">{pinned.content?.slice(0, 60) || '📎 Файл'}</span>
              </div>
              <button className="pinned-close" onClick={(e) => { e.stopPropagation(); setPinnedMsgId(null); }}>✕</button>
            </div>
          );
        })()}
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-chat-content">
              <span className="empty-chat-icon">💬</span>
              <p>Нет сообщений</p>
              <span className="empty-chat-hint">Начните общение прямо сейчас!</span>
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          // Date separator
          let dateSep = null;
          if (i === 0 || (msg.timestamp && messages[i - 1]?.timestamp)) {
            const curDate = parseTimestamp(msg.timestamp);
            const prevDate = i > 0 ? parseTimestamp(messages[i - 1]?.timestamp) : null;
            if (curDate && curDate !== prevDate) {
              const label = formatDateDivider(curDate);
              if (label) dateSep = <div className="date-divider" key={`date-${i}`}><span>{label}</span></div>;
            }
          }

          // Group consecutive messages from same sender
          const prevMsg = messages[i - 1];
          const nextMsg = messages[i + 1];
          const isGrouped = prevMsg && prevMsg.sender === msg.sender
            && prevMsg.type !== 'JOIN' && prevMsg.type !== 'LEAVE'
            && msg.type !== 'JOIN' && msg.type !== 'LEAVE';

          // Is this the last message in a group from the same sender?
          const isLastInGroup = !nextMsg
            || nextMsg.sender !== msg.sender
            || nextMsg.type === 'JOIN' || nextMsg.type === 'LEAVE'
            || msg.type === 'JOIN' || msg.type === 'LEAVE';

          const isOwn = msg.sender === username;
          const isSys = msg.type === 'JOIN' || msg.type === 'LEAVE';

          // Build class: grouped middle/last for proper border-radius
          let msgClass = getMessageClass(msg);
          if (isGrouped && !isLastInGroup) msgClass += ' grouped middle';
          else if (isGrouped && isLastInGroup) msgClass += ' grouped last';
          else if (!isGrouped && !isLastInGroup) msgClass += ' first';

          const isSearchMatch = searchResults.some(r => r.id === msg.id);
          const isCurrentSearch = searchResults[searchIndex]?.id === msg.id;

          return (
            <div key={msg.id || i}>
              {dateSep}
              <div
                id={`msg-${msg.id}`}
                data-msg-id={msg.id}
                className={`${msgClass}${isSearchMatch ? ' search-match' : ''}${isCurrentSearch ? ' search-current' : ''}`}
                onContextMenu={(e) => handleContextMenu(e, msg)}
              >
                {isSys ? (
                  <span className="system-text">{msg.content}</span>
                ) : (
                  <div className="message-row">
                    {/* Avatar — shown on last message in group (Telegram-style) */}
                    {!isOwn && isLastInGroup && (
                      <div className="avatar-circle" style={{ background: avatarMap[msg.sender] ? 'transparent' : getAvatarColor(msg.sender) }}>
                        {avatarMap[msg.sender]
                          ? <img src={avatarMap[msg.sender]} alt="" className="avatar-img" />
                          : getInitials(msg.sender)}
                      </div>
                    )}
                    {!isOwn && !isLastInGroup && <div className="avatar-spacer" />}

                    <div className="message-bubble">

                      {/* Reply quote */}
                      {msg.replyToId && (
                        <div className="reply-quote" onClick={() => scrollToMessage(msg.replyToId)}>
                          <span className="reply-quote-sender">{msg.replyToSender}</span>
                          <span className="reply-quote-text">
                            {msg.replyToContent?.length > 100
                              ? msg.replyToContent.slice(0, 100) + '...'
                              : msg.replyToContent}
                          </span>
                        </div>
                      )}

                      {!isOwn && !isGrouped && (
                        <div className="message-sender" style={{ color: getAvatarColor(msg.sender) }}>
                          {msg.sender}
                        </div>
                      )}
                      {msg.content && (
                        <div className="message-body">
                          {linkifyContent(msg.content, onJoinRoom)}
                          <span className="msg-meta">
                            {msg.edited && <span className="edited-badge">ред. </span>}
                            {msg.timestamp}
                            {isOwn && (msg.type === 'CHAT' || msg.type === 'VOICE' || msg.type === 'VIDEO_CIRCLE') && (
                              <span className={`msg-check ${msg.status === 'READ' ? 'read' : ''}`}>
                                {msg.status === 'READ' ? ' ✓✓' : msg.status === 'DELIVERED' ? ' ✓✓' : ' ✓'}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {!msg.content && renderAttachment(msg)}
                      {msg.content && renderAttachment(msg)}
                      {/* Meta for file-only messages */}
                      {!msg.content && (
                        <span className="msg-meta standalone">
                          {msg.edited && <span className="edited-badge">ред. </span>}
                          {msg.timestamp}
                          {isOwn && (msg.type === 'CHAT' || msg.type === 'VOICE' || msg.type === 'VIDEO_CIRCLE') && (
                            <span className={`msg-check ${msg.status === 'READ' ? 'read' : ''}`}>
                              {msg.status === 'READ' ? ' ✓✓' : msg.status === 'DELIVERED' ? ' ✓✓' : ' ✓'}
                            </span>
                          )}
                        </span>
                      )}
                      {/* Reactions */}
                      {reactions[msg.id] && Object.keys(reactions[msg.id]).length > 0 && (
                        <div className="msg-reactions">
                          {Object.entries(reactions[msg.id]).map(([emoji, users]) => (
                            users.length > 0 && (
                              <button key={emoji}
                                className={`msg-react-chip${users.includes(username) ? ' own' : ''}`}
                                onClick={() => handleQuickReaction(msg, emoji)}
                                title={users.join(', ')}
                              >
                                {emoji} {users.length > 1 ? users.length : ''}
                              </button>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span><span></span><span></span>
            </div>
            <span className="typing-text">
              {typingUsers.length === 1
                ? `${typingUsers[0]} печатает`
                : typingUsers.length <= 3
                ? `${typingUsers.join(', ')} печатают`
                : 'Несколько человек печатают'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom */}
      {showScrollBtn && (
        <button className="scroll-to-bottom" onClick={scrollToBottom}>
          ↓ {newMsgCount > 0 && <span className="new-msg-badge">{newMsgCount}</span>}
        </button>
      )}

      {/* Context Menu — Telegram style */}
      {contextMenu && (
        <div className="ctx-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          {/* Emoji reaction row */}
          <div className="ctx-reactions">
            {QUICK_REACTIONS.map((emoji) => {
              const isActive = reactions[contextMenu.msg.id]?.[emoji]?.includes(username);
              return (
                <button key={emoji} className={`ctx-react-btn${isActive ? ' active' : ''}`}
                  onClick={() => handleQuickReaction(contextMenu.msg, emoji)}>{emoji}</button>
              );
            })}
          </div>
          {/* Menu items */}
          <div className="ctx-items">
            <button onClick={() => startReply(contextMenu.msg)}>
              <span className="ctx-icon">↩</span> Ответить
            </button>
            <button onClick={() => handlePinMsg(contextMenu.msg)}>
              <span className="ctx-icon">📌</span> {pinnedMsgId === contextMenu.msg.id ? 'Открепить' : 'Закрепить'}
            </button>
            <button onClick={() => copyMessage(contextMenu.msg)}>
              <span className="ctx-icon">📋</span> Копировать текст
            </button>
            <button onClick={() => handleForwardMsg(contextMenu.msg)}>
              <span className="ctx-icon">↪</span> Переслать
            </button>
            <button onClick={() => { setContextMenu(null); if (onForwardToSaved) onForwardToSaved(contextMenu.msg); }}>
              <span className="ctx-icon">🔖</span> В Избранное
            </button>
            {contextMenu.msg.sender === username && (
              <button onClick={() => startEdit(contextMenu.msg)}>
                <span className="ctx-icon">✏️</span> Редактировать
              </button>
            )}
            {contextMenu.msg.sender === username && (
              <button className="ctx-danger" onClick={() => handleDeleteMsg(contextMenu.msg)}>
                <span className="ctx-icon">🗑</span> Удалить
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selection Reply Popup */}
      {selectionPopup && (
        <div className="selection-popup" style={{ top: selectionPopup.y, left: selectionPopup.x }}>
          <button onClick={replyToSelection}>↩️ Ответить</button>
        </div>
      )}

      {/* Scheduled Messages Banner */}
      {scheduledMessages && scheduledMessages.length > 0 && (
        <div className="scheduled-banner">
          ⏰ Отложенных: {scheduledMessages.length}
        </div>
      )}

      {/* Edit Mode Banner */}
      {editingMsg && (
        <div className="edit-banner">
          <span>✏️ Редактирование: <em>{editingMsg.content?.slice(0, 40)}</em></span>
          <button onClick={cancelEdit}>✕</button>
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="reply-banner">
          <div className="reply-banner-content">
            <span className="reply-banner-icon">↩️</span>
            <div className="reply-banner-text">
              <span className="reply-banner-sender">{replyingTo.sender}</span>
              <span className="reply-banner-msg">{replyingTo.content?.slice(0, 60)}</span>
            </div>
          </div>
          <button onClick={cancelReply}>✕</button>
        </div>
      )}

      {uploading && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          <span className="upload-progress-text">Загрузка {uploadProgress}%</span>
        </div>
      )}

      <form className="message-form" onSubmit={handleSubmit}>
        {isRecording ? (
          <VoiceRecorder
            token={token}
            isE2E={isE2E}
            onSend={(voiceData) => {
              setIsRecording(false);
              onSendMessage('', voiceData);
            }}
            onCancel={() => setIsRecording(false)}
          />
        ) : isRecordingVideo ? (
          <VideoCircleRecorder
            token={token}
            isE2E={isE2E}
            onSend={(videoData) => {
              setIsRecordingVideo(false);
              onSendMessage('', videoData);
            }}
            onCancel={() => setIsRecordingVideo(false)}
          />
        ) : (
        <>
        <div className="input-wrapper">
          <button
            type="button"
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected || uploading || !!editingMsg}
            title="Прикрепить файл"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            hidden
          />
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={editingMsg ? 'Редактировать сообщение...' : 'Введите сообщение...'}
            disabled={!connected}
            rows={1}
            autoFocus
          />
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
          {mentionQuery !== null && (
            <MentionDropdown
              users={(onlineUsers || []).filter(u => u !== username)}
              filter={mentionQuery}
              onSelect={handleMentionSelect}
            />
          )}
        </div>
        {showSchedule && (
          <div className="schedule-picker">
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <span className="schedule-hint">Сообщение будет отправлено в указанное время</span>
          </div>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="action-btn emoji-btn"
            onClick={() => setShowEmoji(!showEmoji)}
            title="Эмодзи"
          >
            😊
          </button>
          <button
            type="button"
            className="action-btn schedule-btn"
            onClick={() => { setShowSchedule(!showSchedule); setEditingMsg(null); }}
            disabled={!connected || !!editingMsg}
            title="Отложить сообщение"
          >
            ⏰
          </button>
          {/* Show mic + video buttons when no text, send button when text exists — Telegram style */}
          {!input.trim() && !editingMsg && !showSchedule ? (
            <>
            <button
              type="button"
              className="action-btn mic-btn"
              onClick={() => setIsRecording(true)}
              disabled={!connected}
              title="Голосовое сообщение"
            >
              🎤
            </button>
            <button
              type="button"
              className="action-btn video-circle-btn"
              onClick={() => setIsRecordingVideo(true)}
              disabled={!connected}
              title="Видеокружок"
            >
              📹
            </button>
            </>
          ) : (
            <button type="submit" className="action-btn send-btn" disabled={!connected || (!input.trim() && !uploading)}>
              {editingMsg ? '✏️' : showSchedule && scheduleDate ? '⏰' : '➤'}
            </button>
          )}
        </div>
        </>
        )}
      </form>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="delete-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon">🗑</div>
            <h3>Удалить сообщение?</h3>
            <p className="delete-modal-preview">
              {deleteConfirm.content
                ? (deleteConfirm.content.length > 80
                    ? deleteConfirm.content.slice(0, 80) + '…'
                    : deleteConfirm.content)
                : '📎 Файл'}
            </p>
            <div className="delete-modal-actions">
              <button className="delete-modal-cancel" onClick={() => setDeleteConfirm(null)}>
                Отмена
              </button>
              <button className="delete-modal-confirm" onClick={confirmDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
      {showGroupInfo && activeRoom?.type === 'ROOM' && (
        <GroupInfoPanel
          room={activeRoom}
          username={username}
          allUsers={allUsers}
          onlineUsers={onlineUsers}
          avatarMap={avatarMap}
          token={token}
          onClose={() => setShowGroupInfo(false)}
          onLeaveRoom={onLeaveRoom}
        />
      )}
    </div>
  );
}
