/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import IncomingCallModal from '../IncomingCallModal';

describe('IncomingCallModal', () => {
  const defaultProps = {
    caller: 'bob',
    callType: 'audio',
    avatarUrl: '',
    onAccept: vi.fn(),
    onReject: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders caller name', () => {
    render(<IncomingCallModal {...defaultProps} />);
    expect(screen.getByText('bob')).toBeTruthy();
  });

  it('shows "Аудиозвонок" for audio calls', () => {
    render(<IncomingCallModal {...defaultProps} callType="audio" />);
    expect(screen.getByText('Аудиозвонок')).toBeTruthy();
  });

  it('shows "Видеозвонок" for video calls', () => {
    render(<IncomingCallModal {...defaultProps} callType="video" />);
    expect(screen.getByText('Видеозвонок')).toBeTruthy();
  });

  it('calls onAccept when accept button clicked', () => {
    const onAccept = vi.fn();
    render(<IncomingCallModal {...defaultProps} onAccept={onAccept} />);
    fireEvent.click(screen.getByTitle('Принять'));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('calls onReject when reject button clicked', () => {
    const onReject = vi.fn();
    render(<IncomingCallModal {...defaultProps} onReject={onReject} />);
    fireEvent.click(screen.getByTitle('Отклонить'));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('auto-rejects after 30 seconds', () => {
    const onReject = vi.fn();
    render(<IncomingCallModal {...defaultProps} onReject={onReject} />);
    expect(onReject).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(30000));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('renders avatar image when avatarUrl provided', () => {
    render(<IncomingCallModal {...defaultProps} avatarUrl="/avatar.jpg" />);
    const img = document.querySelector('.incoming-call-avatar-img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/avatar.jpg');
  });

  it('renders avatar placeholder when no avatarUrl', () => {
    render(<IncomingCallModal {...defaultProps} avatarUrl="" />);
    const placeholder = document.querySelector('.incoming-call-avatar-placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder.textContent).toBe('B');
  });

  it('shows phone icon for audio calls', () => {
    render(<IncomingCallModal {...defaultProps} callType="audio" />);
    const icon = document.querySelector('.incoming-call-icon');
    expect(icon).toBeTruthy();
    expect(icon.textContent).toBe('📞');
  });

  it('shows camera icon for video calls', () => {
    render(<IncomingCallModal {...defaultProps} callType="video" />);
    const icon = document.querySelector('.incoming-call-icon');
    expect(icon).toBeTruthy();
    expect(icon.textContent).toBe('📹');
  });
});
