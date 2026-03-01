// ==========================================
// Global test setup — mocks for WebRTC, MediaStream, AudioContext, etc.
// ==========================================
import "@testing-library/jest-dom";

// ====== Mock MediaStream ======
class MockMediaStream {
  constructor(tracks = []) {
    this._tracks = [...tracks];
    this.id = "mock-stream-" + Math.random().toString(36).slice(2);
  }
  getTracks() {
    return this._tracks;
  }
  getAudioTracks() {
    return this._tracks.filter((t) => t.kind === "audio");
  }
  getVideoTracks() {
    return this._tracks.filter((t) => t.kind === "video");
  }
  addTrack(track) {
    this._tracks.push(track);
  }
  removeTrack(track) {
    this._tracks = this._tracks.filter((t) => t !== track);
  }
}

class MockMediaStreamTrack {
  constructor(kind = "audio") {
    this.kind = kind;
    this.enabled = true;
    this.id = "mock-track-" + Math.random().toString(36).slice(2);
    this.readyState = "live";
  }
  stop() {
    this.readyState = "ended";
  }
  clone() {
    const c = new MockMediaStreamTrack(this.kind);
    c.enabled = this.enabled;
    return c;
  }
}

// ====== Mock RTCPeerConnection ======
class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.localDescription = null;
    this.remoteDescription = null;
    this.connectionState = "new";
    this.iceConnectionState = "new";
    this.signalingState = "stable";
    this._senders = [];
    this._receivers = [];
    this.onicecandidate = null;
    this.ontrack = null;
    this.onconnectionstatechange = null;
    this.oniceconnectionstatechange = null;
  }
  addTrack(track, stream) {
    const sender = { track, replaceTrack: vi.fn() };
    this._senders.push(sender);
    return sender;
  }
  getSenders() {
    return this._senders;
  }
  getReceivers() {
    return this._receivers;
  }
  async createOffer() {
    return { type: "offer", sdp: "mock-sdp-offer" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "mock-sdp-answer" };
  }
  async setLocalDescription(desc) {
    this.localDescription = desc;
  }
  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
  }
  async addIceCandidate(candidate) {}
  close() {
    this.connectionState = "closed";
    this.signalingState = "closed";
  }
  getStats() {
    return Promise.resolve(new Map());
  }
}

class MockRTCSessionDescription {
  constructor(init) {
    this.type = init?.type;
    this.sdp = init?.sdp;
  }
}

class MockRTCIceCandidate {
  constructor(init) {
    this.candidate = init?.candidate;
    this.sdpMid = init?.sdpMid;
    this.sdpMLineIndex = init?.sdpMLineIndex;
  }
}

// ====== Mock AudioContext for ringtone ======
class MockOscillatorNode {
  constructor() {
    this.type = "sine";
    this.frequency = { value: 440 };
  }
  connect() {
    return this;
  }
  start() {}
  stop() {}
}

class MockGainNode {
  constructor() {
    this.gain = {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
  }
  connect() {
    return this;
  }
}

class MockAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
  }
  createOscillator() {
    return new MockOscillatorNode();
  }
  createGain() {
    return new MockGainNode();
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

// ====== Assign globals ======
globalThis.MediaStream = MockMediaStream;
globalThis.MediaStreamTrack = MockMediaStreamTrack;
globalThis.RTCPeerConnection = MockRTCPeerConnection;
globalThis.RTCSessionDescription = MockRTCSessionDescription;
globalThis.RTCIceCandidate = MockRTCIceCandidate;
globalThis.AudioContext = MockAudioContext;
globalThis.webkitAudioContext = MockAudioContext;

// Mock navigator.mediaDevices
Object.defineProperty(globalThis.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn(() =>
      Promise.resolve(
        new MockMediaStream([
          new MockMediaStreamTrack("audio"),
          new MockMediaStreamTrack("video"),
        ]),
      ),
    ),
    enumerateDevices: vi.fn(() => Promise.resolve([])),
  },
  writable: true,
  configurable: true,
});

// Mock navigator.vibrate
Object.defineProperty(globalThis.navigator, "vibrate", {
  value: vi.fn(),
  writable: true,
  configurable: true,
});

// Mock HTMLVideoElement.play
HTMLVideoElement.prototype.play = vi.fn(() => Promise.resolve());
HTMLAudioElement.prototype.play = vi.fn(() => Promise.resolve());

// Export mock constructors for use in tests
export {
  MockMediaStream,
  MockMediaStreamTrack,
  MockRTCPeerConnection,
  MockRTCSessionDescription,
  MockRTCIceCandidate,
  MockAudioContext,
};
