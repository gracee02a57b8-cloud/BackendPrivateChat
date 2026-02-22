/**
 * @vitest-environment jsdom
 *
 * Tests for useMediaPermissions hook — proactive camera/mic permission management.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMediaPermissions from '../useMediaPermissions';

const STORAGE_KEY = 'barsik_media_permissions_granted';

// Helpers to mock Permissions API
function mockPermissionsQuery(cameraState, micState) {
  const cameraStatus = { state: cameraState, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const micStatus = { state: micState, addEventListener: vi.fn(), removeEventListener: vi.fn() };

  navigator.permissions = {
    query: vi.fn(({ name }) => {
      if (name === 'camera') return Promise.resolve(cameraStatus);
      if (name === 'microphone') return Promise.resolve(micStatus);
      return Promise.reject(new Error('Unknown'));
    }),
  };

  return { cameraStatus, micStatus };
}

function mockGetUserMedia(resolveOrReject = 'resolve') {
  const mockStream = {
    getTracks: () => [
      { kind: 'audio', stop: vi.fn() },
      { kind: 'video', stop: vi.fn() },
    ],
  };

  if (resolveOrReject === 'resolve') {
    navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.resolve(mockStream)),
    };
  } else {
    const err = new Error('Permission denied');
    err.name = 'NotAllowedError';
    navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.reject(err)),
    };
  }

  return mockStream;
}

describe('useMediaPermissions', () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: mediaDevices available, permissions API available
    mockGetUserMedia('resolve');
    mockPermissionsQuery('prompt', 'prompt');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // === Permissions already granted ===

  it('detects already-granted permissions and sets permissionsGranted=true', async () => {
    mockPermissionsQuery('granted', 'granted');

    const { result } = renderHook(() => useMediaPermissions());

    // Wait for async check to complete
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.permissionsGranted).toBe(true);
    expect(result.current.showBanner).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('saves to localStorage when permissions are already granted', async () => {
    mockPermissionsQuery('granted', 'granted');

    renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  // === Permissions denied ===

  it('detects denied camera and shows banner with permissionsDenied', async () => {
    mockPermissionsQuery('denied', 'granted');

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.permissionsGranted).toBe(false);
    expect(result.current.permissionsDenied).toBe(true);
    expect(result.current.showBanner).toBe(true);
  });

  it('detects denied microphone and shows banner', async () => {
    mockPermissionsQuery('granted', 'denied');

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.permissionsDenied).toBe(true);
    expect(result.current.showBanner).toBe(true);
  });

  // === Permissions in 'prompt' state ===

  it('shows banner when permissions are in prompt state', async () => {
    mockPermissionsQuery('prompt', 'prompt');

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.showBanner).toBe(true);
    expect(result.current.permissionsGranted).toBe(false);
  });

  // === requestPermissions flow ===

  it('requestPermissions calls getUserMedia and grants on success', async () => {
    mockPermissionsQuery('prompt', 'prompt');
    const mockStream = mockGetUserMedia('resolve');

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.showBanner).toBe(true);

    // Click "Grant"
    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: true,
    });
    expect(result.current.permissionsGranted).toBe(true);
    expect(result.current.showBanner).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('requestPermissions sets permissionsDenied on NotAllowedError', async () => {
    mockPermissionsQuery('prompt', 'prompt');
    mockGetUserMedia('reject');

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(result.current.permissionsDenied).toBe(true);
    expect(result.current.permissionsGranted).toBe(false);
    // Banner remains visible so user sees the hint
    expect(result.current.showBanner).toBe(true);
  });

  // === dismissBanner ===

  it('dismissBanner hides the banner', async () => {
    mockPermissionsQuery('prompt', 'prompt');

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.showBanner).toBe(true);

    act(() => {
      result.current.dismissBanner();
    });

    expect(result.current.showBanner).toBe(false);
  });

  // === localStorage persistence ===

  it('reads localStorage on mount and skips banner if previously granted', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    // Permissions API returns 'prompt' but localStorage says granted
    // It should re-verify with getUserMedia
    mockPermissionsQuery('prompt', 'prompt');
    mockGetUserMedia('resolve');

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.permissionsGranted).toBe(true);
    expect(result.current.showBanner).toBe(false);
  });

  it('clears localStorage if re-verification fails', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    mockPermissionsQuery('prompt', 'prompt');
    mockGetUserMedia('reject');

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.permissionsGranted).toBe(false);
    expect(result.current.showBanner).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // === No mediaDevices (e.g. HTTP) ===

  it('does nothing when mediaDevices not available', async () => {
    navigator.mediaDevices = undefined;

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    expect(result.current.showBanner).toBe(false);
    expect(result.current.checking).toBe(false);
  });

  // === Permissions API not supported ===

  it('shows banner when Permissions API is not supported', async () => {
    // Remove Permissions API
    navigator.permissions = undefined;
    mockGetUserMedia('resolve');

    const { result } = renderHook(() => useMediaPermissions());

    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    // Should show banner since it can't determine permission state
    expect(result.current.showBanner).toBe(true);
  });
});
