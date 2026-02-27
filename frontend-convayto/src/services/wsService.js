// ==========================================
// WebSocket Service — singleton connection to BarsikChat backend
// ==========================================

// >>> WebSocket включён (нужен для звонков и сообщений) <<<
const REALTIME_ENABLED = true;

let ws = null;
let reconnectTimer = null;
let messageListeners = [];
let connectionListeners = [];
let isConnecting = false;
let callListeners = [];
let confListeners = [];

const CALL_TYPES = new Set([
  'CALL_OFFER', 'CALL_ANSWER', 'CALL_REJECT', 'CALL_END',
  'CALL_BUSY', 'ICE_CANDIDATE', 'CALL_LOG',
]);
const CONF_TYPES = new Set([
  'CONF_JOIN', 'CONF_LEAVE', 'CONF_PEERS',
  'CONF_OFFER', 'CONF_ANSWER', 'CONF_ICE',
]);

function getWsUrl() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/chat?token=${token}`;
}

export function connectWebSocket() {
  if (!REALTIME_ENABLED) return; // бесшовное обновление отключено
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (isConnecting) return;

  const url = getWsUrl();
  if (!url) return;

  isConnecting = true;
  ws = new WebSocket(url);

  ws.onopen = () => {
    isConnecting = false;
    console.log("[WS] Connected");
    connectionListeners.forEach((cb) => cb(true));

    // Clear any reconnect timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      // Route to typed listeners
      if (CALL_TYPES.has(msg.type)) {
        callListeners.forEach((cb) => cb(msg));
      } else if (CONF_TYPES.has(msg.type)) {
        confListeners.forEach((cb) => cb(msg));
      }
      // Always notify general listeners
      messageListeners.forEach((cb) => cb(msg));
    } catch (e) {
      console.warn("[WS] Failed to parse message:", event.data);
    }
  };

  ws.onclose = (event) => {
    isConnecting = false;
    console.log("[WS] Disconnected", event.code, event.reason);
    connectionListeners.forEach((cb) => cb(false));
    ws = null;

    // Auto-reconnect after 3 seconds if we have a token
    if (localStorage.getItem("token")) {
      reconnectTimer = setTimeout(() => {
        console.log("[WS] Reconnecting...");
        connectWebSocket();
      }, 3000);
    }
  };

  ws.onerror = (error) => {
    isConnecting = false;
    console.error("[WS] Error:", error);
  };
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function sendWsMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  console.warn("[WS] Cannot send — not connected");
  return false;
}

export function onWsMessage(callback) {
  messageListeners.push(callback);
  return () => {
    messageListeners = messageListeners.filter((cb) => cb !== callback);
  };
}

export function onWsConnection(callback) {
  connectionListeners.push(callback);
  return () => {
    connectionListeners = connectionListeners.filter((cb) => cb !== callback);
  };
}

export function isWsConnected() {
  return ws && ws.readyState === WebSocket.OPEN;
}

export function onCallMessage(callback) {
  callListeners.push(callback);
  return () => {
    callListeners = callListeners.filter((cb) => cb !== callback);
  };
}

export function onConferenceMessage(callback) {
  confListeners.push(callback);
  return () => {
    confListeners = confListeners.filter((cb) => cb !== callback);
  };
}
