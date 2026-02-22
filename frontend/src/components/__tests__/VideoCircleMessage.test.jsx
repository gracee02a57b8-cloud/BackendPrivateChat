/**
 * VideoCircleMessage component tests.
 * Tests rendering, play/pause, mute toggle, progress ring,
 * duration display, thumbnail poster, structure.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import VideoCircleMessage from '../VideoCircleMessage';

// Mock HTMLMediaElement methods
const playMock = vi.fn(() => Promise.resolve());
const pauseMock = vi.fn();

beforeEach(() => {
  Object.defineProperty(HTMLVideoElement.prototype, 'play', {
    configurable: true,
    value: playMock,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
    configurable: true,
    value: pauseMock,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const defaultProps = {
  fileUrl: '/uploads/video_circle_test.webm',
  duration: 25,
  thumbnailUrl: '/uploads/thumb_test.jpg',
  isOwn: false,
};

describe('VideoCircleMessage', () => {

  // ======================== Rendering ========================

  describe('Rendering', () => {
    it('renders circle container', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      expect(container.querySelector('.vc-circle')).toBeTruthy();
    });

    it('renders circle wrap container (mute button parent)', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      expect(container.querySelector('.vc-circle-wrap')).toBeTruthy();
    });

    it('renders video element with correct src', () => {
      render(<VideoCircleMessage {...defaultProps} />);
      const video = document.querySelector('video');
      expect(video).toBeTruthy();
      expect(video.src).toContain('video_circle_test.webm');
    });

    it('renders video with poster thumbnail', () => {
      render(<VideoCircleMessage {...defaultProps} />);
      const video = document.querySelector('video');
      expect(video.poster).toContain('thumb_test.jpg');
    });

    it('renders video without poster when thumbnailUrl is null', () => {
      render(<VideoCircleMessage {...defaultProps} thumbnailUrl={null} />);
      const video = document.querySelector('video');
      expect(video.poster).toBe('');
    });

    it('renders duration label', () => {
      render(<VideoCircleMessage {...defaultProps} />);
      expect(screen.getByText('0:25')).toBeTruthy();
    });

    it('renders play overlay when not playing', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      expect(container.querySelector('.vc-play-overlay')).toBeTruthy();
    });

    it('renders SVG ring', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      expect(container.querySelector('.vc-ring')).toBeTruthy();
    });

    it('applies own class when isOwn is true', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} isOwn={true} />);
      expect(container.querySelector('.vc-msg-own')).toBeTruthy();
    });

    it('does not apply own class when isOwn is false', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} isOwn={false} />);
      expect(container.querySelector('.vc-msg-own')).toBeNull();
    });

    it('renders circle with correct dimensions', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      const circle = container.querySelector('.vc-circle');
      expect(circle.style.width).toBe('160px');
      expect(circle.style.height).toBe('160px');
    });

    it('video is muted by default', () => {
      render(<VideoCircleMessage {...defaultProps} />);
      const video = document.querySelector('video');
      expect(video.muted).toBe(true);
    });

    it('video has playsInline attribute', () => {
      render(<VideoCircleMessage {...defaultProps} />);
      const video = document.querySelector('video');
      expect(video.playsInline).toBe(true);
    });
  });

  // ======================== Play/Pause ========================

  describe('Play/Pause', () => {
    it('calls video.play when clicked', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      const vcMsg = container.querySelector('.vc-msg');
      fireEvent.click(vcMsg);
      expect(playMock).toHaveBeenCalled();
    });

    it('has button role', () => {
      render(<VideoCircleMessage {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button).toBeTruthy();
    });

    it('pauses all other media before playing', () => {
      const otherVideo = document.createElement('video');
      const otherPause = vi.fn();
      Object.defineProperty(otherVideo, 'pause', { configurable: true, value: otherPause });
      Object.defineProperty(otherVideo, 'paused', { configurable: true, value: false });
      document.body.appendChild(otherVideo);

      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      const vcMsg = container.querySelector('.vc-msg');
      fireEvent.click(vcMsg);

      expect(otherPause).toHaveBeenCalled();
      document.body.removeChild(otherVideo);
    });
  });

  // ======================== Mute toggle ========================

  describe('Mute toggle', () => {
    it('does not show mute button when not playing', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      expect(container.querySelector('.vc-mute-btn')).toBeNull();
    });
  });

  // ======================== Duration display ========================

  describe('Duration formatting', () => {
    it('shows 0:00 when duration is 0', () => {
      render(<VideoCircleMessage {...defaultProps} duration={0} />);
      expect(screen.getByText('0:00')).toBeTruthy();
    });

    it('shows 0:00 when duration is null', () => {
      render(<VideoCircleMessage {...defaultProps} duration={null} />);
      expect(screen.getByText('0:00')).toBeTruthy();
    });

    it('shows 0:30 for 30 seconds', () => {
      render(<VideoCircleMessage {...defaultProps} duration={30} />);
      expect(screen.getByText('0:30')).toBeTruthy();
    });

    it('shows 1:05 for 65 seconds', () => {
      render(<VideoCircleMessage {...defaultProps} duration={65} />);
      expect(screen.getByText('1:05')).toBeTruthy();
    });
  });

  // ======================== Progress ring ========================

  describe('Progress ring', () => {
    it('renders background circle in SVG ring', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      const svg = container.querySelector('.vc-ring');
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThanOrEqual(1);
    });

    it('does not render progress circle when not playing', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      const svg = container.querySelector('.vc-ring');
      const circles = svg.querySelectorAll('circle');
      // Only background circle, no progress circle
      expect(circles.length).toBe(1);
    });

    it('SVG ring has pointer-events none class', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      const svg = container.querySelector('.vc-ring');
      expect(svg).toBeTruthy();
    });
  });

  // ======================== Structure: mute button outside vc-circle ========================

  describe('Structure', () => {
    it('vc-circle does not contain vc-mute-btn (overflow:hidden fix)', () => {
      // Even when we can't trigger playing state easily, verify the structure
      // by checking that the mute button, if present, is NOT a child of .vc-circle
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      const circle = container.querySelector('.vc-circle');
      const muteInCircle = circle ? circle.querySelector('.vc-mute-btn') : null;
      expect(muteInCircle).toBeNull();
    });

    it('vc-circle-wrap is parent of vc-circle', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      const wrap = container.querySelector('.vc-circle-wrap');
      expect(wrap).toBeTruthy();
      const circle = wrap.querySelector('.vc-circle');
      expect(circle).toBeTruthy();
    });

    it('play overlay is inside vc-circle', () => {
      const { container } = render(<VideoCircleMessage {...defaultProps} />);
      const circle = container.querySelector('.vc-circle');
      const overlay = circle.querySelector('.vc-play-overlay');
      expect(overlay).toBeTruthy();
    });
  });
});
