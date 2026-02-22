/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CallScreen from '../CallScreen';

describe('CallScreen', () => {
  const defaultProps = {
    callState: 'active',
    callPeer: 'bob',
    callType: 'audio',
    callDuration: 65,
    isMuted: false,
    isVideoOff: false,
    avatarUrl: '',
    localVideoRef: { current: null },
    remoteVideoRef: { current: null },
    onEndCall: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleVideo: vi.fn(),
  };

  afterEach(() => cleanup());

  it('renders peer name', () => {
    render(<CallScreen {...defaultProps} />);
    expect(screen.getByText('bob')).toBeTruthy();
  });

  it('shows formatted duration for active call', () => {
    render(<CallScreen {...defaultProps} callDuration={125} />);
    expect(screen.getByText('02:05')).toBeTruthy();
  });

  it('shows "Вызываем..." for outgoing call', () => {
    render(<CallScreen {...defaultProps} callState="outgoing" />);
    expect(screen.getByText('Вызываем...')).toBeTruthy();
  });

  it('shows "Подключение..." for connecting call', () => {
    render(<CallScreen {...defaultProps} callState="connecting" />);
    expect(screen.getByText('Подключение...')).toBeTruthy();
  });

  it('calls onEndCall when hangup clicked', () => {
    const onEndCall = vi.fn();
    render(<CallScreen {...defaultProps} onEndCall={onEndCall} />);
    fireEvent.click(screen.getByTitle('Завершить звонок'));
    expect(onEndCall).toHaveBeenCalledOnce();
  });

  it('calls onToggleMute when mute button clicked', () => {
    const onToggleMute = vi.fn();
    render(<CallScreen {...defaultProps} onToggleMute={onToggleMute} />);
    const muteBtn = screen.getByTitle('Выключить микрофон');
    fireEvent.click(muteBtn);
    expect(onToggleMute).toHaveBeenCalledOnce();
  });

  it('shows muted icon when isMuted', () => {
    render(<CallScreen {...defaultProps} isMuted={true} />);
    expect(screen.getByTitle('Включить микрофон')).toBeTruthy();
  });

  it('audio call shows avatar, not video elements', () => {
    const { container } = render(<CallScreen {...defaultProps} callType="audio" />);
    expect(container.querySelector('.call-audio-center')).toBeTruthy();
    expect(container.querySelector('.call-remote-video')).toBeFalsy();
  });

  it('video call shows video elements', () => {
    const { container } = render(<CallScreen {...defaultProps} callType="video" />);
    expect(container.querySelector('.call-remote-video')).toBeTruthy();
    expect(container.querySelector('.call-local-video')).toBeTruthy();
  });

  it('video call shows toggle video button', () => {
    render(<CallScreen {...defaultProps} callType="video" />);
    expect(screen.getByTitle('Выключить камеру')).toBeTruthy();
  });

  it('audio call does NOT show toggle video button', () => {
    render(<CallScreen {...defaultProps} callType="audio" />);
    expect(screen.queryByTitle('Выключить камеру')).toBeNull();
  });

  it('shows avatar placeholder when no avatarUrl (audio)', () => {
    const { container } = render(<CallScreen {...defaultProps} callType="audio" avatarUrl="" />);
    expect(container.querySelector('.call-peer-avatar-placeholder')).toBeTruthy();
  });

  it('shows avatar image when avatarUrl provided (audio)', () => {
    const { container } = render(<CallScreen {...defaultProps} callType="audio" avatarUrl="/avatar.jpg" />);
    const img = container.querySelector('.call-peer-avatar-img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/avatar.jpg');
  });

  it('video call shows toggle video with camera-off icon when video is off', () => {
    render(<CallScreen {...defaultProps} callType="video" isVideoOff={true} />);
    expect(screen.getByTitle('Включить камеру')).toBeTruthy();
  });

  it('calls onToggleVideo when video button clicked', () => {
    const onToggleVideo = vi.fn();
    render(<CallScreen {...defaultProps} callType="video" onToggleVideo={onToggleVideo} />);
    fireEvent.click(screen.getByTitle('Выключить камеру'));
    expect(onToggleVideo).toHaveBeenCalledOnce();
  });

  it('audio call renders hidden <audio> element for remote playback', () => {
    const { container } = render(<CallScreen {...defaultProps} callType="audio" />);
    const audioEl = container.querySelector('audio');
    expect(audioEl).toBeTruthy();
    expect(audioEl.autoplay).toBe(true);
  });

  it('audio call assigns remoteVideoRef to audio element', () => {
    const remoteVideoRef = { current: null };
    render(<CallScreen {...defaultProps} callType="audio" remoteVideoRef={remoteVideoRef} />);
    expect(remoteVideoRef.current).toBeTruthy();
    expect(remoteVideoRef.current.tagName).toBe('AUDIO');
  });

  it('video call assigns remoteVideoRef to video element', () => {
    const remoteVideoRef = { current: null };
    render(<CallScreen {...defaultProps} callType="video" remoteVideoRef={remoteVideoRef} />);
    expect(remoteVideoRef.current).toBeTruthy();
    expect(remoteVideoRef.current.tagName).toBe('VIDEO');
  });

  // === Bug 5: Security code display ===

  it('does NOT show security code when securityCode is null', () => {
    const { container } = render(<CallScreen {...defaultProps} securityCode={null} />);
    expect(container.querySelector('.call-security-code')).toBeNull();
  });

  it('does NOT show security code when securityCode is undefined', () => {
    const { container } = render(<CallScreen {...defaultProps} />);
    expect(container.querySelector('.call-security-code')).toBeNull();
  });

  it('does NOT show security code when callState is not active', () => {
    const { container } = render(
      <CallScreen {...defaultProps} callState="outgoing" securityCode="1234 5678" />
    );
    expect(container.querySelector('.call-security-code')).toBeNull();
  });

  it('does NOT show security code when callState is connecting', () => {
    const { container } = render(
      <CallScreen {...defaultProps} callState="connecting" securityCode="1234 5678" />
    );
    expect(container.querySelector('.call-security-code')).toBeNull();
  });

  it('shows security code when callState is active and securityCode provided', () => {
    const { container } = render(
      <CallScreen {...defaultProps} callState="active" securityCode="1234 5678" />
    );
    const codeEl = container.querySelector('.call-security-code');
    expect(codeEl).toBeTruthy();
    expect(container.querySelector('.call-security-digits').textContent).toBe('1234 5678');
  });

  it('shows lock icon and label in security code', () => {
    const { container } = render(
      <CallScreen {...defaultProps} callState="active" securityCode="9999 0000" />
    );
    expect(container.querySelector('.call-security-icon').textContent).toBe('🔒');
    expect(container.querySelector('.call-security-label').textContent).toBe('Код безопасности');
  });

  it('shows security code for video calls too', () => {
    const { container } = render(
      <CallScreen {...defaultProps} callType="video" callState="active" securityCode="ABCD 1234" />
    );
    expect(container.querySelector('.call-security-code')).toBeTruthy();
    expect(container.querySelector('.call-security-digits').textContent).toBe('ABCD 1234');
  });
});
