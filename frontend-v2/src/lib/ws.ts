// ═══════════════════════════════════════════════
//  WebSocket Manager — singleton
// ═══════════════════════════════════════════════
type Handler = (msg: any) => void;

class WsManager {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private username: string | null = null;

  connect(token: string, username: string) {
    this.token = token;
    this.username = username;
    this.doConnect();
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws/chat?token=${this.token}&username=${this.username}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] connected');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.handlers.forEach((h) => h(msg));
      } catch {
        // non-JSON
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] disconnected, reconnecting...');
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) this.doConnect();
    }, 3000);
  }

  send(msg: Record<string, any>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  subscribe(handler: Handler) {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.token = null;
    this.handlers.clear();
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsManager = new WsManager();
