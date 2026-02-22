import { useState, useRef, useEffect, useCallback } from 'react';
import e2eManager from '../crypto/E2EManager';

/**
 * VideoCircleRecorder — Telegram-style video circle recorder.
 *
 * Records front camera in a circular preview with 30-second max.
 * Shows a ring timer (SVG), generates a thumbnail on stop, uploads both.
 */
export default function VideoCircleRecorder({ onSend, onCancel, token, isE2E }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const canvasRef = useRef(null);

  const MAX_DURATION = 30; // seconds
  const CIRCLE_SIZE = 200; // px for preview

  // Start camera + recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Show preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
      setCameraReady(true);

      // Choose format
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : MediaRecorder.isTypeSupported('video/mp4')
              ? 'video/mp4'
              : '';

      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 1_500_000, // 1.5 Mbps — balance quality/size
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(200); // collect every 200ms
      startTimeRef.current = Date.now();
      setRecording(true);
      setDuration(0);

      // Timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION) {
          stopAndSend();
        }
      }, 100);
    } catch (err) {
      console.error('[VideoCircleRecorder] Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Доступ к камере запрещён. Разрешите в настройках браузера.');
      } else if (err.name === 'NotFoundError') {
        setError('Камера не найдена.');
      } else {
        setError('Не удалось начать запись видео.');
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setRecording(false);
    setDuration(0);
    chunksRef.current = [];
    onCancel();
  }, [cleanup, onCancel]);

  /** Generate thumbnail from the last frame of the video preview */
  const generateThumbnail = useCallback(() => {
    return new Promise((resolve) => {
      const video = videoPreviewRef.current;
      if (!video || !video.videoWidth) {
        resolve(null);
        return;
      }
      const canvas = canvasRef.current || document.createElement('canvas');
      const size = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Center-crop to square
      const sx = (video.videoWidth - size) / 2;
      const sy = (video.videoHeight - size) / 2;
      ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.7
      );
    });
  }, []);

  /** Upload a file and return the response data */
  const uploadBlob = useCallback((blob, filename, onProgress) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', new File([blob], filename, { type: blob.type }));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload/file');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  }, [token]);

  const stopAndSend = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    const finalDuration = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));

    // Generate thumbnail before stopping the stream
    const thumbnailPromise = generateThumbnail();

    mediaRecorderRef.current.onstop = async () => {
      setRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

      if (chunksRef.current.length === 0 || finalDuration < 1) {
        cleanup();
        onCancel();
        return;
      }

      const mimeType = mediaRecorderRef.current.mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      cleanup();
      setUploading(true);
      setUploadProgress(0);

      try {
        // Encrypt video for E2E rooms
        let videoUploadBlob = blob;
        let fileKey = null;
        if (isE2E) {
          try {
            const enc = await e2eManager.encryptFile(blob);
            videoUploadBlob = enc.encryptedBlob;
            fileKey = enc.fileKey;
          } catch (err) { console.warn('[E2E] Video encrypt failed:', err); }
        }

        // Upload video
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const videoData = await uploadBlob(
          videoUploadBlob,
          `video_circle_${Date.now()}.${ext}`,
          (p) => setUploadProgress(p)
        );

        // Upload thumbnail (also encrypt if E2E)
        let thumbnailUrl = null;
        let thumbnailKey = null;
        const thumbBlob = await thumbnailPromise;
        if (thumbBlob) {
          let thumbUploadBlob = thumbBlob;
          if (isE2E) {
            try {
              const enc = await e2eManager.encryptFile(thumbBlob);
              thumbUploadBlob = enc.encryptedBlob;
              thumbnailKey = enc.fileKey;
            } catch (err) { console.warn('[E2E] Thumb encrypt failed:', err); }
          }
          const thumbData = await uploadBlob(thumbUploadBlob, `thumb_${Date.now()}.jpg`);
          thumbnailUrl = thumbData.url;
        }

        setUploading(false);
        setUploadProgress(0);

        const videoResult = {
          fileUrl: videoData.url,
          fileName: videoData.originalName,
          fileSize: videoData.size,
          fileType: videoData.contentType,
          duration: finalDuration,
          thumbnailUrl,
          isVideoCircle: true,
        };
        if (fileKey) videoResult.fileKey = fileKey;
        if (thumbnailKey) videoResult.thumbnailKey = thumbnailKey;
        onSend(videoResult);
      } catch (err) {
        setUploading(false);
        setError('Ошибка загрузки видеокружка');
        console.error('[VideoCircleRecorder] Upload error:', err);
      }
    };

    mediaRecorderRef.current.stop();
  }, [generateThumbnail, uploadBlob, cleanup, onCancel, onSend]);

  // Auto-start on mount
  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = duration / MAX_DURATION; // 0..1
  const circumference = 2 * Math.PI * 94; // radius 94px for 200px circle
  const dashOffset = circumference * (1 - progress);

  if (error) {
    return (
      <div className="vcr-container vcr-error">
        <span className="vcr-error-text">{error}</span>
        <button className="vcr-cancel-btn" onClick={onCancel} type="button">✕</button>
      </div>
    );
  }

  if (uploading) {
    return (
      <div className="vcr-container vcr-uploading">
        <div className="vcr-upload-ring">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
            <circle cx="60" cy="60" r="54" fill="none" stroke="#4ecca3" strokeWidth="4"
              strokeDasharray={2 * Math.PI * 54}
              strokeDashoffset={2 * Math.PI * 54 * (1 - uploadProgress / 100)}
              strokeLinecap="round"
              transform="rotate(-90 60 60)" />
          </svg>
          <span className="vcr-upload-pct">{uploadProgress}%</span>
        </div>
        <span className="vcr-upload-text">Отправка…</span>
      </div>
    );
  }

  return (
    <div className="vcr-container">
      <button className="vcr-cancel-btn" onClick={cancelRecording} type="button" title="Отменить">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="vcr-preview-wrap" style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
        {/* Ring timer */}
        <svg className="vcr-ring" width={CIRCLE_SIZE} height={CIRCLE_SIZE} viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
          <circle cx="100" cy="100" r="94" fill="none" stroke="#e74c3c" strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 0.15s linear' }} />
        </svg>
        <video
          ref={videoPreviewRef}
          className="vcr-video-preview"
          autoPlay
          muted
          playsInline
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {!cameraReady && <div className="vcr-loading">📷</div>}
      </div>

      <div className="vcr-bottom">
        <span className="vcr-timer">{formatTime(duration)}</span>
        <button className="vcr-send-btn" onClick={stopAndSend} type="button" title="Отправить">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function formatTime(sec) {
  const s = sec % 60;
  return `0:${s.toString().padStart(2, '0')}`;
}
