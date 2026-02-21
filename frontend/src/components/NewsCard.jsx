import { useState } from 'react';

export default function NewsCard({ news, username, onDelete, token }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentCount, setCommentCount] = useState(news.commentCount || 0);
  const [loadingComments, setLoadingComments] = useState(false);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/news/${news.id}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setComments(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoadingComments(false); }
  };

  const toggleComments = () => {
    if (!showComments) fetchComments();
    setShowComments(!showComments);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const res = await fetch(`/api/news/${news.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setCommentCount((c) => c + 1);
        setCommentText('');
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const res = await fetch(`/api/news/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentCount((c) => Math.max(0, c - 1));
      }
    } catch (e) { console.error(e); }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const parts = ts.split(' ');
    if (parts.length === 2) return parts[1].slice(0, 5);
    return ts;
  };

  return (
    <div className="news-card">
      {news.imageUrl && (
        <div className="news-image">
          <img src={news.imageUrl} alt={news.title} />
        </div>
      )}
      <div className="news-content">
        <h3>{news.title}</h3>
        <p className="news-text">{news.content}</p>
        <div className="news-meta">
          <span className="news-author">✍️ {news.author}</span>
          <span className="news-date">{news.createdAt}</span>
        </div>
      </div>

      {/* Comment toggle button */}
      <button className="news-comments-toggle" onClick={toggleComments}>
        💬 {commentCount > 0 ? `Комментарии (${commentCount})` : 'Комментировать'}
      </button>

      {/* Comments section */}
      {showComments && (
        <div className="news-comments">
          {loadingComments && <div className="nc-loading">Загрузка...</div>}

          {!loadingComments && comments.length === 0 && (
            <div className="nc-empty">Нет комментариев. Будьте первым!</div>
          )}

          <div className="nc-list">
            {comments.map((c) => (
              <div key={c.id} className="nc-item">
                <div className="nc-item-header">
                  <span className="nc-author">{c.author}</span>
                  <span className="nc-time">{formatTime(c.createdAt)}</span>
                </div>
                <div className="nc-text">{c.text}</div>
                {c.author === username && (
                  <button className="nc-delete" onClick={() => handleDeleteComment(c.id)} title="Удалить">✕</button>
                )}
              </div>
            ))}
          </div>

          <form className="nc-form" onSubmit={handleAddComment}>
            <input
              type="text"
              placeholder="Написать комментарий..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={500}
            />
            <button type="submit" disabled={!commentText.trim()}>➤</button>
          </form>
        </div>
      )}

      {news.author === username && (
        <button
          className="news-delete-btn"
          onClick={() => onDelete(news.id)}
          title="Удалить новость"
        >
          🗑
        </button>
      )}
    </div>
  );
}
