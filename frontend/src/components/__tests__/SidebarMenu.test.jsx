/**
 * @vitest-environment jsdom
 *
 * Tests for Sidebar three-dot menu click-outside close behavior (Bug 3).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import Sidebar from '../Sidebar';

describe('Sidebar — Three-dot menu click-outside (Bug 3)', () => {
  const minimalProps = {
    rooms: [],
    activeRoomId: null,
    onSelectRoom: vi.fn(),
    onlineUsers: [],
    allUsers: [],
    username: 'testuser',
    connected: true,
    onLogout: vi.fn(),
    onStartPrivateChat: vi.fn(),
    onCreateRoom: vi.fn(),
    onJoinRoom: vi.fn(),
    onDeleteRoom: vi.fn(),
    onShowNews: vi.fn(),
    onShowTasks: vi.fn(),
    token: 'test-token',
    unreadCounts: {},
    messagesByRoom: {},
    sidebarOpen: true,
    onCloseSidebar: vi.fn(),
    avatarMap: {},
    avatarUrl: '',
    wsRef: { current: null },
    onAvatarChange: vi.fn(),
  };

  afterEach(() => cleanup());

  it('opens menu dropdown when three-dot button clicked', () => {
    const { container } = render(<Sidebar {...minimalProps} />);

    // Menu dropdown should not exist initially
    expect(container.querySelector('.sb-menu-dropdown')).toBeNull();

    // Click three-dot button
    fireEvent.click(screen.getByText('⋮'));

    // Menu dropdown should appear
    expect(container.querySelector('.sb-menu-dropdown')).toBeTruthy();
  });

  it('closes menu when clicking outside the dropdown', () => {
    const { container } = render(<Sidebar {...minimalProps} />);

    // Open menu
    fireEvent.click(screen.getByText('⋮'));
    expect(container.querySelector('.sb-menu-dropdown')).toBeTruthy();

    // Click outside the dropdown (on the sidebar body area)
    act(() => {
      fireEvent.mouseDown(document.body);
    });

    // Menu dropdown should be closed
    expect(container.querySelector('.sb-menu-dropdown')).toBeNull();
  });

  it('does NOT close menu when clicking inside the dropdown', () => {
    const { container } = render(<Sidebar {...minimalProps} />);

    // Open menu
    fireEvent.click(screen.getByText('⋮'));
    const dropdown = container.querySelector('.sb-menu-dropdown');
    expect(dropdown).toBeTruthy();

    // Click inside the dropdown
    act(() => {
      fireEvent.mouseDown(dropdown);
    });

    // Menu should still be open
    expect(container.querySelector('.sb-menu-dropdown')).toBeTruthy();
  });

  it('closes menu when a menu item is clicked', () => {
    const { container } = render(<Sidebar {...minimalProps} />);

    // Open menu
    fireEvent.click(screen.getByText('⋮'));
    expect(container.querySelector('.sb-menu-dropdown')).toBeTruthy();

    // Click "Выйти" (Logout) menu item
    fireEvent.click(screen.getByText('🚪 Выйти'));

    // Menu should close and logout should be called
    expect(container.querySelector('.sb-menu-dropdown')).toBeNull();
    expect(minimalProps.onLogout).toHaveBeenCalled();
  });

  it('toggles menu with repeated three-dot clicks', () => {
    const { container } = render(<Sidebar {...minimalProps} />);

    // First click: open
    fireEvent.click(screen.getByText('⋮'));
    expect(container.querySelector('.sb-menu-dropdown')).toBeTruthy();

    // Second click: close
    fireEvent.click(screen.getByText('⋮'));
    expect(container.querySelector('.sb-menu-dropdown')).toBeNull();

    // Third click: open again
    fireEvent.click(screen.getByText('⋮'));
    expect(container.querySelector('.sb-menu-dropdown')).toBeTruthy();
  });
});
