import { useState, useRef, useCallback, useEffect } from 'react';
import e2eManager from '../crypto/E2EManager';
import { CallCrypto, supportsInsertableStreams } from '../crypto/CallCrypto';
import appSettings from '../utils/appSettings';

/**
 * useWebRTC – manages RTCPeerConnection, media streams and call state.
 *
 * @param {Object} opts
 * @param {React.MutableRefObject} opts.wsRef  – ref to active WebSocket
 * @param {string} opts.username               – current user
 * @param {string} opts.token                  – JWT for ICE config fetch
 * @returns call-related state + helpers
 */
export default function useWebRTC({ wsRef, username, token }) {
  // ──── state ────
  const [callState, setCallState] = useState('idle');
  // idle | outgoing | incoming | connecting | active
  const [callPeer, setCallPeer] = useState(null);
  const [callType, setCallType] = useState(null); // 'audio' | 'video'
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // refs
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const iceConfigRef = useRef(null);
  const durationTimer = useRef(null);
  const callStartedAt = useRef(null);
  const pendingCandidates = useRef([]);
  const ringtoneRef = useRef(null);
  const callCryptoRef = useRef(null);  // E2E media frame encryption

  // ──── helpers ────

  /** Fetch ICE servers config from backend (ephemeral TURN credentials, cached 1h) */
  const fetchIceConfig = useCallback(async () => {
    // Refresh HMAC credentials every hour (they have 24h TTL)
    if (iceConfigRef.current && Date.now() - iceConfigRef.current._ts < 3600_000) {
      return iceConfigRef.current;
    }
    try {
      const res = await fetch('/api/webrtc/ice-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      data._ts = Date.now();
      iceConfigRef.current = data;
      return data;
    } catch (err) {
      console.error('[WebRTC] Failed to fetch ICE config', err);
      // Fallback to public Google STUN
      return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    }
  }, [token]);

  /** Send a signaling message over WS (encrypts SDP/ICE via E2E) */
  const sendSignal = useCallback(async (type, target, payload = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const extra = { target };

    // Encrypt sensitive signaling data (SDP, ICE candidates) via E2E
    if (['CALL_OFFER', 'CALL_ANSWER', 'ICE_CANDIDATE'].includes(type) && e2eManager.isReady()) {
      try {
        const enc = await e2eManager.encrypt(target, JSON.stringify(payload), token);
        extra.sig_enc = enc.encryptedContent;
        extra.sig_iv = enc.iv;
        extra.sig_rk = enc.ratchetKey;
        extra.sig_n = String(enc.messageNumber);
        extra.sig_pn = String(enc.previousChainLength);
        if (enc.ephemeralKey) extra.sig_ek = enc.ephemeralKey;
        if (enc.senderIdentityKey) extra.sig_ik = enc.senderIdentityKey;
        if (enc.oneTimeKeyId != null) extra.sig_otk = String(enc.oneTimeKeyId);
      } catch (err) {
        console.warn('[WebRTC] Signal E2E failed, plaintext fallback:', err);
        Object.assign(extra, payload);
      }
    } else {
      Object.assign(extra, payload);
    }

    try {
      ws.send(JSON.stringify({ type, extra }));
    } catch (err) {
      console.error('[WebRTC] ws.send failed:', err);
    }
  }, [wsRef, token]);

  /** Decrypt incoming encrypted signaling payload */
  const decryptExtra = useCallback(async (msg) => {
    const extra = msg.extra || {};
    if (!extra.sig_enc || !e2eManager.isReady()) return extra;
    try {
      const enc = {
        encrypted: true,
        encryptedContent: extra.sig_enc,
        iv: extra.sig_iv,
        ratchetKey: extra.sig_rk,
        messageNumber: parseInt(extra.sig_n || '0'),
        previousChainLength: parseInt(extra.sig_pn || '0'),
      };
      if (extra.sig_ek) enc.ephemeralKey = extra.sig_ek;
      if (extra.sig_ik) enc.senderIdentityKey = extra.sig_ik;
      if (extra.sig_otk != null) enc.oneTimeKeyId = parseInt(extra.sig_otk);
      const result = await e2eManager.decrypt(msg.sender, enc);
      if (result.text) return { target: extra.target, ...JSON.parse(result.text) };
    } catch (err) {
      console.error('[WebRTC] Signal decrypt failed:', err);
    }
    return extra;
  }, []);

  /** Stop all local media tracks */
  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
  }, []);

  /** Create ringtone (oscillator beeps) */
  const startRingtone = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let stopped = false;

      const playBeep = () => {
        if (stopped) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      };

      playBeep();
      const interval = setInterval(playBeep, 2000);
      ringtoneRef.current = {
        stop: () => {
          stopped = true;
          clearInterval(interval);
          ctx.close().catch(() => {});
        },
      };
    } catch {
      ringtoneRef.current = null;
    }
  }, []);

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
  }, []);

  /** Tear down the call completely */
  const cleanup = useCallback(() => {
    stopRingtone();
    clearInterval(durationTimer.current);
    durationTimer.current = null;
    callStartedAt.current = null;
    pendingCandidates.current = [];

    // Destroy E2E media encryption
    if (callCryptoRef.current) {
      callCryptoRef.current.destroy();
      callCryptoRef.current = null;
    }

    if (pcRef.current) {
      if (typeof pcRef.current.close === 'function') {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      }
      pcRef.current = null;
    }

    stopLocalMedia();
    remoteStreamRef.current = null;

    setCallState('idle');
    setCallPeer(null);
    setCallType(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
  }, [stopLocalMedia, stopRingtone]);

  /** Build RTCPeerConnection with event handlers */
  const createPC = useCallback(async (target) => {
    const config = await fetchIceConfig();
    const pc = new RTCPeerConnection({
      ...config,
      ...(supportsInsertableStreams() && { encodedInsertableStreams: true }),
    });
    pcRef.current = pc;

    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await sendSignal('ICE_CANDIDATE', target, {
          candidate: JSON.stringify(e.candidate),
        });
      }
    };

    pc.ontrack = (e) => {
      remoteStreamRef.current = e.streams[0] || new MediaStream([e.track]);
      // Always assign to remoteVideoRef — CallScreen always renders <video> now
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      // E2E media decryption on incoming tracks
      if (callCryptoRef.current) {
        callCryptoRef.current.setupReceiverDecryption(e.receiver);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setCallState('active');
        stopRingtone();
        callStartedAt.current = Date.now();
        durationTimer.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - callStartedAt.current) / 1000));
        }, 1000);
      }
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        cleanup();
      }
    };

    return pc;
  }, [fetchIceConfig, sendSignal, stopRingtone, cleanup]);

  // ──── public API ────

  /** Start an outgoing call */
  const startCall = useCallback(async (target, type = 'audio') => {
    if (callState !== 'idle') return;

    setCallState('outgoing');
    setCallPeer(target);
    setCallType(type);
    if (appSettings.callSound) startRingtone();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // E2E media: generate per-call AES key
      let mediaKey = null;
      if (supportsInsertableStreams()) {
        const cc = new CallCrypto();
        mediaKey = await cc.generateKey();
        callCryptoRef.current = cc;
      }

      const pc = await createPC(target);
      stream.getTracks().forEach(t => {
        const sender = pc.addTrack(t, stream);
        if (callCryptoRef.current) callCryptoRef.current.setupSenderEncryption(sender);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal('CALL_OFFER', target, {
        callType: type,
        sdp: JSON.stringify(offer),
        ...(mediaKey && { mediaKey }),
      });
    } catch (err) {
      console.error('[WebRTC] startCall error:', err);
      // Provide user feedback for camera/microphone permission issues
      if (err.name === 'NotAllowedError' || err.name === 'NotFoundError' || err.name === 'NotReadableError') {
        const isVideo = type === 'video';
        const deviceName = isVideo ? 'камере' : 'микрофону';
        alert(`Нет доступа к ${deviceName}. Проверьте разрешения браузера.`);
      }
      cleanup();
    }
  }, [callState, createPC, sendSignal, startRingtone, cleanup]);

  /** Handle incoming CALL_OFFER (decrypts E2E signaling) */
  const handleOffer = useCallback(async (msg) => {
    const extra = await decryptExtra(msg);
    const from = msg.sender;
    const type = extra.callType || 'audio';

    // Mid-call renegotiation (e.g. peer toggled video on) — handle inline
    if (extra.renegotiate && pcRef.current && typeof pcRef.current.setRemoteDescription === 'function' && callState === 'active') {
      try {
        const offer = JSON.parse(extra.sdp);
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        await sendSignal('CALL_ANSWER', from, {
          sdp: JSON.stringify(answer),
          renegotiate: true,
        });

        if (type === 'video') setCallType('video');
      } catch (err) {
        console.error('[WebRTC] renegotiation error:', err);
      }
      return;
    }

    // If already in a call → send BUSY
    if (callState !== 'idle') {
      sendSignal('CALL_BUSY', from, {});
      return;
    }

    setCallState('incoming');
    setCallPeer(from);
    setCallType(type);
    if (appSettings.callSound) startRingtone();

    // Store offer SDP and peer's media key in ref for when user accepts
    pcRef.current = { _pendingOffer: extra.sdp, _from: from, _type: type, _peerMediaKey: extra.mediaKey };
  }, [callState, sendSignal, startRingtone, decryptExtra]);

  /** Accept an incoming call */
  const acceptCall = useCallback(async () => {
    if (callState !== 'incoming' || !pcRef.current?._pendingOffer) return;

    const { _pendingOffer: sdpStr, _from: from, _type: type, _peerMediaKey: peerMediaKey } = pcRef.current;
    pcRef.current = null;

    setCallState('connecting');
    stopRingtone();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // E2E media: generate key + set peer's key for decryption
      let mediaKey = null;
      if (supportsInsertableStreams()) {
        const cc = new CallCrypto();
        mediaKey = await cc.generateKey();
        if (peerMediaKey) await cc.setDecryptKey(peerMediaKey);
        callCryptoRef.current = cc;
      }

      const pc = await createPC(from);
      stream.getTracks().forEach(t => {
        const sender = pc.addTrack(t, stream);
        if (callCryptoRef.current) callCryptoRef.current.setupSenderEncryption(sender);
      });

      const offer = JSON.parse(sdpStr);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Apply any ICE candidates that arrived before remote description was set
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal('CALL_ANSWER', from, {
        sdp: JSON.stringify(answer),
        ...(mediaKey && { mediaKey }),
      });
    } catch (err) {
      console.error('[WebRTC] acceptCall error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'NotFoundError' || err.name === 'NotReadableError') {
        const isVideo = type === 'video';
        const deviceName = isVideo ? 'камере' : 'микрофону';
        alert(`Нет доступа к ${deviceName}. Проверьте разрешения браузера.`);
      }
      await sendSignal('CALL_END', from, { reason: 'error' });
      cleanup();
    }
  }, [callState, createPC, sendSignal, stopRingtone, cleanup]);

  /** Reject an incoming call */
  const rejectCall = useCallback(() => {
    if (callPeer) {
      sendSignal('CALL_REJECT', callPeer, {});
    }
    cleanup();
  }, [callPeer, sendSignal, cleanup]);

  /** Hang up (end) the call */
  const endCall = useCallback(() => {
    if (callPeer) {
      sendSignal('CALL_END', callPeer, { reason: 'hangup' });
    }
    cleanup();
  }, [callPeer, sendSignal, cleanup]);

  /** Silent cleanup — no CALL_END signal (used for conference upgrade) */
  const endCallSilent = useCallback(() => {
    cleanup();
  }, [cleanup]);

  /** Handle CALL_ANSWER from callee (decrypts E2E signaling) */
  const handleAnswer = useCallback(async (msg) => {
    const extra = await decryptExtra(msg);
    if (!extra.sdp || !pcRef.current || typeof pcRef.current.setRemoteDescription !== 'function') return;

    // E2E media: set peer's key for decryption (skip for renegotiation — key already set)
    if (!extra.renegotiate && callCryptoRef.current) {
      if (extra.mediaKey) {
        await callCryptoRef.current.setDecryptKey(extra.mediaKey);
      } else {
        callCryptoRef.current.disableEncryption();
      }
    }

    try {
      const answer = JSON.parse(extra.sdp);
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

      // Flush pending ICE candidates
      for (const c of pendingCandidates.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates.current = [];
      // Don't reset callState during mid-call renegotiation
      if (!extra.renegotiate) setCallState('connecting');
    } catch (err) {
      console.error('[WebRTC] handleAnswer error:', err);
    }
  }, [decryptExtra]);

  /** Handle remote ICE_CANDIDATE (decrypts E2E signaling) */
  const handleIceCandidate = useCallback(async (msg) => {
    const extra = await decryptExtra(msg);
    if (!extra.candidate) return;

    try {
      const candidate = JSON.parse(extra.candidate);
      const pc = pcRef.current;

      if (pc && typeof pc.addIceCandidate === 'function' && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // Queue until remote description is set
        pendingCandidates.current.push(candidate);
      }
    } catch (err) {
      console.error('[WebRTC] handleIceCandidate error:', err);
    }
  }, [decryptExtra]);

  /** Handle CALL_REJECT / CALL_END / CALL_BUSY from peer */
  const handleCallEnd = useCallback((msg) => {
    cleanup();
  }, [cleanup]);

  /** Toggle mute */
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(prev => !prev);
  }, []);

  /** Toggle video — add video track dynamically if audio-only call, or toggle existing */
  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    const pc = pcRef.current;
    if (!stream || !pc || typeof pc.addTrack !== 'function') return;

    // Only allow renegotiation when connection is established
    if (pc.connectionState !== 'connected') return;

    const existingVideoTracks = stream.getVideoTracks();

    if (existingVideoTracks.length > 0) {
      // Already have video tracks — just toggle enabled
      existingVideoTracks.forEach(t => { t.enabled = !t.enabled; });
      setIsVideoOff(prev => !prev);
    } else {
      // Audio-only call — dynamically add video track + renegotiate
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) return;

        // Add to local stream so CallScreen can display it
        stream.addTrack(videoTrack);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Add to peer connection
        const sender = pc.addTrack(videoTrack, stream);
        if (callCryptoRef.current) callCryptoRef.current.setupSenderEncryption(sender);

        // Renegotiate — create new offer and send to peer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await sendSignal('CALL_OFFER', callPeer, {
          callType: 'video',
          sdp: JSON.stringify(offer),
          renegotiate: true,
        });

        setCallType('video');
        setIsVideoOff(false);
      } catch (err) {
        console.error('[WebRTC] toggleVideo add track error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
          alert('Нет доступа к камере. Проверьте разрешения браузера.');
        }
      }
    }
  }, [sendSignal, callPeer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        if (typeof pcRef.current.close === 'function') pcRef.current.close();
      }
      if (callCryptoRef.current) {
        callCryptoRef.current.destroy();
        callCryptoRef.current = null;
      }
      stopLocalMedia();
      stopRingtone();
      clearInterval(durationTimer.current);
    };
  }, [stopLocalMedia, stopRingtone]);

  return {
    // state
    callState,
    callPeer,
    callType,
    callDuration,
    isMuted,
    isVideoOff,
    // refs (for attaching <video>)
    localVideoRef,
    remoteVideoRef,
    // actions
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    endCallSilent,
    toggleMute,
    toggleVideo,
    // signal handlers (call from ws.onmessage)
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleCallEnd,
  };
}
