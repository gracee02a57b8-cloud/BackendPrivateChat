export default function NewsCard({ news, username, onDelete }) {
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
