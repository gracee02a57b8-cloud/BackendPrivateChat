import { useState, useRef, useCallback } from 'react';
import { X, Video, Upload, Loader } from 'lucide-react';

const MAX_DURATION = 30; // seconds
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Modal for uploading a video story.
 * Shows preview, validates duration ≤30s, generates thumbnail.
 */
export default function StoryUploadModal({ onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const videoRef = useRef(null);

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');

    if (!f.type.startsWith('video/')) {
      setError('Выберите видео файл');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('Файл слишком большой (макс 100MB)');
      return;
    }

    // Check duration
    const url = URL.createObjectURL(f);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.onloadedmetadata = () => {
      if (vid.duration > MAX_DURATION) {
        setError(`Видео слишком длинное (${Math.round(vid.duration)}с). Максимум ${MAX_DURATION}с`);
        URL.revokeObjectURL(url);
        return;
      }
      setDuration(vid.duration);
      setFile(f);
      setPreview(url);
    };
    vid.onerror = () => {
      setError('Не удалось прочитать видео');
      URL.revokeObjectURL(url);
    };
    vid.src = url;
  }, []);

  const generateThumbnail = useCallback(() => {
    return new Promise((resolve) => {
      if (!videoRef.current) { resolve(null); return; }
      try {
        const vid = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = vid.videoWidth || 360;
        canvas.height = vid.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      } catch (e) {
        resolve(null);
      }
    });
  }, []);

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    try {
      const thumbnail = await generateThumbnail();
      await onUpload(file, thumbnail);
      onClose();
    } catch (e) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="story-upload-overlay" onClick={onClose}>
      <div className="story-upload-modal" onClick={e => e.stopPropagation()}>
        <div className="story-upload-header">
          <h3>Новая история</h3>
          <button className="story-upload-close" onClick={onClose}><X size={22} /></button>
        </div>

        {!file ? (
          <div className="story-upload-dropzone" onClick={() => fileRef.current?.click()}>
            <Video size={48} />
            <p>Выберите видео</p>
            <span className="story-upload-hint">До {MAX_DURATION} секунд, макс 100MB</span>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>
        ) : (
          <div className="story-upload-preview">
            <video
              ref={videoRef}
              src={preview}
              className="story-upload-video"
              playsInline
              autoPlay
              muted
              loop
            />
            <div className="story-upload-info">
              <span>{Math.round(duration)}с</span>
              <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
            </div>
          </div>
        )}

        {error && <div className="story-upload-error">{error}</div>}

        <div className="story-upload-actions">
          <button className="story-upload-btn cancel" onClick={onClose}>Отмена</button>
          <button
            className="story-upload-btn submit"
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? <><Loader size={16} className="spin" /> Загрузка...</> : <><Upload size={16} /> Опубликовать</>}
          </button>
        </div>
      </div>
    </div>
  );
}
