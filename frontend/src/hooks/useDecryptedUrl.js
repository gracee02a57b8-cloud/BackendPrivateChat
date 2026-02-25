/**
 * useDecryptedUrl — returns file URL directly (encryption disabled).
 *
 * When E2E is re-enabled, this hook will fetch encrypted files,
 * decrypt them with AES-256-GCM, and return blob: URLs.
 */
export default function useDecryptedUrl(fileUrl, _fileKey, _mimeType) {
  return fileUrl || null;
}
