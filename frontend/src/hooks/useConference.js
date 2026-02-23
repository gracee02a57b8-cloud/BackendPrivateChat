import { useState, useRef, useCallback, useEffect } from 'react';
import e2eManager from '../crypto/E2EManager';
import { ConferenceCrypto, supportsInsertableStreams } from '../crypto/ConferenceCrypto';

/**
 * useConference — full-mesh multi-peer conference call management.
 *
 * Each participant maintains a separate RTCPeerConnection to every other peer.
 * When a new user joins, existing participants send CONF_OFFER to the newcomer,
 * who responds with CONF_ANSWER to each. ICE candidates are relayed via CONF_ICE.
 *
 * @param {Object} opts
 * @param {React.MutableRefObject} opts.wsRef - ref to active WebSocket
 * @param {string} opts.username - current user
 * @param {string} opts.token - JWT token
 * @returns conference state + helpers
 */
export default function useConference({ wsRef, username, token }) {
  // ──── state ────
  const [confState, setConfState] = useState('idle');
  // idle | joining | active
  const [confId, setConfId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [confDuration, setConfDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [confType, setConfType] = useState('audio'); // 'audio' | 'video'

  // refs
  const peersRef = useRef(new Map()); // Map<peerId, { pc, remoteStream }>
  const localStreamRef = useRef(null);
  const remoteStreamsRef = useRef(new Map()); // Map<peerId, MediaStream>
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map()); // Map<peerId, HTMLVideoElement>
  const iceConfigRef = useRef(null);
  const durationTimer = useRef(null);
  const confStartedAt = useRef(null);
  const confIdRef = useRef(null);
  const confCryptoRef = useRef(null); // ConferenceCrypto instance

  // Keep confId ref in sync
  useEffect(() => { confIdRef.current = confId; }, [confId]);

  // ──── helpers ────

  /** Fetch ICE config */
  const fetchIceConfig = useCallback(async () => {
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
    } catch {
      return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    }
  }, [token]);

  /** Send conference signaling via WS */
  const sendConfSignal = useCallback(async (type, target, payload = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const extra = { target, confId: confIdRef.current, ...payload };

    // Encrypt signaling via E2E
    if (['CONF_OFFER', 'CONF_ANSWER', 'CONF_ICE'].includes(type) && e2eManager.isReady()) {
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
        // Remove plaintext payload keys from extra (they're now encrypted)
        delete extra.sdp;
        delete extra.candidate;
        delete extra.mediaKey;
        delete extra.callType;
      } catch (err) {
        console.warn('[Conference] Signal E2E failed, plaintext fallback:', err);
      }
    }

    try {
      ws.send(JSON.stringify({ type, extra }));
    } catch (err) {
      console.error('[Conference] ws.send failed:', err);
    }
  }, [wsRef, token]);

  /** Decrypt incoming conference signaling */
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
      if (result.text) return { ...extra, ...JSON.parse(result.text) };
    } catch (err) {
      console.error('[Conference] Signal decrypt failed:', err);
    }
    return extra;
  }, []);

  /** Stop all local media */
  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
  }, []);

  /** Clean up everything */
  const cleanup = useCallback(() => {
    clearInterval(durationTimer.current);
    durationTimer.current = null;
    confStartedAt.current = null;

    // Destroy all peer connections
    for (const [, peer] of peersRef.current) {
      if (peer.pc && typeof peer.pc.close === 'function') {
        peer.pc.ontrack = null;
        peer.pc.onicecandidate = null;
        peer.pc.onconnectionstatechange = null;
        peer.pc.close();
      }
    }
    peersRef.current.clear();
    remoteStreamsRef.current.clear();
    remoteVideoRefs.current.clear();

    // Destroy conference crypto
    if (confCryptoRef.current) {
      confCryptoRef.current.destroy();
      confCryptoRef.current = null;
    }

    stopLocalMedia();

    setConfState('idle');
    setConfId(null);
    setParticipants([]);
    setConfDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
  }, [stopLocalMedia]);

  /** Create a PeerConnection for a specific peer */
  const createPeerConnection = useCallback(async (peerId) => {
    const config = await fetchIceConfig();
    const pc = new RTCPeerConnection({
      ...config,
      ...(supportsInsertableStreams() && { encodedInsertableStreams: true }),
    });

    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await sendConfSignal('CONF_ICE', peerId, {
          candidate: JSON.stringify(e.candidate),
        });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      remoteStreamsRef.current.set(peerId, stream);

      // Attach to video element if available
      const videoEl = remoteVideoRefs.current.get(peerId);
      if (videoEl) videoEl.srcObject = stream;

      // E2E media decryption for this peer
      if (confCryptoRef.current) {
        confCryptoRef.current.setupReceiverDecryption(e.receiver, peerId);
      }

      // Force re-render by updating participants
      setParticipants(prev => [...prev]);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        // Start duration timer when first peer connects
        if (!confStartedAt.current) {
          confStartedAt.current = Date.now();
          durationTimer.current = setInterval(() => {
            setConfDuration(Math.floor((Date.now() - confStartedAt.current) / 1000));
          }, 1000);
        }
        setConfState('active');
      }
      if (state === 'disconnected' || state === 'failed') {
        // Remove this peer
        removePeer(peerId);
      }
    };

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => {
        const sender = pc.addTrack(t, localStreamRef.current);
        if (confCryptoRef.current) {
          confCryptoRef.current.setupSenderEncryption(sender);
        }
        // Boost video bitrate for better quality
        if (t.kind === 'video') {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 1_500_000; // 1.5 Mbps
            params.encodings[0].maxFramerate = 30;
            sender.setParameters(params).catch(() => {});
          } catch (e) { /* some browsers don't support setParameters */ }
        }
      });
    }

    peersRef.current.set(peerId, { pc });
    return pc;
  }, [fetchIceConfig, sendConfSignal]);

  /** Remove a peer cleanly */
  const removePeer = useCallback((peerId) => {
    const peer = peersRef.current.get(peerId);
    if (peer?.pc && typeof peer.pc.close === 'function') {
      peer.pc.ontrack = null;
      peer.pc.onicecandidate = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
    }
    peersRef.current.delete(peerId);
    remoteStreamsRef.current.delete(peerId);
    remoteVideoRefs.current.delete(peerId);

    // Remove decrypt key for this peer
    if (confCryptoRef.current) {
      confCryptoRef.current.removeDecryptKey(peerId);
    }

    setParticipants(prev => prev.filter(p => p !== peerId));

    // NOTE: Do NOT auto-leave when no peers left.
    // The conference stays alive on the server for new participants to join.
  }, []);

  // ──── public API ────

  /** Get local media */
  const getLocalMedia = useCallback(async (type = 'audio') => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: type === 'video' ? {
        width:  { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  /** Create a new conference (upgrade from 1:1 or fresh start) */
  const createConference = useCallback(async (type = 'audio') => {
    if (confState !== 'idle') return null;

    try {
      setConfState('joining');
      setConfType(type);

      // Get media first
      await getLocalMedia(type);

      // Init E2E media crypto
      if (supportsInsertableStreams()) {
        confCryptoRef.current = new ConferenceCrypto();
        await confCryptoRef.current.generateKey();
      }

      // Create conference on server
      const res = await fetch('/api/conference', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to create conference');
      const data = await res.json();
      const newConfId = data.confId;

      setConfId(newConfId);
      setParticipants([username]);

      // Notify server we joined (triggers CONF_JOIN broadcast)
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'CONF_JOIN',
          extra: { confId: newConfId },
        }));
      }

      return newConfId;
    } catch (err) {
      console.error('[Conference] Create failed:', err);
      cleanup();
      return null;
    }
  }, [confState, getLocalMedia, token, username, wsRef, cleanup]);

  /** Join an existing conference by ID */
  const joinConference = useCallback(async (targetConfId, type = 'audio') => {
    if (confState !== 'idle') return false;

    try {
      setConfState('joining');
      setConfType(type);

      // Get media first
      await getLocalMedia(type);

      // Init E2E media crypto
      if (supportsInsertableStreams()) {
        confCryptoRef.current = new ConferenceCrypto();
        await confCryptoRef.current.generateKey();
      }

      // Join on server
      const res = await fetch(`/api/conference/${targetConfId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to join conference');
      }

      setConfId(targetConfId);

      // Notify server (triggers CONF_PEERS for us + CONF_JOIN broadcast to others)
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'CONF_JOIN',
          extra: { confId: targetConfId },
        }));
      }

      return true;
    } catch (err) {
      console.error('[Conference] Join failed:', err);
      if (err.message.includes('full')) {
        alert('Конференция заполнена (макс. 10 участников)');
      }
      cleanup();
      return false;
    }
  }, [confState, getLocalMedia, token, wsRef, cleanup]);

  /** Leave the conference */
  const leaveConference = useCallback(() => {
    if (confIdRef.current) {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'CONF_LEAVE',
          extra: { confId: confIdRef.current },
        }));
      }
      // Leave on server too
      fetch(`/api/conference/${confIdRef.current}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    cleanup();
  }, [wsRef, token, cleanup]);

  // ──── WS message handlers ────

  /** Handle CONF_PEERS — list of existing peers to connect to */
  const handleConfPeers = useCallback(async (msg) => {
    const extra = msg.extra || {};
    const peerList = (extra.peers || '').split(',').filter(Boolean);

    setParticipants([username, ...peerList]);

    // Create a PeerConnection + send CONF_OFFER to each existing peer
    for (const peerId of peerList) {
      try {
        const pc = await createPeerConnection(peerId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const mediaKey = confCryptoRef.current?.getKeyBase64() || null;

        await sendConfSignal('CONF_OFFER', peerId, {
          sdp: JSON.stringify(offer),
          callType: confType,
          ...(mediaKey && { mediaKey }),
        });
      } catch (err) {
        console.error(`[Conference] Failed to offer to ${peerId}:`, err);
      }
    }
  }, [username, confType, createPeerConnection, sendConfSignal]);

  /** Handle CONF_JOIN — new peer joined, expect CONF_OFFER from them */
  const handleConfJoin = useCallback((msg) => {
    const newPeer = msg.sender;
    if (newPeer === username) return;
    setParticipants(prev => prev.includes(newPeer) ? prev : [...prev, newPeer]);
  }, [username]);

  /** Handle CONF_OFFER — incoming offer from a peer */
  const handleConfOffer = useCallback(async (msg) => {
    const extra = await decryptExtra(msg);
    const peerId = msg.sender;
    if (peerId === username) return;

    try {
      const pc = await createPeerConnection(peerId);

      // Set peer's E2E media key for decryption
      if (confCryptoRef.current && extra.mediaKey) {
        await confCryptoRef.current.setDecryptKey(peerId, extra.mediaKey);
      }

      const offer = JSON.parse(extra.sdp);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush any pending ICE candidates
      const peer = peersRef.current.get(peerId);
      if (peer?._pendingCandidates) {
        for (const c of peer._pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        delete peer._pendingCandidates;
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const mediaKey = confCryptoRef.current?.getKeyBase64() || null;

      await sendConfSignal('CONF_ANSWER', peerId, {
        sdp: JSON.stringify(answer),
        ...(mediaKey && { mediaKey }),
      });
    } catch (err) {
      console.error(`[Conference] handleConfOffer from ${peerId} failed:`, err);
    }
  }, [username, createPeerConnection, decryptExtra, sendConfSignal]);

  /** Handle CONF_ANSWER — answer from peer we sent offer to */
  const handleConfAnswer = useCallback(async (msg) => {
    const extra = await decryptExtra(msg);
    const peerId = msg.sender;
    const peer = peersRef.current.get(peerId);
    if (!peer?.pc || typeof peer.pc.setRemoteDescription !== 'function') return;

    // Set peer's E2E media key
    if (confCryptoRef.current && extra.mediaKey) {
      await confCryptoRef.current.setDecryptKey(peerId, extra.mediaKey);
    }

    try {
      const answer = JSON.parse(extra.sdp);
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Flush pending ICE candidates
      if (peer._pendingCandidates) {
        for (const c of peer._pendingCandidates) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        delete peer._pendingCandidates;
      }
    } catch (err) {
      console.error(`[Conference] handleConfAnswer from ${peerId} failed:`, err);
    }
  }, [decryptExtra]);

  /** Handle CONF_ICE — ICE candidate from a peer */
  const handleConfIce = useCallback(async (msg) => {
    const extra = await decryptExtra(msg);
    const peerId = msg.sender;
    if (!extra.candidate) return;

    try {
      const candidate = JSON.parse(extra.candidate);
      const peer = peersRef.current.get(peerId);

      if (peer?.pc && peer.pc.remoteDescription) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // Queue until remote description is set
        if (!peer) {
          peersRef.current.set(peerId, { pc: null, _pendingCandidates: [candidate] });
        } else {
          peer._pendingCandidates = peer._pendingCandidates || [];
          peer._pendingCandidates.push(candidate);
        }
      }
    } catch (err) {
      console.error(`[Conference] handleConfIce from ${peerId} failed:`, err);
    }
  }, [decryptExtra]);

  /** Handle CONF_LEAVE — peer left */
  const handleConfLeave = useCallback((msg) => {
    const peerId = msg.sender;
    const extra = msg.extra || {};

    // If system says "full" → we were rejected
    if (peerId === 'system' && extra.reason === 'full') {
      alert('Конференция заполнена (макс. 10 участников)');
      cleanup();
      return;
    }

    if (peerId === username) return;
    removePeer(peerId);

    // Key rotation: all remaining peers get new keys
    if (confCryptoRef.current && peersRef.current.size > 0) {
      confCryptoRef.current.generateKey().then(async () => {
        const newMediaKey = confCryptoRef.current.getKeyBase64();
        // Send new key to all remaining peers
        for (const [pid] of peersRef.current) {
          try {
            await sendConfSignal('CONF_ICE', pid, {
              keyRotation: true,
              mediaKey: newMediaKey,
            });
          } catch { /* best effort */ }
        }
      }).catch(() => {});
    }
  }, [username, removePeer, cleanup, sendConfSignal]);

  /** Toggle mute */
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(prev => !prev);
  }, []);

  /** Toggle video — add video track dynamically if audio-only conference */
  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const existingVideoTracks = stream.getVideoTracks();

    if (existingVideoTracks.length > 0) {
      // Already have video tracks — just toggle enabled
      existingVideoTracks.forEach(t => { t.enabled = !t.enabled; });
      setIsVideoOff(prev => !prev);
    } else {
      // Audio-only conference — dynamically add video track + add to all peers
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) return;

        // Add to local stream
        stream.addTrack(videoTrack);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Add track to every peer connection and renegotiate
        for (const [peerId, peer] of peersRef.current.entries()) {
          const pc = peer.pc;
          if (pc && pc.connectionState === 'connected') {
            const sender = pc.addTrack(videoTrack, stream);
            if (confCryptoRef.current) {
              confCryptoRef.current.setupSenderEncryption(sender);
            }
            // Boost video bitrate
            try {
              const params = sender.getParameters();
              if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
              params.encodings[0].maxBitrate = 1_500_000;
              params.encodings[0].maxFramerate = 30;
              sender.setParameters(params).catch(() => {});
            } catch (e) { /* ignore */ }
            // Renegotiate
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendConfSignal('CONF_OFFER', peerId, {
              sdp: JSON.stringify(offer),
              callType: 'video',
              renegotiate: true,
            });
          }
        }

        setConfType('video');
        setIsVideoOff(false);
      } catch (err) {
        console.error('[Conference] Failed to add video:', err);
      }
    }
  }, [sendConfSignal]);

  /** Get copy link */
  const getShareLink = useCallback(() => {
    if (!confIdRef.current) return '';
    return `${window.location.origin}/?conf=${confIdRef.current}`;
  }, []);

  /** Copy link to clipboard */
  const copyShareLink = useCallback(async () => {
    const link = getShareLink();
    if (!link) return false;
    try {
      await navigator.clipboard.writeText(link);
      return true;
    } catch {
      return false;
    }
  }, [getShareLink]);

  /** Attach a video element ref for a specific peer */
  const setRemoteVideoRef = useCallback((peerId, element) => {
    if (element) {
      remoteVideoRefs.current.set(peerId, element);
      const stream = remoteStreamsRef.current.get(peerId);
      if (stream) element.srcObject = stream;
    } else {
      remoteVideoRefs.current.delete(peerId);
    }
  }, []);

  /** Get remote stream for a peer */
  const getRemoteStream = useCallback((peerId) => {
    return remoteStreamsRef.current.get(peerId) || null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const [, peer] of peersRef.current) {
        if (peer.pc && typeof peer.pc.close === 'function') peer.pc.close();
      }
      if (confCryptoRef.current) {
        confCryptoRef.current.destroy();
        confCryptoRef.current = null;
      }
      stopLocalMedia();
      clearInterval(durationTimer.current);
    };
  }, [stopLocalMedia]);

  return {
    // state
    confState,
    confId,
    participants,
    confDuration,
    isMuted,
    isVideoOff,
    confType,
    // refs
    localVideoRef,
    localStreamRef,
    // actions
    createConference,
    joinConference,
    leaveConference,
    toggleMute,
    toggleVideo,
    copyShareLink,
    getShareLink,
    setRemoteVideoRef,
    getRemoteStream,
    // signal handlers (called from ws.onmessage)
    handleConfPeers,
    handleConfJoin,
    handleConfOffer,
    handleConfAnswer,
    handleConfIce,
    handleConfLeave,
  };
}
