import { useState, useEffect } from 'react';
import NewsCard from './NewsCard';

export default function NewsBoard({ token, username, onBack }) {
  const [newsList, setNewsList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = () => {
    fetch('/api/news', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setNewsList(data))
      .catch(console.error);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('Файл слишком большой (макс. 20МБ)');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setUploading(true);
    let imageUrl = null;

    try {
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          imageUrl = data.url;
        }
      }

      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), imageUrl }),
      });

      if (res.ok) {
        setTitle('');
        setContent('');
        setImageFile(null);
        setImagePreview(null);
        setShowForm(false);
        fetchNews();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить эту новость?')) return;
    try {
      const res = await fetch(`/api/news/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchNews();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="news-board">
      <div className="news-header">
        <button className="back-btn" onClick={onBack}>← Чат</button>
        <h2>📰 Доска новостей</h2>
        <button className="add-news-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Отмена' : '+ Добавить'}
        </button>
      </div>

      {showForm && (
        <form className="news-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Заголовок новости..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            autoFocus
          />
          <textarea
            placeholder="Описание..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            maxLength={2000}
          />
          <div className="upload-area">
            <label className="upload-label">
              📷 {imageFile ? imageFile.name : 'Прикрепить картинку'}
              <input type="file" accept="image/*" onChange={handleImageChange} hidden />
            </label>
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button type="button" className="remove-image" onClick={() => { setImageFile(null); setImagePreview(null); }}>✕</button>
              </div>
            )}
          </div>
          <button type="submit" disabled={!title.trim() || uploading}>
            {uploading ? 'Публикация...' : 'Опубликовать'}
          </button>
        </form>
      )}

      <div className="news-list">
        {newsList.length === 0 && (
          <div className="empty-news">
            <p>Новостей пока нет. Будьте первым!</p>
          </div>
        )}
        {newsList.map((news) => (
          <NewsCard key={news.id} news={news} username={username} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
