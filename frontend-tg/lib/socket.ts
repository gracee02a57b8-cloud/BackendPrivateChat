import { IMessage } from '@/types'

export type WsCallback = (msg: IMessage) => void

class BarsikSocket {
	private ws: WebSocket | null = null
	private token: string = ''
	private listeners: Map<string, Set<WsCallback>> = new Map()
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private shouldReconnect = true

	connect(token: string) {
		this.token = token
		this.shouldReconnect = true
		this._connect()
	}

	private _connect() {
		if (this.ws?.readyState === WebSocket.OPEN) return

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
		const host = window.location.host
		const url = `${protocol}//${host}/ws/chat?token=${this.token}`

		this.ws = new WebSocket(url)

		this.ws.onopen = () => {
			console.log('[WS] Connected')
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer)
				this.reconnectTimer = null
			}
		}

		this.ws.onmessage = (event) => {
			try {
				const msg: IMessage = JSON.parse(event.data)
				const type = msg.type
				// Notify listeners for this message type
				const typeListeners = this.listeners.get(type)
				if (typeListeners) {
					typeListeners.forEach(cb => cb(msg))
				}
				// Also notify wildcard listeners
				const allListeners = this.listeners.get('*')
				if (allListeners) {
					allListeners.forEach(cb => cb(msg))
				}
			} catch (e) {
				console.warn('[WS] Failed to parse message:', e)
			}
		}

		this.ws.onclose = (event) => {
			console.log('[WS] Closed', event.code, event.reason)
			// Code 4001 means replaced by new session — don't reconnect
			if (event.code === 4001) {
				this.shouldReconnect = false
			}
			if (this.shouldReconnect) {
				this.reconnectTimer = setTimeout(() => this._connect(), 3000)
			}
		}

		this.ws.onerror = (error) => {
			console.error('[WS] Error:', error)
		}
	}

	send(msg: Record<string, unknown>) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(msg))
		}
	}

	on(type: string, callback: WsCallback) {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set())
		}
		this.listeners.get(type)!.add(callback)
	}

	off(type: string, callback: WsCallback) {
		this.listeners.get(type)?.delete(callback)
	}

	disconnect() {
		this.shouldReconnect = false
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.ws?.close()
		this.ws = null
		this.listeners.clear()
	}

	get isConnected() {
		return this.ws?.readyState === WebSocket.OPEN
	}
}

/** Singleton WebSocket instance */
export const socket = new BarsikSocket()
