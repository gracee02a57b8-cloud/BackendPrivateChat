import { useState, useEffect, useRef } from 'react';
import e2eManager from '../crypto/E2EManager';

/**
 * useDecryptedUrl — fetches an encrypted file, decrypts it with AES-256-GCM,
 * and returns a local blob: URL for playback / display.
 *
 * If fileKey is falsy, returns the original fileUrl as-is (unencrypted file).
 */
export default function useDecryptedUrl(fileUrl, fileKey, mimeType) {
  const [url, setUrl] = useState(fileKey ? null : fileUrl);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (!fileKey || !fileUrl) {
      setUrl(fileUrl || null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const encBuf = await res.arrayBuffer();
        const blob = await e2eManager.decryptFile(encBuf, fileKey, mimeType);
        if (!cancelled) {
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;
          setUrl(blobUrl);
        }
      } catch (err) {
        console.error('[E2E] File decrypt failed:', err);
        if (!cancelled) setUrl(fileUrl); // fallback to raw URL
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [fileUrl, fileKey, mimeType]);

  return url;
}
