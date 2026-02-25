import { useState, useEffect, useRef, useCallback } from 'react';
import EmojiPicker from './EmojiPicker';
import MentionDropdown from './MentionDropdown';
import VoiceRecorder from './VoiceRecorder';
import VoiceMessage from './VoiceMessage';
import VideoCircleRecorder from './VideoCircleRecorder';
import VideoCircleMessage from './VideoCircleMessage';
import UserProfilePage from './UserProfilePage';
import { copyToClipboard } from '../utils/clipboard';
import { hapticTap } from '../utils/capacitor';
import { showToast } from './Toast';
import GroupInfoPanel from './GroupInfoPanel';
import ForwardContactPicker from './ForwardContactPicker';
import { getAvatarColor, getInitials, formatLastSeen } from '../utils/avatar';
import { ArrowLeft, Bookmark, Phone, Search, Link, ChevronUp, ChevronDown, X, Pin, Paperclip, MessageSquare, Check, CheckCheck, Reply, Forward, Clipboard, Pencil, Trash2, Clock, Mic, Video, SendHorizontal, FolderOpen, Smile, Download, MoreVertical, Plus, Timer, CheckSquare } from 'lucide-react';

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
}

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;

function linkifyContent(text, onJoinRoom, onJoinConference) {
  if (!text) return text;
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (URL_REGEX.lastIndex = 0, URL_REGEX.test(part)) {
      // Check if it's an in-app join or conference link
      try {
        const url = new URL(part);
        const joinId = url.searchParams.get('join');
        const confId = url.searchParams.get('conf');
        if (joinId && url.origin === window.location.origin && onJoinRoom) {
          return (
            <a
              key={i}
              href={part}
              className="msg-link msg-link-join"
              onClick={(e) => { e.preventDefault(); onJoinRoom(joinId); }}
            >
              <Link size={14} /> Присоединиться к группе
            </a>
          );
        }
        if (confId && url.origin === window.location.origin && onJoinConference) {
          return (
            <a
              key={i}
              href={part}
              className="msg-link msg-link-join"
              onClick={(e) => { e.preventDefault(); onJoinConference(confId); }}
            >
              <Phone size={14} /> Присоединиться к конференции
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

const formatLastSeenHeader = formatLastSeen;

/** Call log bubble displayed in chat history */
function CallLogBubble({ msg, username }) {
  const extra = msg.extra || {};
  const status = extra.status || 'completed';
  const callType = extra.callType || 'audio';
  const duration = parseInt(extra.duration || '0', 10);
  const caller = extra.caller || msg.sender;
  const isOutgoing = caller === username;

  const getIcon = () => {
    if (status === 'completed') return isOutgoing ? '↗' : '↙';
    if (status === 'missed' || status === 'unavailable') return '✖';
    if (status === 'rejected') return '✖';
    if (status === 'busy') return '⏳';
    return '📞';
  };

  const getLabel = () => {
    const typeLabel = callType === 'video' ? 'Видеозвонок' : 'Звонок';
    if (status === 'completed') {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const dur = mins > 0 ? `${mins} мин ${secs.toString().padStart(2, '0')} сек` : `${secs} сек`;
      return `${isOutgoing ? 'Исходящий' : 'Входящий'} ${typeLabel.toLowerCase()} · ${dur}`;
    }
    if (status === 'missed') return `Пропущенный ${typeLabel.toLowerCase()}`;
    if (status === 'rejected') return `Отклонённый ${typeLabel.toLowerCase()}`;
    if (status === 'busy') return 'Абонент занят';
    if (status === 'unavailable') return 'Абонент не в сети';
    return typeLabel;
  };

  const isMissed = status === 'missed' || status === 'unavailable' || status === 'rejected';

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  return (
    <div className={`call-log-bubble${isMissed ? ' missed' : ''}`}>
      <span className="call-log-icon">{getIcon()}</span>
      <div className="call-log-info">
        <span className="call-log-label">{getLabel()}</span>
        <span className="call-log-time">{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  );
}

export default function ChatRoom({ id, messages, onSendMessage, onEditMessage, onDeleteMessage, onScheduleMessage, scheduledMessages, roomName, username, connected, token, activeRoom, onlineUsers, allUsers = [], typingUsers = [], onTyping, avatarMap = {}, onStartCall, callState, onLeaveRoom, onBack, onForwardToSaved, onForwardToContacts, onJoinRoom, onJoinConference, showAddMembers, onAddMembers, onDismissAddMembers, onStartPrivateChat, rooms = [], disappearingTimer, onSetDisappearingTimer }) {
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
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardMessages, setForwardMessages] = useState([]);
  const [showDisappearingPicker, setShowDisappearingPicker] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const searchInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const headerMenuRef = useRef(null);
  const plusMenuRef = useRef(null);
  const dragCounter = useRef(0);
  const isAtBottom = useRef(true);

  // Auto-scroll to latest message only when user is at bottom (Telegram-style)
  useEffect(() => {
    if (isAtBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgCount(0);
    } else if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === username) {
        // Always scroll to own sent messages
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        isAtBottom.current = true;
        setNewMsgCount(0);
      } else {
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
    setMultiSelectMode(false);
    setSelectedMsgIds(new Set());
    setShowForwardPicker(false);
    setForwardMessages([]);
    setSearchQuery('');
    setSearchResults([]);
    setSearchIndex(0);
    // Scroll to bottom instantly when entering a chat
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }, 50);
  }, [roomName]);

  // Close context menu on any click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // Close header overflow menu on click outside
  useEffect(() => {
    if (!showHeaderMenu) return;
    const close = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) setShowHeaderMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [showHeaderMenu]);

  // Close plus attach menu on click outside
  useEffect(() => {
    if (!showPlusMenu) return;
    const close = (e) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) setShowPlusMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [showPlusMenu]);

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

    const formData = new FormData();
    formData.append('file', file, file.name);

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

    // Haptic feedback on mobile
    hapticTap();

    const isMobile = window.innerWidth <= 768;
    let x = 0, y = 0;

    if (!isMobile) {
      // Position to the right of the message bubble (desktop only)
      const bubble = e.target.closest('.message-bubble') || e.target.closest('.message');
      const isOwn = msg.sender === username;
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
    }

    setContextMenu({ x, y, msg });
  };

  const handlePinMsg = (msg) => {
    setPinnedMsgId(prev => prev === msg.id ? null : msg.id);
    setContextMenu(null);
  };

  const handleForwardMsg = (msg) => {
    setContextMenu(null);
    setForwardMessages([msg]);
    setShowForwardPicker(true);
  };

  // Multi-select helpers
  const toggleMsgSelection = (msgId) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const enterMultiSelect = (msg) => {
    setContextMenu(null);
    setMultiSelectMode(true);
    setSelectedMsgIds(new Set([msg.id]));
  };

  const exitMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedMsgIds(new Set());
  };

  const forwardSelected = () => {
    const msgs = messages.filter(m => selectedMsgIds.has(m.id));
    if (msgs.length === 0) return;
    setForwardMessages(msgs);
    setShowForwardPicker(true);
  };

  const handleForwardToContacts = (targets) => {
    if (onForwardToContacts && forwardMessages.length > 0) {
      onForwardToContacts(forwardMessages, targets);
    }
    setForwardMessages([]);
    setShowForwardPicker(false);
    exitMultiSelect();
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
        />
      );
    }

    const isImage = msg.fileType && msg.fileType.startsWith('image/');
    if (isImage) {
      return (
        <div className="file-attachment image-attachment">
          <img
            src={msg.fileUrl}
            alt={msg.fileName || 'image'}
            loading="lazy"
            decoding="async"
            style={{ cursor: 'zoom-in' }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxImage({ url: msg.fileUrl, name: msg.fileName }); }}
          />
          <div className="file-info">
            <span className="file-name">{msg.fileName}</span>
            <span className="file-size">{formatFileSize(msg.fileSize)}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="file-attachment">
        <a href={`${msg.fileUrl}?download=true`} className="file-download" download>
          <span className="file-icon"><Paperclip size={16} /></span>
          <div className="file-info">
            <span className="file-name">{msg.fileName}</span>
            <span className="file-size">{formatFileSize(msg.fileSize)}</span>
          </div>
          <span className="download-icon"><Download size={16} /></span>
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
            <span className="drag-icon"><FolderOpen size={40} /></span>
            <span>Перетащите файл сюда</span>
          </div>
        </div>
      )}

      <div className="chat-header" data-testid="chat-header">
        {/* Back button (mobile) */}
        <button className="chat-header-back" data-testid="chat-header-back" onClick={onBack} aria-label="Назад"><ArrowLeft size={20} /></button>

        {/* Header avatar with online dot */}
        {activeRoom?.type === 'SAVED_MESSAGES' && (
          <div className="chat-header-avatar sb-saved-avatar">
            <Bookmark size={20} />
          </div>
        )}
        {activeRoom?.type === 'PRIVATE' && (() => {
          const otherUser = getOtherUserInPM();
          const av = avatarMap[otherUser];
          const isOnlineNow = otherUser && onlineUsers?.includes(otherUser);
          return (
            <div className="chat-header-avatar-wrap" onClick={() => setShowUserProfile(true)}>
              <div className="chat-header-avatar chat-header-clickable" style={{ background: av ? 'transparent' : getAvatarColor(otherUser || '') }}>
                {av ? <img src={av} alt="" className="chat-header-avatar-img" decoding="async" /> : getInitials(otherUser || '?')}
              </div>
              {isOnlineNow && <span className="chat-header-online-dot" />}
            </div>
          );
        })()}
        {activeRoom?.type === 'ROOM' && (
          <div className="chat-header-avatar group-avatar" style={{ background: getAvatarColor(roomName) }}>
            {getInitials(roomName)}
          </div>
        )}

        <div
          className={`chat-header-info${(activeRoom?.type === 'ROOM' || activeRoom?.type === 'PRIVATE') ? ' chat-header-clickable' : ''}`}
          onClick={activeRoom?.type === 'ROOM' ? () => setShowGroupInfo(true) : activeRoom?.type === 'PRIVATE' ? () => setShowUserProfile(true) : undefined}
        >
          <div className="chat-header-title-row">
            <h3>{roomName}</h3>
            {(activeRoom?.type === 'ROOM' || activeRoom?.type === 'PRIVATE') && <span className="chat-header-chevron">›</span>}
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
              aria-label="Позвонить"
            >
              <Phone size={18} />
            </button>
          )}
          <div className="chat-header-menu-wrap" ref={headerMenuRef}>
            <button className="chat-header-dots-btn" data-testid="chat-header-dots" onClick={() => setShowHeaderMenu(!showHeaderMenu)} aria-label="Ещё">
              <MoreVertical size={20} />
            </button>
            {showHeaderMenu && (
              <div className="chat-header-dropdown">
                <button onClick={() => { openSearch(); setShowHeaderMenu(false); }}>
                  <Search size={16} /> Поиск
                </button>
                <button onClick={() => { handleCopyLink(); setShowHeaderMenu(false); }}>
                  <Link size={16} /> Поделиться
                </button>
                {activeRoom?.type !== 'SAVED_MESSAGES' && (
                  <button onClick={() => { setShowDisappearingPicker(true); setShowHeaderMenu(false); }}>
                    <Timer size={16} /> Исчезающие сообщения
                  </button>
                )}
                <button onClick={() => { setMultiSelectMode(true); setShowHeaderMenu(false); }}>
                  <CheckSquare size={16} /> Выбрать сообщения
                </button>
              </div>
            )}
          </div>
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
          <button className="search-nav-btn" onClick={searchPrev} disabled={searchResults.length === 0} title="Предыдущее"><ChevronUp size={16} /></button>
          <button className="search-nav-btn" onClick={searchNext} disabled={searchResults.length === 0} title="Следующее"><ChevronDown size={16} /></button>
          <button className="search-close-btn" onClick={closeSearch} title="Закрыть"><X size={16} /></button>
        </div>
      )}

      {/* Add members banner for newly created groups */}
      {showAddMembers && activeRoom?.type === 'ROOM' && (
        <div className="add-members-banner">
          <span className="add-members-text" onClick={onAddMembers}>Добавить участников</span>
          <button className="add-members-close" onClick={onDismissAddMembers}><X size={16} /></button>
        </div>
      )}

      {/* Disappearing messages banner */}
      {disappearingTimer > 0 && (
        <div className="disappearing-banner">
          <Timer size={14} />
          Исчезающие сообщения: {disappearingTimer >= 86400 ? `${disappearingTimer / 86400} д.` : disappearingTimer >= 3600 ? `${disappearingTimer / 3600} ч.` : disappearingTimer >= 60 ? `${disappearingTimer / 60} мин.` : `${disappearingTimer} сек.`}
        </div>
      )}

      {/* Multi-select bar */}
      {multiSelectMode && (
        <div className="multi-select-bar">
          <span className="msel-count">Выбрано: {selectedMsgIds.size}</span>
          <button onClick={exitMultiSelect}><X size={16} /> Отмена</button>
          <button className="msel-forward" onClick={forwardSelected} disabled={selectedMsgIds.size === 0}>
            <Forward size={16} /> Переслать
          </button>
        </div>
      )}

      <div className="messages" ref={messagesContainerRef}>
        {/* Pinned message banner */}
        {pinnedMsgId && (() => {
          const pinned = messages.find(m => m.id === pinnedMsgId);
          if (!pinned) return null;
          return (
            <div className="pinned-bar" onClick={() => scrollToMessage(pinnedMsgId)}>
              <span className="pinned-icon"><Pin size={14} /></span>
              <div className="pinned-info">
                <span className="pinned-label">Закреплённое сообщение</span>
                <span className="pinned-text">{pinned.content?.slice(0, 60) || 'Файл'}</span>
              </div>
              <button className="pinned-close" onClick={(e) => { e.stopPropagation(); setPinnedMsgId(null); }}><X size={14} /></button>
            </div>
          );
        })()}
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-chat-content">
              <span className="empty-chat-icon" style={{ fontSize: '3rem' }}>💬</span>
              <p>Нет сообщений</p>
              <span className="empty-chat-hint">Напишите первое сообщение — начните общение!</span>
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
            && prevMsg.type !== 'JOIN' && prevMsg.type !== 'LEAVE' && prevMsg.type !== 'CALL_LOG'
            && msg.type !== 'JOIN' && msg.type !== 'LEAVE' && msg.type !== 'CALL_LOG';

          // Is this the last message in a group from the same sender?
          const isLastInGroup = !nextMsg
            || nextMsg.sender !== msg.sender
            || nextMsg.type === 'JOIN' || nextMsg.type === 'LEAVE' || nextMsg.type === 'CALL_LOG'
            || msg.type === 'JOIN' || msg.type === 'LEAVE' || msg.type === 'CALL_LOG';

          const isOwn = msg.sender === username;
          const isSys = msg.type === 'JOIN' || msg.type === 'LEAVE';
          const isCallLog = msg.type === 'CALL_LOG';

          // Build class: grouped middle/last for proper border-radius
          let msgClass = isCallLog ? 'message system call-log-msg' : getMessageClass(msg);
          if (isGrouped && !isLastInGroup) msgClass += ' grouped middle';
          else if (isGrouped && isLastInGroup) msgClass += ' grouped last';
          else if (!isGrouped && !isLastInGroup) msgClass += ' first';

          const isSearchMatch = searchResults.some(r => r.id === msg.id);
          const isCurrentSearch = searchResults[searchIndex]?.id === msg.id;
          const isMsgSelected = multiSelectMode && selectedMsgIds.has(msg.id);

          return (
            <div key={msg.id || i}>
              {dateSep}
              <div
                id={`msg-${msg.id}`}
                data-msg-id={msg.id}
                className={`${msgClass}${isSearchMatch ? ' search-match' : ''}${isCurrentSearch ? ' search-current' : ''}${multiSelectMode ? ' multi-select-mode' : ''}${isMsgSelected ? ' selected-msg' : ''}`}
                onContextMenu={(e) => !multiSelectMode && handleContextMenu(e, msg)}
                onClick={multiSelectMode && !isSys && !isCallLog ? () => toggleMsgSelection(msg.id) : undefined}
              >
                {/* Multi-select checkbox */}
                {multiSelectMode && !isSys && !isCallLog && (
                  <div className={`msg-select-check${isMsgSelected ? ' on' : ''}`} style={{ display: 'flex' }}>
                    {isMsgSelected && <Check size={13} />}
                  </div>
                )}
                {isSys ? (
                  <span className="system-text">{msg.content}</span>
                ) : isCallLog ? (
                  <CallLogBubble msg={msg} username={username} />
                ) : (
                  <div className="message-row">
                    {/* Avatar — shown on last message in group (Telegram-style) */}
                    {!isOwn && isLastInGroup && (
                      <div className="avatar-circle" style={{ background: avatarMap[msg.sender] ? 'transparent' : getAvatarColor(msg.sender) }}>
                        {avatarMap[msg.sender]
                          ? <img src={avatarMap[msg.sender]} alt="" className="avatar-img" decoding="async" />
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
                          {linkifyContent(msg.content, onJoinRoom, onJoinConference)}
                          <span className="msg-meta">
                            {msg.edited && <span className="edited-badge">ред. </span>}
                            {disappearingTimer > 0 && <span className="disappearing-badge"><Timer size={10} /></span>}
                            {msg.timestamp}
                            {isOwn && (msg.type === 'CHAT' || msg.type === 'VOICE' || msg.type === 'VIDEO_CIRCLE') && (
                              <span className={`msg-check ${msg.status === 'READ' ? 'read' : msg.status === 'DELIVERED' ? 'delivered' : ''}`} aria-label={msg.status === 'READ' ? 'Прочитано' : msg.status === 'DELIVERED' ? 'Доставлено' : 'Отправлено'}>
                                {msg.status === 'READ' ? <CheckCheck size={14} /> : msg.status === 'DELIVERED' ? <CheckCheck size={14} /> : <Check size={14} />}
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
                          {disappearingTimer > 0 && <span className="disappearing-badge"><Timer size={10} /></span>}
                          {msg.timestamp}
                          {isOwn && (msg.type === 'CHAT' || msg.type === 'VOICE' || msg.type === 'VIDEO_CIRCLE') && (
                            <span className={`msg-check ${msg.status === 'READ' ? 'read' : msg.status === 'DELIVERED' ? 'delivered' : ''}`} aria-label={msg.status === 'READ' ? 'Прочитано' : msg.status === 'DELIVERED' ? 'Доставлено' : 'Отправлено'}>
                              {msg.status === 'READ' ? <CheckCheck size={14} /> : msg.status === 'DELIVERED' ? <CheckCheck size={14} /> : <Check size={14} />}
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
        <button className="scroll-to-bottom" data-testid="scroll-to-bottom" onClick={scrollToBottom} aria-label="Прокрутить вниз">
          <ChevronDown size={18} /> {newMsgCount > 0 && <span className="new-msg-badge">{newMsgCount}</span>}
        </button>
      )}

      {/* Context Menu — Telegram style */}
      {contextMenu && (
        <>
          <div className="ctx-overlay" onClick={() => setContextMenu(null)} />
          <div className="ctx-menu" style={window.innerWidth > 768 ? { top: contextMenu.y, left: contextMenu.x } : undefined} onClick={(e) => e.stopPropagation()}>
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
                <span className="ctx-icon"><Reply size={16} /></span> Ответить
              </button>
              <button onClick={() => handlePinMsg(contextMenu.msg)}>
                <span className="ctx-icon"><Pin size={16} /></span> {pinnedMsgId === contextMenu.msg.id ? 'Открепить' : 'Закрепить'}
              </button>
              <button onClick={() => copyMessage(contextMenu.msg)}>
                <span className="ctx-icon"><Clipboard size={16} /></span> Копировать текст
              </button>
              <button onClick={() => handleForwardMsg(contextMenu.msg)}>
                <span className="ctx-icon"><Forward size={16} /></span> Переслать
              </button>
              <button onClick={() => enterMultiSelect(contextMenu.msg)}>
                <span className="ctx-icon"><CheckSquare size={16} /></span> Выбрать
              </button>
              <button onClick={() => { setContextMenu(null); if (onForwardToSaved) onForwardToSaved(contextMenu.msg); }}>
                <span className="ctx-icon"><Bookmark size={16} /></span> В Избранное
              </button>
              {contextMenu.msg.sender === username && (
                <button onClick={() => startEdit(contextMenu.msg)}>
                  <span className="ctx-icon"><Pencil size={16} /></span> Редактировать
                </button>
              )}
              {contextMenu.msg.sender === username && (
                <button className="ctx-danger" onClick={() => handleDeleteMsg(contextMenu.msg)}>
                  <span className="ctx-icon"><Trash2 size={16} /></span> Удалить
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Selection Reply Popup */}
      {selectionPopup && (
        <div className="selection-popup" style={{ top: selectionPopup.y, left: selectionPopup.x }}>
          <button onClick={replyToSelection}><Reply size={14} /> Ответить</button>
        </div>
      )}

      {/* Scheduled Messages Banner */}
      {scheduledMessages && scheduledMessages.length > 0 && (
        <div className="scheduled-banner">
          <Clock size={14} /> Отложенных: {scheduledMessages.length}
        </div>
      )}

      {/* Edit Mode Banner */}
      {editingMsg && (
        <div className="edit-banner">
          <span><Pencil size={14} /> Редактирование: <em>{editingMsg.content?.slice(0, 40)}</em></span>
          <button onClick={cancelEdit}><X size={16} /></button>
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="reply-banner">
          <div className="reply-banner-content">
            <span className="reply-banner-icon"><Reply size={14} /></span>
            <div className="reply-banner-text">
              <span className="reply-banner-sender">{replyingTo.sender}</span>
              <span className="reply-banner-msg">{replyingTo.content?.slice(0, 60)}</span>
            </div>
          </div>
          <button onClick={cancelReply}><X size={16} /></button>
        </div>
      )}

      {uploading && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          <span className="upload-progress-text">Загрузка {uploadProgress}%</span>
        </div>
      )}

      <form className="message-form" data-testid="message-form" onSubmit={handleSubmit}>
        {isRecording ? (
          <VoiceRecorder
            token={token}
            onSend={(voiceData) => {
              setIsRecording(false);
              onSendMessage('', voiceData);
            }}
            onCancel={() => setIsRecording(false)}
          />
        ) : isRecordingVideo ? (
          <VideoCircleRecorder
            token={token}
            onSend={(videoData) => {
              setIsRecordingVideo(false);
              onSendMessage('', videoData);
            }}
            onCancel={() => setIsRecordingVideo(false)}
          />
        ) : (
        <>
        <div className="input-wrapper">
          <div className="plus-menu-wrap" ref={plusMenuRef}>
            <button
              type="button"
              className="attach-btn"
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              disabled={!connected || uploading || !!editingMsg}
              title="Прикрепить"
              aria-label="Прикрепить файл"
            >
              <Plus size={22} className={showPlusMenu ? 'rotate-45' : ''} />
            </button>
            {showPlusMenu && (
              <div className="plus-menu-dropdown">
                <button type="button" onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}>
                  <Paperclip size={18} /> Файл
                </button>
                <button type="button" onClick={() => { setShowSchedule(!showSchedule); setEditingMsg(null); setShowPlusMenu(false); }}>
                  <Clock size={18} /> Отложить
                </button>
              </div>
            )}
          </div>
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
            autoFocus={window.innerWidth > 768}
            aria-label={editingMsg ? 'Редактировать сообщение' : 'Введите сообщение'}
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
              aria-label="Дата и время отложенной отправки"
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
            aria-label="Эмодзи"
          >
            <Smile size={20} />
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
              aria-label="Голосовое сообщение"
            >
              <Mic size={20} />
            </button>
            <button
              type="button"
              className="action-btn video-circle-btn"
              onClick={() => setIsRecordingVideo(true)}
              disabled={!connected}
              title="Видеокружок"
              aria-label="Видеокружок"
            >
              <Video size={20} />
            </button>
            </>
          ) : (
            <button type="submit" className="action-btn send-btn" data-testid="send-btn" disabled={!connected || (!input.trim() && !uploading)} aria-label="Отправить">
              {editingMsg ? <Pencil size={20} /> : showSchedule && scheduleDate ? <Clock size={20} /> : <SendHorizontal size={20} />}
            </button>
          )}
        </div>
        <div className="send-shortcut-hint">Ctrl + Enter — отправить</div>
        </>
        )}
      </form>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="delete-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon"><Trash2 size={32} /></div>
            <h3>Удалить сообщение?</h3>
            <p className="delete-modal-preview">
              {deleteConfirm.content
                ? (deleteConfirm.content.length > 80
                    ? deleteConfirm.content.slice(0, 80) + '…'
                    : deleteConfirm.content)
                : 'Файл'}
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
      {showUserProfile && activeRoom?.type === 'PRIVATE' && (
        <div className="user-profile-overlay">
          <UserProfilePage
            targetUsername={getOtherUserInPM()}
            token={token}
            onBack={() => setShowUserProfile(false)}
            onStartChat={onStartPrivateChat}
            onStartCall={(peer, type) => { setShowUserProfile(false); if (onStartCall) onStartCall(type); }}
            onDeleteChat={() => { if (onLeaveRoom) onLeaveRoom(activeRoom.id); }}
            onlineUsers={onlineUsers}
            avatarMap={avatarMap}
          />
        </div>
      )}

      {/* Forward Contact Picker */}
      {showForwardPicker && (
        <ForwardContactPicker
          rooms={rooms}
          allUsers={allUsers}
          username={username}
          avatarMap={avatarMap}
          onlineUsers={onlineUsers}
          onForward={handleForwardToContacts}
          onClose={() => { setShowForwardPicker(false); setForwardMessages([]); }}
          messagesToForward={forwardMessages}
        />
      )}

      {/* Disappearing Messages Picker */}
      {showDisappearingPicker && (
        <div className="disappearing-picker-overlay" onClick={() => setShowDisappearingPicker(false)}>
          <div className="disappearing-picker" onClick={e => e.stopPropagation()}>
            <div className="disappearing-picker-header">
              <h3>Исчезающие сообщения</h3>
              <p>Сообщения будут автоматически удалены через выбранное время после отправки.</p>
            </div>
            <div className="disappearing-options">
              {[
                { value: 0, label: 'Выключено' },
                { value: 30, label: '30 секунд' },
                { value: 300, label: '5 минут' },
                { value: 3600, label: '1 час' },
                { value: 86400, label: '1 день' },
                { value: 604800, label: '1 неделя' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`disappearing-option${(disappearingTimer || 0) === opt.value ? ' active' : ''}`}
                  onClick={() => {
                    if (onSetDisappearingTimer) onSetDisappearingTimer(opt.value);
                    setShowDisappearingPicker(false);
                  }}
                >
                  <span className="disopt-radio" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxImage(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setLightboxImage(null); }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр изображения"
        >
          <img src={lightboxImage.url} alt={lightboxImage.name || 'image'} onClick={e => e.stopPropagation()} />
          <button className="lightbox-close" onClick={() => setLightboxImage(null)} aria-label="Закрыть">
            <X size={22} />
          </button>
          {lightboxImage.name && <span className="lightbox-filename">{lightboxImage.name}</span>}
        </div>
      )}
    </div>
  );
}
