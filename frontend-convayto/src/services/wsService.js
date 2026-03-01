// ==========================================
// WebSocket Service — singleton connection to BarsikChat backend
// ==========================================

// >>> WebSocket включён (нужен для звонков и сообщений) <<<
const REALTIME_ENABLED = true;

let ws = null;
let reconnectTimer = null;
let pingTimer = null;
let messageListeners = [];
let connectionListeners = [];
let isConnecting = false;
let callListeners = [];
let confListeners = [];

const CALL_TYPES = new Set([
  'CALL_OFFER', 'CALL_ANSWER', 'CALL_REJECT', 'CALL_END',
  'CALL_BUSY', 'ICE_CANDIDATE', 'CALL_LOG',
  'CALL_REOFFER', 'CALL_REANSWER',
]);
const CONF_TYPES = new Set([
  'CONF_JOIN', 'CONF_LEAVE', 'CONF_PEERS',
  'CONF_OFFER', 'CONF_ANSWER', 'CONF_ICE',
  'CONF_INVITE',
]);

function getWsUrl() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/chat?token=${token}`;
}

export function connectWebSocket() {
  if (!REALTIME_ENABLED) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (isConnecting) return;

  const url = getWsUrl();
  if (!url) return;

  // Cancel any pending reconnect — we're connecting now
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  isConnecting = true;
  const thisWs = new WebSocket(url);
  ws = thisWs;

  thisWs.onopen = () => {
    if (ws !== thisWs) return; // stale connection opened — ignore
    isConnecting = false;
    console.log("[WS] Connected");
    connectionListeners.forEach((cb) => cb(true));
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // Start ping keepalive to detect dead connections
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (ws === thisWs && thisWs.readyState === WebSocket.OPEN) {
        try { thisWs.send(JSON.stringify({ type: "PING" })); } catch {}
      }
    }, 30000);
  };

  thisWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (CALL_TYPES.has(msg.type)) {
        callListeners.forEach((cb) => cb(msg));
      } else if (CONF_TYPES.has(msg.type)) {
        confListeners.forEach((cb) => cb(msg));
      }
      messageListeners.forEach((cb) => cb(msg));
    } catch (e) {
      console.warn("[WS] Failed to parse message:", event.data);
    }
  };

  thisWs.onclose = (event) => {
    // If ws has already moved on to a newer connection, this is a stale
    // onclose (e.g. old session got 4001-kicked after new one connected).
    // Do NOT null ws, do NOT reconnect — the new connection is fine.
    if (ws !== thisWs) {
      console.debug("[WS] Stale connection closed (replaced), ignoring");
      return;
    }

    isConnecting = false;
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    console.log("[WS] Disconnected", event.code, event.reason);
    connectionListeners.forEach((cb) => cb(false));
    ws = null;

    // Code 4001 = session replaced by another tab/device.
    // Do NOT reconnect — that would kick the other session in an infinite loop.
    if (event.code === 4001) {
      console.warn("[WS] Session replaced by another connection. Not reconnecting.");
      return;
    }

    // Auto-reconnect if we have a token
    if (localStorage.getItem("token")) {
      reconnectTimer = setTimeout(() => {
        console.log("[WS] Reconnecting...");
        connectWebSocket();
      }, 3000);
    }
  };

  thisWs.onerror = (error) => {
    if (ws !== thisWs) return; // stale
    isConnecting = false;
    console.error("[WS] Error:", error);
  };
}

export function disconnectWebSocket() {
  isConnecting = false;
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    const closing = ws;
    ws = null; // clear before close so stale onclose handler sees ws !== thisWs
    closing.close();
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
