/**
 * SecurityCodeModal component tests.
 * Tests rendering of security code display, unavailable state,
 * copy button, and modal behavior.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import SecurityCodeModal from '../SecurityCodeModal';

// Mock clipboard utility
vi.mock('../../utils/clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

import { copyToClipboard } from '../../utils/clipboard';

describe('SecurityCodeModal', () => {

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================== Null / Hidden State ========================

  it('returns null when no securityCode and not unavailable', () => {
    const { container } = render(
      <SecurityCodeModal
        securityCode={null}
        peerUsername="Bob"
        onClose={() => {}}
        unavailable={false}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  // ======================== Security Code Display ========================

  it('renders security code in correct format', () => {
    const code = '1234 5678 9012 3456 7890 1234';
    render(
      <SecurityCodeModal
        securityCode={code}
        peerUsername="Bob"
        onClose={() => {}}
      />
    );

    expect(screen.getByText(code)).toBeTruthy();
    expect(screen.getByText('Код безопасности')).toBeTruthy();
  });

  it('displays peer username in the description', () => {
    render(
      <SecurityCodeModal
        securityCode="1234 5678 9012 3456 7890 1234"
        peerUsername="Alice"
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText(/Сравните этот код/)).toBeTruthy();
  });

  it('shows lock icon 🔐 when code is available', () => {
    render(
      <SecurityCodeModal
        securityCode="1234 5678 9012 3456 7890 1234"
        peerUsername="Bob"
        onClose={() => {}}
      />
    );

    expect(screen.getByText('🔐')).toBeTruthy();
  });

  it('shows "Готово" and "Копировать" buttons for code view', () => {
    render(
      <SecurityCodeModal
        securityCode="1234 5678 9012 3456 7890 1234"
        peerUsername="Bob"
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Готово')).toBeTruthy();
    expect(screen.getByText('📋 Копировать')).toBeTruthy();
  });

  // ======================== Copy Functionality ========================

  it('calls copyToClipboard when copy button is clicked', () => {
    const code = '1234 5678 9012 3456 7890 1234';
    render(
      <SecurityCodeModal
        securityCode={code}
        peerUsername="Bob"
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByText('📋 Копировать'));
    expect(copyToClipboard).toHaveBeenCalledWith(code);
  });

  it('shows "✓ Скопировано" after clicking copy', () => {
    render(
      <SecurityCodeModal
        securityCode="1234 5678 9012 3456 7890 1234"
        peerUsername="Bob"
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByText('📋 Копировать'));
    expect(screen.getByText('✓ Скопировано')).toBeTruthy();
  });

  it('copy confirmation resets after 2 seconds', async () => {
    vi.useFakeTimers();
    render(
      <SecurityCodeModal
        securityCode="1234 5678 9012 3456 7890 1234"
        peerUsername="Bob"
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByText('📋 Копировать'));
    expect(screen.getByText('✓ Скопировано')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.getByText('📋 Копировать')).toBeTruthy();
    vi.useRealTimers();
  });

  // ======================== Unavailable State ========================

  it('renders unavailable state with unlock icon 🔓', () => {
    render(
      <SecurityCodeModal
        securityCode={null}
        peerUsername="Bob"
        onClose={() => {}}
        unavailable={true}
      />
    );

    expect(screen.getByText('🔓')).toBeTruthy();
    expect(screen.getByText('E2E шифрование')).toBeTruthy();
  });

  it('shows explanation text in unavailable state', () => {
    render(
      <SecurityCodeModal
        securityCode={null}
        peerUsername="Charlie"
        onClose={() => {}}
        unavailable={true}
      />
    );

    expect(screen.getByText('Charlie')).toBeTruthy();
    expect(screen.getByText(/пока недоступно/)).toBeTruthy();
    expect(screen.getByText(/Для активации E2E/)).toBeTruthy();
  });

  it('shows "Понятно" button in unavailable state', () => {
    render(
      <SecurityCodeModal
        securityCode={null}
        peerUsername="Bob"
        onClose={() => {}}
        unavailable={true}
      />
    );

    expect(screen.getByText('Понятно')).toBeTruthy();
  });

  it('does NOT show copy button in unavailable state', () => {
    render(
      <SecurityCodeModal
        securityCode={null}
        peerUsername="Bob"
        onClose={() => {}}
        unavailable={true}
      />
    );

    expect(screen.queryByText('📋 Копировать')).toBeNull();
  });

  // ======================== Close Behavior ========================

  it('calls onClose when "Готово" is clicked', () => {
    const onClose = vi.fn();
    render(
      <SecurityCodeModal
        securityCode="1234 5678 9012 3456 7890 1234"
        peerUsername="Bob"
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('Готово'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when "Понятно" is clicked in unavailable state', () => {
    const onClose = vi.fn();
    render(
      <SecurityCodeModal
        securityCode={null}
        peerUsername="Bob"
        onClose={onClose}
        unavailable={true}
      />
    );

    fireEvent.click(screen.getByText('Понятно'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SecurityCodeModal
        securityCode="1234 5678 9012 3456 7890 1234"
        peerUsername="Bob"
        onClose={onClose}
      />
    );

    // Click the overlay (outermost div with modal-overlay class)
    const overlay = container.querySelector('.modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside the modal', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SecurityCodeModal
        securityCode="1234 5678 9012 3456 7890 1234"
        peerUsername="Bob"
        onClose={onClose}
      />
    );

    // Click inside the modal content (stopPropagation should prevent close)
    const modal = container.querySelector('.security-code-modal');
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });
});
