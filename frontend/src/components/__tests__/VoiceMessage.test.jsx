/**
 * VoiceMessage component tests.
 * Tests rendering, waveform visualization, play/pause logic,
 * speed toggle, seek, progress display.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import VoiceMessage from '../VoiceMessage';

// Mock HTMLMediaElement methods globally
const playMock = vi.fn(() => Promise.resolve());
const pauseMock = vi.fn();

beforeEach(() => {
  // Patch play/pause on the prototype so all audio elements get it
  Object.defineProperty(HTMLAudioElement.prototype, 'play', {
    configurable: true,
    value: playMock,
  });
  Object.defineProperty(HTMLAudioElement.prototype, 'pause', {
    configurable: true,
    value: pauseMock,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const defaultProps = {
  fileUrl: '/uploads/voice_test.webm',
  duration: 15,
  waveformData: JSON.stringify([0.1, 0.3, 0.5, 0.8, 0.4, 0.2, 0.6, 0.9, 0.3, 0.7]),
  isOwn: false,
};

describe('VoiceMessage', () => {

  // ======================== Rendering ========================

  describe('Rendering', () => {
    it('renders play button', () => {
      render(<VoiceMessage {...defaultProps} />);
      const playBtn = screen.getByTitle('Воспроизвести');
      expect(playBtn).toBeTruthy();
    });

    it('renders correct number of waveform bars', () => {
      render(<VoiceMessage {...defaultProps} />);
      const bars = document.querySelectorAll('.voice-bar');
      expect(bars.length).toBe(10);
    });

    it('renders waveform bars with default data when waveformData is invalid', () => {
      render(<VoiceMessage {...defaultProps} waveformData="invalid-json" />);
      const bars = document.querySelectorAll('.voice-bar');
      expect(bars.length).toBe(48); // default 48 bars
    });

    it('renders waveform bars with default data when waveformData is null', () => {
      render(<VoiceMessage {...defaultProps} waveformData={null} />);
      const bars = document.querySelectorAll('.voice-bar');
      expect(bars.length).toBe(48);
    });

    it('renders duration label', () => {
      render(<VoiceMessage {...defaultProps} />);
      // 15 seconds = "0:15"
      expect(screen.getByText('0:15')).toBeTruthy();
    });

    it('renders duration for minutes', () => {
      render(<VoiceMessage {...defaultProps} duration={125} />);
      // 125 seconds = "2:05"
      expect(screen.getByText('2:05')).toBeTruthy();
    });

    it('applies own class when isOwn is true', () => {
      const { container } = render(<VoiceMessage {...defaultProps} isOwn={true} />);
      expect(container.querySelector('.voice-msg-own')).toBeTruthy();
    });

    it('does not apply own class when isOwn is false', () => {
      const { container } = render(<VoiceMessage {...defaultProps} isOwn={false} />);
      expect(container.querySelector('.voice-msg-own')).toBeNull();
    });

    it('renders audio element with correct src', () => {
      render(<VoiceMessage {...defaultProps} />);
      const audio = document.querySelector('audio');
      expect(audio).toBeTruthy();
      expect(audio.src).toContain('voice_test.webm');
    });
  });

  // ======================== Waveform bars height ========================

  describe('Waveform bar heights', () => {
    it('sets bar heights based on waveform data', () => {
      render(<VoiceMessage {...defaultProps} />);
      const bars = document.querySelectorAll('.voice-bar');
      // First bar: Math.max(3, 0.1 * 28) = 3px (min)
      expect(bars[0].style.height).toBe('3px');
      // Fourth bar: Math.max(3, 0.8 * 28) ≈ 22.4px (floating point)
      expect(parseFloat(bars[3].style.height)).toBeCloseTo(22.4, 1);
      // Eighth bar: Math.max(3, 0.9 * 28) ≈ 25.2px
      expect(parseFloat(bars[7].style.height)).toBeCloseTo(25.2, 1);
    });

    it('enforces minimum height of 3px', () => {
      render(<VoiceMessage {...defaultProps} waveformData={JSON.stringify([0, 0, 0])} />);
      const bars = document.querySelectorAll('.voice-bar');
      bars.forEach(bar => {
        expect(parseFloat(bar.style.height)).toBeGreaterThanOrEqual(3);
      });
    });
  });

  // ======================== Waveform accepts array directly ========================

  describe('Waveform data parsing', () => {
    it('accepts array directly instead of JSON string', () => {
      render(<VoiceMessage {...defaultProps} waveformData={[0.5, 0.7, 0.3]} />);
      const bars = document.querySelectorAll('.voice-bar');
      expect(bars.length).toBe(3);
    });
  });

  // ======================== Play/Pause ========================

  describe('Play/Pause', () => {
    it('shows play icon initially', () => {
      render(<VoiceMessage {...defaultProps} />);
      expect(screen.getByTitle('Воспроизвести')).toBeTruthy();
    });

    it('calls audio.play on play button click', () => {
      render(<VoiceMessage {...defaultProps} />);
      const playBtn = screen.getByTitle('Воспроизвести');
      fireEvent.click(playBtn);
      expect(playMock).toHaveBeenCalled();
    });

    it('pauses all other audio elements before playing', () => {
      // Create another audio element with paused = false
      const otherAudio = document.createElement('audio');
      const otherPause = vi.fn();
      Object.defineProperty(otherAudio, 'pause', { configurable: true, value: otherPause });
      Object.defineProperty(otherAudio, 'paused', { configurable: true, value: false });
      document.body.appendChild(otherAudio);

      render(<VoiceMessage {...defaultProps} />);
      const playBtn = screen.getByTitle('Воспроизвести');
      fireEvent.click(playBtn);

      expect(otherPause).toHaveBeenCalled();
      document.body.removeChild(otherAudio);
    });
  });

  // ======================== Speed toggle ========================

  describe('Speed toggle', () => {
    it('does not show speed button before playing', () => {
      render(<VoiceMessage {...defaultProps} />);
      expect(screen.queryByTitle('Скорость')).toBeNull();
    });
  });

  // ======================== Slider accessibility ========================

  describe('Accessibility', () => {
    it('waveform has slider role', () => {
      render(<VoiceMessage {...defaultProps} />);
      const slider = screen.getByRole('slider');
      expect(slider).toBeTruthy();
    });

    it('waveform has aria-label', () => {
      render(<VoiceMessage {...defaultProps} />);
      const slider = screen.getByRole('slider');
      expect(slider.getAttribute('aria-label')).toBe('Прогресс воспроизведения');
    });

    it('waveform has aria-valuemin and aria-valuemax', () => {
      render(<VoiceMessage {...defaultProps} />);
      const slider = screen.getByRole('slider');
      expect(slider.getAttribute('aria-valuemin')).toBe('0');
      expect(slider.getAttribute('aria-valuemax')).toBe('100');
    });

    it('waveform has aria-valuenow = 0 initially', () => {
      render(<VoiceMessage {...defaultProps} />);
      const slider = screen.getByRole('slider');
      expect(slider.getAttribute('aria-valuenow')).toBe('0');
    });
  });

  // ======================== Duration display ========================

  describe('Duration formatting', () => {
    it('shows 0:00 when duration is 0', () => {
      render(<VoiceMessage {...defaultProps} duration={0} />);
      expect(screen.getByText('0:00')).toBeTruthy();
    });

    it('shows 0:00 when duration is null', () => {
      render(<VoiceMessage {...defaultProps} duration={null} />);
      expect(screen.getByText('0:00')).toBeTruthy();
    });

    it('shows 5:00 for 300 seconds', () => {
      render(<VoiceMessage {...defaultProps} duration={300} />);
      expect(screen.getByText('5:00')).toBeTruthy();
    });

    it('shows 1:30 for 90 seconds', () => {
      render(<VoiceMessage {...defaultProps} duration={90} />);
      expect(screen.getByText('1:30')).toBeTruthy();
    });
  });

  // ======================== No filled bars initially ========================

  describe('Progress visualization', () => {
    it('no bars are filled initially', () => {
      render(<VoiceMessage {...defaultProps} />);
      const filledBars = document.querySelectorAll('.voice-bar-filled');
      expect(filledBars.length).toBe(0);
    });

    it('no active bar initially', () => {
      render(<VoiceMessage {...defaultProps} />);
      const activeBars = document.querySelectorAll('.voice-bar-active');
      expect(activeBars.length).toBe(0);
    });
  });
});
