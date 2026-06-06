/**
 * WebSocket client for communicating with the MiMo Python backend.
 *
 * Handles connection, reconnection, and message parsing.
 */

export type ServerMessage =
  | { type: "token"; content: string }
  | { type: "done" }
  | { type: "error"; content: string }
  | { type: "cleared" }
  | { type: "pong" }

export type ClientMessage =
  | { type: "user_message"; content: string }
  | { type: "clear" }
  | { type: "ping" }

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error"

export interface WsClientOptions {
  url?: string
  onToken?: (token: string) => void
  onDone?: () => void
  onError?: (message: string) => void
  onStateChange?: (state: ConnectionState) => void
}

export class WsClient {
  private ws: WebSocket | null = null
  private url: string
  private state: ConnectionState = "disconnected"
  private options: WsClientOptions

  // Reconnect
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 10000
  private shouldReconnect = true

  constructor(options: WsClientOptions = {}) {
    this.url = options.url ?? "ws://localhost:8765/ws"
    this.options = options
  }

  connect(): void {
    if (this.ws) {
      this.ws.close()
    }

    this.shouldReconnect = true
    this.setState("connecting")

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.reconnectDelay = 1000
        this.setState("connected")
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data as string)
          this.handleMessage(msg)
        } catch {
          // Ignore malformed messages
        }
      }

      this.ws.onclose = () => {
        this.setState("disconnected")
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        this.setState("error")
      }
    } catch {
      this.setState("error")
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.setState("disconnected")
  }

  sendMessage(content: string): void {
    if (this.state !== "connected" || !this.ws) return
    const msg: ClientMessage = { type: "user_message", content }
    this.ws.send(JSON.stringify(msg))
  }

  clearHistory(): void {
    if (this.state !== "connected" || !this.ws) return
    this.ws.send(JSON.stringify({ type: "clear" } satisfies ClientMessage))
  }

  getState(): ConnectionState {
    return this.state
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "token":
        this.options.onToken?.(msg.content)
        break
      case "done":
        this.options.onDone?.()
        break
      case "error":
        this.options.onError?.(msg.content)
        break
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return
    this.state = state
    this.options.onStateChange?.(state)
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay,
      )
    }, this.reconnectDelay)
  }
}
