/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import MessageNotificationPopup from '../MessageNotificationPopup';

describe('MessageNotificationPopup', () => {
  const defaultNotification = {
    sender: 'alice',
    roomName: 'Dev Room',
    content: 'Hello world!',
    roomId: 'room-1',
    avatarUrl: '',
  };

  const defaultProps = {
    notification: defaultNotification,
    onClose: vi.fn(),
    onGoToRoom: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('returns null when notification is null', () => {
    const { container } = render(
      <MessageNotificationPopup notification={null} onClose={vi.fn()} onGoToRoom={vi.fn()} />
    );
    expect(container.querySelector('.msg-notification-popup')).toBeNull();
  });

  it('renders sender name', () => {
    render(<MessageNotificationPopup {...defaultProps} />);
    expect(screen.getByText('alice')).toBeTruthy();
  });

  it('renders room name', () => {
    render(<MessageNotificationPopup {...defaultProps} />);
    expect(screen.getByText('Dev Room')).toBeTruthy();
  });

  it('renders message content', () => {
    render(<MessageNotificationPopup {...defaultProps} />);
    expect(screen.getByText('Hello world!')).toBeTruthy();
  });

  it('shows avatar placeholder when no avatarUrl', () => {
    const { container } = render(<MessageNotificationPopup {...defaultProps} />);
    const avatar = container.querySelector('.msg-notification-avatar');
    expect(avatar).toBeTruthy();
    // Should show first letter of sender
    expect(avatar.textContent).toBe('A');
  });

  it('shows avatar image when avatarUrl provided', () => {
    const notification = { ...defaultNotification, avatarUrl: '/avatar.jpg' };
    const { container } = render(
      <MessageNotificationPopup {...defaultProps} notification={notification} />
    );
    const img = container.querySelector('.msg-notification-avatar-img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/avatar.jpg');
  });

  it('truncates content at 100 characters', () => {
    const longContent = 'A'.repeat(150);
    const notification = { ...defaultNotification, content: longContent };
    const { container } = render(
      <MessageNotificationPopup {...defaultProps} notification={notification} />
    );
    const contentEl = container.querySelector('.msg-notification-content');
    // 100 chars + ellipsis
    expect(contentEl.textContent).toBe('A'.repeat(100) + '…');
  });

  it('does NOT truncate content under 100 characters', () => {
    const shortContent = 'Short message';
    const notification = { ...defaultNotification, content: shortContent };
    render(<MessageNotificationPopup {...defaultProps} notification={notification} />);
    expect(screen.getByText('Short message')).toBeTruthy();
  });

  it('calls onClose after 4 seconds (auto-dismiss)', () => {
    const onClose = vi.fn();
    render(<MessageNotificationPopup {...defaultProps} onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose before 4 seconds', () => {
    const onClose = vi.fn();
    render(<MessageNotificationPopup {...defaultProps} onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(3999);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onGoToRoom with roomId when popup clicked', () => {
    const onGoToRoom = vi.fn();
    const { container } = render(
      <MessageNotificationPopup {...defaultProps} onGoToRoom={onGoToRoom} />
    );
    fireEvent.click(container.querySelector('.msg-notification-popup'));
    expect(onGoToRoom).toHaveBeenCalledWith('room-1');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<MessageNotificationPopup {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('close button does NOT trigger onGoToRoom (stopPropagation)', () => {
    const onGoToRoom = vi.fn();
    const onClose = vi.fn();
    render(
      <MessageNotificationPopup {...defaultProps} onClose={onClose} onGoToRoom={onGoToRoom} />
    );
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onGoToRoom).not.toHaveBeenCalled();
  });

  it('clears timeout on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <MessageNotificationPopup {...defaultProps} onClose={onClose} />
    );
    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // onClose should not be called after unmount
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders avatar background color when no avatarUrl', () => {
    const { container } = render(<MessageNotificationPopup {...defaultProps} />);
    const avatar = container.querySelector('.msg-notification-avatar');
    // Should have a non-transparent background color
    expect(avatar.style.background).not.toBe('transparent');
  });

  it('renders transparent avatar background when avatarUrl provided', () => {
    const notification = { ...defaultNotification, avatarUrl: '/avatar.png' };
    const { container } = render(
      <MessageNotificationPopup {...defaultProps} notification={notification} />
    );
    const avatar = container.querySelector('.msg-notification-avatar');
    expect(avatar.style.background).toBe('transparent');
  });
});
