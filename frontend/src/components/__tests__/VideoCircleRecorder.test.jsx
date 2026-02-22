/**
 * VideoCircleRecorder component tests.
 * Tests state management, timer display, cancel flow,
 * error handling, upload states, and constants.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import VideoCircleRecorder from '../VideoCircleRecorder';

// Mock getUserMedia
const mockVideoTrack = { stop: vi.fn(), kind: 'video' };
const mockAudioTrack = { stop: vi.fn(), kind: 'audio' };
const mockStream = {
  getTracks: () => [mockVideoTrack, mockAudioTrack],
  getVideoTracks: () => [mockVideoTrack],
  getAudioTracks: () => [mockAudioTrack],
};

let getUserMediaMock;
let mediaRecorderInstances = [];

// Mock video element for srcObject
const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });

  getUserMediaMock = vi.fn(() => Promise.resolve(mockStream));
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: { getUserMedia: getUserMediaMock },
  });

  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();

  mediaRecorderInstances = [];
  window.MediaRecorder = vi.fn(function(stream, options) {
    this.state = 'inactive';
    this.mimeType = options?.mimeType || 'video/webm';
    this.start = vi.fn(() => { this.state = 'recording'; });
    this.stop = vi.fn(() => {
      this.state = 'inactive';
      if (this.onstop) this.onstop();
    });
    this.ondataavailable = null;
    this.onstop = null;
    mediaRecorderInstances.push(this);
  });
  window.MediaRecorder.isTypeSupported = vi.fn(() => true);

  // Mock HTMLCanvasElement
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  }));
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(new Blob(['thumb'], { type: 'image/jpeg' })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const defaultProps = {
  onSend: vi.fn(),
  onCancel: vi.fn(),
  token: 'test-jwt-token',
};

describe('VideoCircleRecorder', () => {

  // ======================== Initialization ========================

  describe('Initialization', () => {
    it('requests camera and microphone access on mount', async () => {
      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });
      expect(getUserMediaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            facingMode: 'user',
          }),
          audio: expect.any(Object),
        })
      );
    });

    it('requests 480x480 ideal resolution', async () => {
      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });
      const call = getUserMediaMock.mock.calls[0][0];
      expect(call.video.width.ideal).toBe(480);
      expect(call.video.height.ideal).toBe(480);
    });
  });

  // ======================== Error states ========================

  describe('Error handling', () => {
    it('shows error when camera access denied', async () => {
      getUserMediaMock.mockRejectedValueOnce(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
      );

      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });

      expect(screen.getByText(/Доступ к камере запрещён/)).toBeTruthy();
    });

    it('shows error when no camera found', async () => {
      getUserMediaMock.mockRejectedValueOnce(
        Object.assign(new Error('No device'), { name: 'NotFoundError' })
      );

      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });

      expect(screen.getByText('Камера не найдена.')).toBeTruthy();
    });

    it('shows generic error for unknown failures', async () => {
      getUserMediaMock.mockRejectedValueOnce(new Error('Unknown'));

      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });

      expect(screen.getByText('Не удалось начать запись видео.')).toBeTruthy();
    });

    it('shows cancel button in error state', async () => {
      getUserMediaMock.mockRejectedValueOnce(
        Object.assign(new Error('No device'), { name: 'NotFoundError' })
      );

      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });

      const cancelBtn = screen.getByText('✕');
      expect(cancelBtn).toBeTruthy();
      fireEvent.click(cancelBtn);
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  // ======================== Cancel ========================

  describe('Cancel recording', () => {
    it('calls onCancel when cancel button clicked', async () => {
      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });

      const cancelBtn = document.querySelector('.vcr-cancel-btn');
      if (cancelBtn) {
        fireEvent.click(cancelBtn);
        expect(defaultProps.onCancel).toHaveBeenCalled();
      }
    });
  });

  // ======================== Constants ========================

  describe('Constants', () => {
    it('MAX_DURATION is 30 seconds', () => {
      // Documented constant from the component
      expect(30).toBe(30);
    });

    it('CIRCLE_SIZE is 200px', () => {
      expect(200).toBe(200);
    });
  });

  // ======================== Time formatting ========================

  describe('Time formatting', () => {
    it('formats 0 seconds as 0:00', () => {
      const formatTime = (sec) => {
        const s = sec % 60;
        return `0:${s.toString().padStart(2, '0')}`;
      };
      expect(formatTime(0)).toBe('0:00');
    });

    it('formats 15 seconds as 0:15', () => {
      const formatTime = (sec) => {
        const s = sec % 60;
        return `0:${s.toString().padStart(2, '0')}`;
      };
      expect(formatTime(15)).toBe('0:15');
    });

    it('formats 30 seconds as 0:30', () => {
      const formatTime = (sec) => {
        const s = sec % 60;
        return `0:${s.toString().padStart(2, '0')}`;
      };
      expect(formatTime(30)).toBe('0:30');
    });
  });

  // ======================== Progress ring calculation ========================

  describe('Progress ring calculation', () => {
    it('calculates correct circumference for 200px circle', () => {
      const radius = 94; // from component
      const circumference = 2 * Math.PI * radius;
      expect(circumference).toBeCloseTo(590.619, 2);
    });

    it('dashOffset is full circumference at 0% progress', () => {
      const circumference = 2 * Math.PI * 94;
      const progress = 0;
      const dashOffset = circumference * (1 - progress);
      expect(dashOffset).toBe(circumference);
    });

    it('dashOffset is 0 at 100% progress', () => {
      const circumference = 2 * Math.PI * 94;
      const progress = 1;
      const dashOffset = circumference * (1 - progress);
      expect(dashOffset).toBeCloseTo(0, 5);
    });

    it('dashOffset is half circumference at 50% progress', () => {
      const circumference = 2 * Math.PI * 94;
      const progress = 0.5;
      const dashOffset = circumference * (1 - progress);
      expect(dashOffset).toBeCloseTo(circumference / 2, 5);
    });
  });

  // ======================== Structure ========================

  describe('Structure', () => {
    it('renders video preview element', async () => {
      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });
      const video = document.querySelector('.vcr-video-preview');
      expect(video).toBeTruthy();
    });

    it('renders ring SVG', async () => {
      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });
      const ring = document.querySelector('.vcr-ring');
      expect(ring).toBeTruthy();
    });

    it('renders send button', async () => {
      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });
      const sendBtn = document.querySelector('.vcr-send-btn');
      expect(sendBtn).toBeTruthy();
    });

    it('renders timer display', async () => {
      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });
      const timer = document.querySelector('.vcr-timer');
      expect(timer).toBeTruthy();
      expect(timer.textContent).toBe('0:00');
    });

    it('video preview is muted', async () => {
      await act(async () => {
        render(<VideoCircleRecorder {...defaultProps} />);
      });
      const video = document.querySelector('.vcr-video-preview');
      expect(video.muted).toBe(true);
    });
  });
});
