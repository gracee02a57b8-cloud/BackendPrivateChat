/**
 * @vitest-environment jsdom
 *
 * Tests for useDecryptedUrl hook — fetches encrypted file,
 * decrypts via e2eManager, returns blob URL.
 * Covers: passthrough without fileKey, decrypt + blob, error fallback, cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import useDecryptedUrl from '../../hooks/useDecryptedUrl';

// Mock e2eManager
vi.mock('../../crypto/E2EManager', () => ({
  default: {
    decryptFile: vi.fn(),
  },
}));

import e2eManager from '../../crypto/E2EManager';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock URL.createObjectURL / revokeObjectURL
const mockBlobUrls = [];
globalThis.URL.createObjectURL = vi.fn((blob) => {
  const url = `blob:mock-${mockBlobUrls.length}`;
  mockBlobUrls.push(url);
  return url;
});
globalThis.URL.revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockBlobUrls.length = 0;
});

afterEach(() => cleanup());

// ======================== Passthrough ========================

describe('useDecryptedUrl — passthrough', () => {
  it('returns raw fileUrl when fileKey is null', () => {
    const { result } = renderHook(() =>
      useDecryptedUrl('https://example.com/file.pdf', null, 'application/pdf'),
    );
    expect(result.current).toBe('https://example.com/file.pdf');
  });

  it('returns raw fileUrl when fileKey is undefined', () => {
    const { result } = renderHook(() =>
      useDecryptedUrl('https://example.com/file.pdf', undefined, 'application/pdf'),
    );
    expect(result.current).toBe('https://example.com/file.pdf');
  });

  it('returns raw fileUrl when fileKey is empty string', () => {
    const { result } = renderHook(() =>
      useDecryptedUrl('https://example.com/file.pdf', '', 'application/pdf'),
    );
    expect(result.current).toBe('https://example.com/file.pdf');
  });

  it('returns null when both fileUrl and fileKey are null', () => {
    const { result } = renderHook(() =>
      useDecryptedUrl(null, null, 'image/png'),
    );
    expect(result.current).toBeNull();
  });

  it('does not call fetch when no fileKey', () => {
    renderHook(() =>
      useDecryptedUrl('https://example.com/img.jpg', null, 'image/jpeg'),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ======================== Decrypt + Blob ========================

describe('useDecryptedUrl — decrypt + blob', () => {
  it('fetches, decrypts, and returns blob URL', async () => {
    const encryptedData = new ArrayBuffer(100);
    const decryptedBlob = new Blob(['decrypted'], { type: 'image/png' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(encryptedData),
    });
    e2eManager.decryptFile.mockResolvedValueOnce(decryptedBlob);

    const { result } = renderHook(() =>
      useDecryptedUrl('https://example.com/enc.png', 'secret-key', 'image/png'),
    );

    // Initially null while loading
    expect(result.current).toBeNull();

    await waitFor(() => {
      expect(result.current).toMatch(/^blob:mock-/);
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/enc.png');
    expect(e2eManager.decryptFile).toHaveBeenCalledWith(encryptedData, 'secret-key', 'image/png');
    expect(URL.createObjectURL).toHaveBeenCalledWith(decryptedBlob);
  });

  it('passes correct mimeType to decryptFile', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
    });
    e2eManager.decryptFile.mockResolvedValueOnce(new Blob([''], { type: 'audio/webm' }));

    renderHook(() =>
      useDecryptedUrl('https://example.com/voice.webm', 'key-1', 'audio/webm'),
    );

    await waitFor(() => {
      expect(e2eManager.decryptFile).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        'key-1',
        'audio/webm',
      );
    });
  });
});

// ======================== Error Fallback ========================

describe('useDecryptedUrl — error fallback', () => {
  it('returns raw fileUrl when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const { result } = renderHook(() =>
      useDecryptedUrl('https://example.com/missing.pdf', 'key', 'application/pdf'),
    );

    await waitFor(() => {
      expect(result.current).toBe('https://example.com/missing.pdf');
    });
  });

  it('returns raw fileUrl when decryptFile throws', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    });
    e2eManager.decryptFile.mockRejectedValueOnce(new Error('decrypt error'));

    const { result } = renderHook(() =>
      useDecryptedUrl('https://example.com/bad.png', 'key', 'image/png'),
    );

    await waitFor(() => {
      expect(result.current).toBe('https://example.com/bad.png');
    });
  });

  it('returns raw fileUrl when fetch rejects', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() =>
      useDecryptedUrl('https://example.com/net-fail.pdf', 'key', 'application/pdf'),
    );

    await waitFor(() => {
      expect(result.current).toBe('https://example.com/net-fail.pdf');
    });
  });
});

// ======================== Cleanup ========================

describe('useDecryptedUrl — cleanup', () => {
  it('revokes blob URL on unmount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    });
    e2eManager.decryptFile.mockResolvedValueOnce(new Blob(['data']));

    const { result, unmount } = renderHook(() =>
      useDecryptedUrl('https://example.com/f.bin', 'key', 'application/octet-stream'),
    );

    await waitFor(() => {
      expect(result.current).toMatch(/^blob:mock-/);
    });

    const blobUrl = result.current;
    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
  });
});
