// ═══════════════════════════════════════════════
//  Message Input — Telegram-style compose bar
// ═══════════════════════════════════════════════
import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useStore, type Message } from '@/store';
import { uploadFile } from '@/lib/api';
import { wsManager } from '@/lib/ws';
import {
  Send, Mic, Smile, Paperclip, X, Image, FileText, Clock,
  Reply as ReplyIcon, Pencil, Video,
} from 'lucide-react';

interface MessageInputProps {
  roomId: number;
  replyTo: Message | null;
  editMsg: Message | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
}

export default function MessageInput({ roomId, replyTo, editMsg, onCancelReply, onCancelEdit }: MessageInputProps) {
  const { username, token } = useStore();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);

  // Fill text when editing
  useEffect(() => {
    if (editMsg) {
      setText(editMsg.content);
      textareaRef.current?.focus();
    }
  }, [editMsg]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
    }
  }, [text]);

  // Send typing indicator (2s throttle)
  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
      lastTypingRef.current = now;
      wsManager.send({ type: 'TYPING', roomId, sender: username });
    }
  }, [roomId, username]);

  // ── Send message ──
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !editMsg) return;

    if (editMsg) {
      wsManager.send({ type: 'EDIT', id: editMsg.id, roomId, content: trimmed, sender: username });
      onCancelEdit();
    } else if (showSchedule && scheduleDate) {
      wsManager.send({
        type: 'SCHEDULED',
        roomId,
        sender: username,
        content: trimmed,
        scheduledAt: new Date(scheduleDate).toISOString(),
      });
      setShowSchedule(false);
      setScheduleDate('');
    } else {
      wsManager.send({
        type: 'CHAT',
        roomId,
        sender: username,
        content: trimmed,
        ...(replyTo ? { replyToId: replyTo.id, replyToSender: replyTo.sender, replyToContent: replyTo.content } : {}),
      });
      if (replyTo) onCancelReply();
    }

    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // ── File upload ──
  const handleFile = async (file: File) => {
    if (!token || file.size > 100 * 1024 * 1024) return;
    setShowAttach(false);
    setUploading(true);
    setUploadProgress(0);
    try {
      const data = await uploadFile(token, file, (p) => setUploadProgress(p));
      const fileUrl = data?.fileUrl || data?.url || data;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
      wsManager.send({
        type: 'CHAT',
        roomId,
        sender: username,
        content: isImg ? '' : file.name,
        fileUrl: fileUrl,
        fileName: file.name,
        fileSize: file.size,
      });
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  // ── Paste file ──
  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) { handleFile(f); e.preventDefault(); }
      }
    }
  };

  // ── Drag & drop ──
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Keyboard ──
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (editMsg) onCancelEdit();
      else if (replyTo) onCancelReply();
    }
  };

  const hasText = text.trim().length > 0;

  // ── Quick emojis ──
  const quickEmojis = ['😀', '😂', '❤️', '🔥', '👍', '🎉', '😎', '🤔', '😢', '🐱', '😘', '🥰', '💪', '🙏', '😡', '🤝'];

  return (
    <div
      className="relative"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-(--color-accent)/10 border-2 border-dashed border-(--color-accent) rounded-xl z-10 flex items-center justify-center">
          <p className="text-(--color-accent) font-medium">Перетащите файл сюда</p>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="px-4 py-2 bg-(--color-bg-surface)">
          <div className="flex items-center gap-2 text-xs text-(--color-text-secondary)">
            <span>Загрузка {uploadProgress}%</span>
            <div className="flex-1 h-1 rounded-full bg-(--color-bg-tertiary) overflow-hidden">
              <div className="h-full bg-(--color-accent) transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Reply / Edit banner */}
      {(replyTo || editMsg) && (
        <div className="flex items-center gap-3 px-4 py-2 bg-(--color-bg-surface) border-t border-(--color-separator)">
          <div className={cn('w-0.5 h-8 rounded-full', editMsg ? 'bg-amber-500' : 'bg-(--color-accent)')} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {editMsg ? (
                <><Pencil size={12} className="text-amber-500" /> <span className="text-amber-500">Редактирование</span></>
              ) : (
                <><ReplyIcon size={12} className="text-(--color-accent)" /> <span className="text-(--color-accent)">{replyTo!.sender}</span></>
              )}
            </div>
            <p className="text-xs text-(--color-text-secondary) truncate">{editMsg?.content || replyTo?.content}</p>
          </div>
          <button
            onClick={editMsg ? onCancelEdit : onCancelReply}
            className="p-1 rounded-full hover:bg-(--color-bg-hover) text-(--color-text-tertiary) cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Scheduled banner */}
      {showSchedule && (
        <div className="flex items-center gap-3 px-4 py-2 bg-(--color-bg-surface) border-t border-(--color-separator)">
          <Clock size={16} className="text-amber-500" />
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="text-sm bg-transparent outline-none flex-1"
          />
          <button onClick={() => setShowSchedule(false)} className="p-1 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main input row */}
      <div className="flex items-end gap-1.5 px-3 py-2 bg-(--color-bg-surface) border-t border-(--color-separator)">
        {/* Emoji */}
        <button
          onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); }}
          className="p-2 rounded-full hover:bg-(--color-bg-hover) text-(--color-text-secondary) cursor-pointer shrink-0"
        >
          <Smile size={22} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); emitTyping(); }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="Сообщение"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm leading-5 py-2 outline-none placeholder:text-(--color-text-tertiary) max-h-[150px]"
        />

        {/* Attach */}
        <button
          onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }}
          className="p-2 rounded-full hover:bg-(--color-bg-hover) text-(--color-text-secondary) cursor-pointer shrink-0"
        >
          <Paperclip size={22} />
        </button>

        {/* Send / Mic / Video */}
        {hasText || editMsg ? (
          <button
            onClick={handleSend}
            className="p-2 rounded-full bg-(--color-accent) text-white hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          >
            <Send size={20} />
          </button>
        ) : (
          <div className="flex items-center">
            <button className="p-2 rounded-full hover:bg-(--color-bg-hover) text-(--color-text-secondary) cursor-pointer shrink-0">
              <Mic size={22} />
            </button>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" className="hidden" onChange={onFileChange} />

      {/* Attach menu dropdown */}
      {showAttach && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowAttach(false)} />
          <div className="absolute bottom-full left-3 mb-2 bg-(--color-bg-surface) border border-(--color-border) rounded-xl shadow-xl z-50 py-1 min-w-[180px] animate-slideUp">
            <AttachBtn icon={<Image size={18} className="text-blue-500" />} label="Фото или видео" onClick={() => { fileRef.current?.click(); setShowAttach(false); }} />
            <AttachBtn icon={<FileText size={18} className="text-green-500" />} label="Файл" onClick={() => { fileRef.current?.click(); setShowAttach(false); }} />
            <AttachBtn icon={<Clock size={18} className="text-amber-500" />} label="Запланировать" onClick={() => { setShowSchedule(true); setShowAttach(false); }} />
          </div>
        </>
      )}

      {/* Emoji picker (simple grid) */}
      {showEmoji && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
          <div className="absolute bottom-full left-3 mb-2 bg-(--color-bg-surface) border border-(--color-border) rounded-xl shadow-xl z-50 p-3 animate-slideUp">
            <div className="grid grid-cols-8 gap-1">
              {quickEmojis.map((e) => (
                <button
                  key={e}
                  onClick={() => { setText((t) => t + e); setShowEmoji(false); textareaRef.current?.focus(); }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-(--color-bg-hover) text-xl cursor-pointer transition-colors"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AttachBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-(--color-bg-hover) transition-colors cursor-pointer"
    >
      {icon} {label}
    </button>
  );
}
