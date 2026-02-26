// ═══════════════════════════════════════════════
//  Message Bubble — Telegram-style
// ═══════════════════════════════════════════════
import { cn, formatTime } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import type { Message } from '@/store';
import { Check, CheckCheck, Reply, Pin, Pencil, FileText, Download, Play, Pause } from 'lucide-react';
import { useState, useRef } from 'react';

interface MessageBubbleProps {
  msg: Message;
  own: boolean;
  showSender: boolean;
  showAvatar: boolean;
  avatarMap: Record<string, string>;
  isGroup: boolean;
  onReply?: (msg: Message) => void;
  onEdit?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
}

export default function MessageBubble({ msg, own, showSender, showAvatar, avatarMap, isGroup, onReply, onEdit, onDelete }: MessageBubbleProps) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  // System messages (join/leave)
  if (msg.type === 'JOIN' || msg.type === 'LEAVE') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-(--color-text-tertiary) bg-(--color-bg-tertiary) px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  // Call log
  if (msg.type === 'CALL_LOG') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-(--color-text-secondary) bg-(--color-bg-tertiary) px-3 py-1.5 rounded-full">
          📞 {msg.content}
        </span>
      </div>
    );
  }

  const hasFile = !!msg.fileUrl;
  const isImage = hasFile && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(msg.fileUrl!);
  const isVideo = hasFile && /\.(mp4|webm|mov)$/i.test(msg.fileUrl!);
  const isVoice = msg.type === 'VOICE';
  const isVideoCircle = msg.type === 'VIDEO_CIRCLE';

  // Reply preview
  const replyPreview = msg.replyToId ? (
    <div className={cn(
      'flex items-start gap-2 px-2.5 py-1.5 mb-1 rounded-lg text-xs border-l-2 cursor-pointer',
      own
        ? 'bg-black/5 dark:bg-white/5 border-white/40'
        : 'bg-(--color-bg-tertiary) border-(--color-accent)'
    )}>
      <div className="min-w-0">
        <p className={cn('font-medium truncate', own ? 'text-white/80 dark:text-white/70' : 'text-(--color-accent)')}>
          {msg.replyToSender}
        </p>
        <p className="truncate text-(--color-text-secondary)">{msg.replyToContent}</p>
      </div>
    </div>
  ) : null;

  return (
    <div
      className={cn('flex gap-2 px-3 group', own ? 'flex-row-reverse' : 'flex-row')}
      onContextMenu={handleContext}
    >
      {/* Avatar (other, group) */}
      {!own && isGroup ? (
        showAvatar ? (
          <Avatar src={avatarMap[msg.sender]} name={msg.sender} size="sm" className="mt-auto mb-0.5" />
        ) : (
          <div className="w-9 shrink-0" />
        )
      ) : null}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[min(480px,75%)] relative',
          own ? 'ml-auto' : 'mr-auto'
        )}
      >
        <div
          className={cn(
            'px-3 py-1.5 shadow-sm',
            own
              ? 'bg-(--color-bg-bubble-own) rounded-2xl rounded-br-md text-[14px]'
              : 'bg-(--color-bg-bubble-other) rounded-2xl rounded-bl-md text-[14px]',
            isImage && !msg.content ? 'p-1 overflow-hidden' : ''
          )}
        >
          {/* Sender name (group, other) */}
          {showSender && !own && isGroup && (
            <p className="text-xs font-semibold text-(--color-accent) mb-0.5">{msg.sender}</p>
          )}

          {/* Reply */}
          {replyPreview}

          {/* Forwarded */}
          {msg.forwardedFrom && (
            <p className="text-xs text-(--color-text-tertiary) italic mb-1">
              Переслано от {msg.forwardedFrom}
            </p>
          )}

          {/* Image */}
          {isImage && (
            <img
              src={msg.fileUrl}
              alt=""
              className="rounded-xl max-w-full max-h-[300px] object-cover cursor-pointer"
              loading="lazy"
            />
          )}

          {/* Video */}
          {isVideo && !isVideoCircle && (
            <video src={msg.fileUrl} controls className="rounded-xl max-w-full max-h-[300px]" preload="metadata" />
          )}

          {/* File */}
          {hasFile && !isImage && !isVideo && !isVoice && !isVideoCircle && (
            <a
              href={msg.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <FileText size={20} className="text-(--color-accent) shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{msg.fileName || 'Файл'}</p>
                {msg.fileSize && <p className="text-[11px] text-(--color-text-tertiary)">{(msg.fileSize / 1024).toFixed(0)} KB</p>}
              </div>
              <Download size={16} className="text-(--color-text-tertiary) shrink-0 ml-auto" />
            </a>
          )}

          {/* Text */}
          {msg.content && (
            <p className="whitespace-pre-wrap break-words leading-[1.35]">
              {msg.content}
              {/* Invisible spacer for time */}
              <span className="inline-block w-16" />
            </p>
          )}

          {/* Time + status */}
          <span className={cn(
            'absolute bottom-1.5 text-[11px] flex items-center gap-0.5',
            own ? 'right-2.5' : 'right-2.5',
            own ? 'text-[#4fae4e]/70 dark:text-white/40' : 'text-(--color-text-tertiary)'
          )}>
            {msg.editedAt && <span className="mr-0.5">ред.</span>}
            {formatTime(msg.timestamp)}
            {own && (
              msg.status === 'READ'
                ? <CheckCheck size={14} className="text-(--color-accent)" />
                : msg.status === 'DELIVERED'
                  ? <CheckCheck size={14} />
                  : <Check size={14} />
            )}
          </span>
        </div>

        {/* Reactions */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className={cn('flex gap-1 mt-1', own ? 'justify-end' : 'justify-start')}>
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <span
                key={emoji}
                className="text-xs bg-(--color-bg-tertiary) px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-(--color-bg-active) transition-colors"
              >
                {emoji} {users.length}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed bg-(--color-bg-surface) border border-(--color-border) rounded-xl shadow-xl z-[1000] py-1 min-w-[160px] animate-scaleIn"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            <CtxBtn icon={<Reply size={16} />} label="Ответить" onClick={() => { setCtxMenu(null); onReply?.(msg); }} />
            {own && <CtxBtn icon={<Pencil size={16} />} label="Редактировать" onClick={() => { setCtxMenu(null); onEdit?.(msg); }} />}
            <CtxBtn icon={<Pin size={16} />} label="Закрепить" onClick={() => setCtxMenu(null)} />
            <div className="h-px bg-(--color-separator) my-1" />
            <CtxBtn icon={<span className="text-(--color-danger)">🗑</span>} label="Удалить" onClick={() => { setCtxMenu(null); onDelete?.(msg); }} danger />
          </div>
        </>
      )}
    </div>
  );
}

function CtxBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2 text-sm cursor-pointer transition-colors',
        danger ? 'text-(--color-danger) hover:bg-(--color-danger)/8' : 'hover:bg-(--color-bg-hover)'
      )}
    >
      {icon} {label}
    </button>
  );
}
