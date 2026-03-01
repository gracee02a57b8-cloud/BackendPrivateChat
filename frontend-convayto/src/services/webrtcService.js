// ==========================================
// WebRTC Service — peer connection + media helpers
// ==========================================
import { apiFetch } from "./apiHelper";

let cachedIceServers = null;
let iceConfigExpiry = 0;

/**
 * Fetch STUN/TURN ice servers from backend (cached for 23 hours).
 */
export async function getIceServers() {
  const now = Date.now();
  if (cachedIceServers && now < iceConfigExpiry) return cachedIceServers;

  try {
    const config = await apiFetch("/api/webrtc/ice-config");
    // Backend returns { iceServers: [...] } or just an array
    cachedIceServers = config.iceServers || config;
    iceConfigExpiry = now + 2 * 60 * 60 * 1000; // 2h (match TURN credential TTL)
    return cachedIceServers;
  } catch (e) {
    console.error("[WebRTC] Failed to get ICE config:", e);
    // Fallback to public STUN
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

/**
 * Create an RTCPeerConnection with TURN/STUN ice servers.
 * @param {Object} handlers
 * @param {Function} handlers.onIceCandidate - (candidate: RTCIceCandidate) => void
 * @param {Function} handlers.onTrack - (stream: MediaStream) => void
 * @param {Function} [handlers.onConnectionStateChange] - (state: string) => void
 * @returns {Promise<RTCPeerConnection>}
 */
export async function createPeerConnection({
  onIceCandidate,
  onTrack,
  onConnectionStateChange,
}) {
  const iceServers = await getIceServers();
  const pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      onTrack(event.streams[0]);
    } else {
      // Fallback: accumulate tracks into a single stream (some browsers don't populate event.streams)
      if (!pc._fallbackStream) pc._fallbackStream = new MediaStream();
      pc._fallbackStream.addTrack(event.track);
      onTrack(pc._fallbackStream);
    }
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange?.(pc.connectionState);
  };

  return pc;
}

/**
 * Get local media stream (audio, or audio+video).
 * @param {"audio"|"video"} callType
 * @returns {Promise<MediaStream>}
 */
export async function getUserMediaStream(callType) {
  const constraints = {
    audio: true,
    video:
      callType === "video"
        ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}
