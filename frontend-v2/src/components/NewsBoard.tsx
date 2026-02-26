// ═══════════════════════════════════════════════
//  News Board — feed of news with comments
// ═══════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { fetchNews, createNews, addComment, deleteNews } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import { ArrowLeft, Plus, Send, Heart, MessageCircle, Trash2, X } from 'lucide-react';
import { formatDate, formatTime, cn } from '@/lib/utils';

interface NewsBoardProps {
  onClose: () => void;
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  imageUrl?: string;
  likes?: string[];
  comments?: { id: number; author: string; content: string; createdAt: string }[];
}

export default function NewsBoard({ onClose }: NewsBoardProps) {
  const { token, username, avatarMap } = useStore();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchNews(token).then(setNews).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  const handleCreate = async () => {
    if (!token || !title.trim() || !content.trim()) return;
    try {
      const item = await createNews(token, { title: title.trim(), content: content.trim() });
      setNews([item, ...news]);
      setTitle('');
      setContent('');
      setShowCreate(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleComment = async (newsId: number) => {
    const text = commentInputs[newsId]?.trim();
    if (!text || !token) return;
    try {
      const comment = await addComment(token, newsId, text);
      setNews(news.map((n) =>
        n.id === newsId ? { ...n, comments: [...(n.comments || []), comment] } : n
      ));
      setCommentInputs({ ...commentInputs, [newsId]: '' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (newsId: number) => {
    if (!token) return;
    try {
      await deleteNews(token, newsId);
      setNews(news.filter((n) => n.id !== newsId));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary)">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 bg-(--color-bg-surface) border-b border-(--color-separator) shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-base font-semibold flex-1">Новости</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="p-2 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-accent)">
          <Plus size={22} />
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-4 bg-(--color-bg-surface) border-b border-(--color-separator)">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            className="w-full px-3 py-2 text-sm bg-(--color-bg-tertiary) rounded-lg outline-none focus:ring-1 focus:ring-(--color-accent) mb-2"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Содержание"
            rows={3}
            className="w-full px-3 py-2 text-sm bg-(--color-bg-tertiary) rounded-lg outline-none focus:ring-1 focus:ring-(--color-accent) resize-none mb-3"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-(--color-bg-hover) cursor-pointer">
              Отмена
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || !content.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-(--color-accent) text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              Опубликовать
            </button>
          </div>
        </div>
      )}

      {/* News list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-(--color-accent) border-t-transparent rounded-full animate-spin" />
          </div>
        ) : news.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-(--color-text-tertiary)">
            <p className="text-sm">Нет новостей</p>
          </div>
        ) : (
          news.map((item) => (
            <div key={item.id} className="bg-(--color-bg-surface) border-b border-(--color-separator)">
              {/* Author */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <Avatar src={avatarMap[item.author]} name={item.author} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.author}</p>
                  <p className="text-xs text-(--color-text-tertiary)">{formatDate(item.createdAt)} {formatTime(item.createdAt)}</p>
                </div>
                {item.author === username && (
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-text-tertiary)">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="px-4 pb-3">
                <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-sm text-(--color-text-secondary) whitespace-pre-wrap">{item.content}</p>
              </div>

              {item.imageUrl && (
                <img src={item.imageUrl} alt="" className="w-full max-h-80 object-cover" />
              )}

              {/* Comments */}
              {item.comments && item.comments.length > 0 && (
                <div className="px-4 py-2 space-y-2">
                  {item.comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <Avatar src={avatarMap[c.author]} name={c.author} size="xs" />
                      <div className="bg-(--color-bg-tertiary) rounded-lg px-2.5 py-1.5 min-w-0">
                        <p className="text-xs font-medium text-(--color-accent)">{c.author}</p>
                        <p className="text-xs">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment input */}
              <div className="flex items-center gap-2 px-4 py-2.5">
                <input
                  value={commentInputs[item.id] || ''}
                  onChange={(e) => setCommentInputs({ ...commentInputs, [item.id]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleComment(item.id)}
                  placeholder="Комментарий..."
                  className="flex-1 text-xs bg-(--color-bg-tertiary) rounded-full px-3 py-1.5 outline-none focus:ring-1 focus:ring-(--color-accent)"
                />
                <button onClick={() => handleComment(item.id)} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-accent)">
                  <Send size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
