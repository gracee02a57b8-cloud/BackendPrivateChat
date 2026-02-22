import { useState, useRef, useCallback, useEffect } from 'react';

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

  // ──── helpers ────

  /** Fetch ICE servers config from backend */
  const fetchIceConfig = useCallback(async () => {
    if (iceConfigRef.current) return iceConfigRef.current;
    try {
      const res = await fetch('/api/webrtc/ice-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      iceConfigRef.current = data;
      return data;
    } catch (err) {
      console.error('[WebRTC] Failed to fetch ICE config', err);
      // Fallback to public Google STUN
      return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    }
  }, [token]);

  /** Send a signaling message over WS */
  const sendSignal = useCallback((type, target, payload = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type,
      extra: { target, ...payload },
    }));
  }, [wsRef]);

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

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
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
    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal('ICE_CANDIDATE', target, {
          candidate: JSON.stringify(e.candidate),
        });
      }
    };

    pc.ontrack = (e) => {
      remoteStreamRef.current = e.streams[0] || new MediaStream([e.track]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      } else {
        // Fallback for audio-only calls if CallScreen hasn't mounted yet
        const audio = document.createElement('audio');
        audio.srcObject = remoteStreamRef.current;
        audio.autoplay = true;
        audio.play().catch(() => {});
        remoteVideoRef.current = audio;
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
    startRingtone();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = await createPC(target);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignal('CALL_OFFER', target, {
        callType: type,
        sdp: JSON.stringify(offer),
      });
    } catch (err) {
      console.error('[WebRTC] startCall error:', err);
      cleanup();
    }
  }, [callState, createPC, sendSignal, startRingtone, cleanup]);

  /** Handle incoming CALL_OFFER */
  const handleOffer = useCallback(async (msg) => {
    const from = msg.sender;
    const extra = msg.extra || {};
    const type = extra.callType || 'audio';

    // If already in a call → send BUSY
    if (callState !== 'idle') {
      sendSignal('CALL_BUSY', from, {});
      return;
    }

    setCallState('incoming');
    setCallPeer(from);
    setCallType(type);
    startRingtone();

    // Store offer SDP in ref for when user accepts
    pcRef.current = { _pendingOffer: extra.sdp, _from: from, _type: type };
  }, [callState, sendSignal, startRingtone]);

  /** Accept an incoming call */
  const acceptCall = useCallback(async () => {
    if (callState !== 'incoming' || !pcRef.current?._pendingOffer) return;

    const { _pendingOffer: sdpStr, _from: from, _type: type } = pcRef.current;
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

      const pc = await createPC(from);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = JSON.parse(sdpStr);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Apply any ICE candidates that arrived before remote description was set
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignal('CALL_ANSWER', from, {
        sdp: JSON.stringify(answer),
      });
    } catch (err) {
      console.error('[WebRTC] acceptCall error:', err);
      sendSignal('CALL_END', from, { reason: 'error' });
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

  /** Handle CALL_ANSWER from callee */
  const handleAnswer = useCallback(async (msg) => {
    const extra = msg.extra || {};
    if (!extra.sdp || !pcRef.current || typeof pcRef.current.setRemoteDescription !== 'function') return;

    try {
      const answer = JSON.parse(extra.sdp);
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

      // Flush pending ICE candidates
      for (const c of pendingCandidates.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates.current = [];
      setCallState('connecting');
    } catch (err) {
      console.error('[WebRTC] handleAnswer error:', err);
    }
  }, []);

  /** Handle remote ICE_CANDIDATE */
  const handleIceCandidate = useCallback(async (msg) => {
    const extra = msg.extra || {};
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
  }, []);

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

  /** Toggle video */
  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsVideoOff(prev => !prev);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        if (typeof pcRef.current.close === 'function') pcRef.current.close();
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
    toggleMute,
    toggleVideo,
    // signal handlers (call from ws.onmessage)
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleCallEnd,
  };
}
