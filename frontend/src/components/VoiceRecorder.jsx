import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * VoiceRecorder — Telegram-style voice message recorder.
 * 
 * States: idle → recording → uploading
 * UI: replaces input area with red dot + timer + waveform + cancel/send
 */
export default function VoiceRecorder({ onSend, onCancel, token }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const waveIntervalRef = useRef(null);
  const startTimeRef = useRef(null);

  const MAX_DURATION = 300; // 5 minutes

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        } 
      });
      streamRef.current = stream;

      // Setup analyser for waveform
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Choose format: prefer webm/opus, fallback mp4 for Safari
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(100); // collect data every 100ms
      startTimeRef.current = Date.now();
      setRecording(true);
      setDuration(0);
      setWaveform([]);

      // Timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION) {
          stopAndSend();
        }
      }, 100);

      // Waveform sampling
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      waveIntervalRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);
        // Calculate RMS amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalized = Math.min(1, rms * 3); // boost signal
        setWaveform(prev => {
          const next = [...prev, normalized];
          // Keep last 100 bars for display
          return next.length > 100 ? next.slice(-100) : next;
        });
      }, 60);

    } catch (err) {
      console.error('[VoiceRecorder] Mic error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Доступ к микрофону запрещён. Разрешите в настройках браузера.');
      } else if (err.name === 'NotFoundError') {
        setError('Микрофон не найден.');
      } else {
        setError('Не удалось начать запись.');
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (waveIntervalRef.current) { clearInterval(waveIntervalRef.current); waveIntervalRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setRecording(false);
    setDuration(0);
    setWaveform([]);
    chunksRef.current = [];
    onCancel();
  }, [cleanup, onCancel]);

  const stopAndSend = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    
    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const finalWaveform = [...waveform];
    
    mediaRecorderRef.current.onstop = async () => {
      cleanup();
      setRecording(false);

      if (chunksRef.current.length === 0 || finalDuration < 1) {
        onCancel();
        return;
      }

      const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      // Compress waveform to 48 samples for storage
      const compressed = compressWaveform(finalWaveform, 48);

      // Upload
      setUploading(true);
      setUploadProgress(0);

      try {
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type || mimeType });
        
        const formData = new FormData();
        formData.append('file', file);

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
          setUploadProgress(0);
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            const voiceData = {
              fileUrl: data.url,
              fileName: data.originalName,
              fileSize: data.size,
              fileType: data.contentType,
              duration: finalDuration,
              waveform: JSON.stringify(compressed),
            };
            onSend(voiceData);
          } else {
            setError('Ошибка загрузки голосового сообщения');
          }
        };

        xhr.onerror = () => {
          setUploading(false);
          setError('Ошибка сети при загрузке');
        };

        xhr.send(formData);
      } catch (err) {
        setUploading(false);
        setError('Ошибка отправки');
        console.error('[VoiceRecorder] Upload error:', err);
      }
    };

    mediaRecorderRef.current.stop();
  }, [waveform, cleanup, onCancel, onSend, token]);

  // Auto-start recording on mount
  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="voice-recorder voice-error">
        <span className="voice-error-text">{error}</span>
        <button className="voice-cancel-btn" onClick={onCancel} type="button">✕</button>
      </div>
    );
  }

  if (uploading) {
    return (
      <div className="voice-recorder voice-uploading">
        <div className="voice-upload-bar">
          <div className="voice-upload-fill" style={{ width: `${uploadProgress}%` }} />
        </div>
        <span className="voice-upload-text">Отправка {uploadProgress}%</span>
      </div>
    );
  }

  return (
    <div className="voice-recorder">
      <button className="voice-cancel-btn" onClick={cancelRecording} type="button" title="Отменить">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>

      <div className="voice-rec-indicator">
        <span className="voice-rec-dot" />
        <span className="voice-rec-timer">{formatTime(duration)}</span>
      </div>

      <div className="voice-rec-waveform">
        {waveform.slice(-50).map((v, i) => (
          <div
            key={i}
            className="voice-rec-bar"
            style={{ height: `${Math.max(3, v * 28)}px` }}
          />
        ))}
      </div>

      <button className="voice-send-btn" onClick={stopAndSend} type="button" title="Отправить">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
  );
}

/** Compress waveform array to target number of samples */
function compressWaveform(data, targetLen) {
  if (!data || data.length === 0) return Array(targetLen).fill(0);
  if (data.length <= targetLen) {
    const padded = [...data];
    while (padded.length < targetLen) padded.push(0);
    return padded.map(v => Math.round(v * 100) / 100);
  }
  const step = data.length / targetLen;
  const result = [];
  for (let i = 0; i < targetLen; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let max = 0;
    for (let j = start; j < end && j < data.length; j++) {
      if (data[j] > max) max = data[j];
    }
    result.push(Math.round(max * 100) / 100);
  }
  return result;
}
