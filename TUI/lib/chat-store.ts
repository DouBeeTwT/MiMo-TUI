/**
 * Simple chat message store for the TUI.
 * Manages conversation history for display.
 */

export interface ChatMessage {
  role: "user" | "assistant" | "error"
  content: string
}

export type MessageListener = (messages: ChatMessage[]) => void

export class ChatStore {
  private messages: ChatMessage[] = []
  private listeners: MessageListener[] = []
  private streamingMessage: ChatMessage | null = null

  /** Add a complete message */
  addMessage(role: ChatMessage["role"], content: string): void {
    this.messages.push({ role, content })
    this.streamingMessage = null
    this.notify()
  }

  /** Start a streaming assistant response */
  startStreaming(): void {
    this.streamingMessage = { role: "assistant", content: "" }
    this.notify()
  }

  /** Append a token to the current streaming response */
  appendToken(token: string): void {
    if (!this.streamingMessage) {
      this.startStreaming()
    }
    this.streamingMessage!.content += token
    this.notify()
  }

  /** Finish streaming — move the streaming message into the history */
  finishStreaming(): void {
    if (this.streamingMessage) {
      this.messages.push(this.streamingMessage)
      this.streamingMessage = null
    }
    this.notify()
  }

  /** Handle an error during streaming */
  handleError(errorMsg: string): void {
    // If we had a partial streaming message, remove it
    this.streamingMessage = null
    this.messages.push({ role: "error", content: errorMsg })
    this.notify()
  }

  /** Get all messages including the current streaming one */
  getDisplayMessages(): ChatMessage[] {
    const all = [...this.messages]
    if (this.streamingMessage) {
      all.push(this.streamingMessage)
    }
    return all
  }

  /** Check if currently streaming */
  isStreaming(): boolean {
    return this.streamingMessage !== null
  }

  /** Clear all messages */
  clear(): void {
    this.messages = []
    this.streamingMessage = null
    this.notify()
  }

  /** Subscribe to changes */
  onChange(listener: MessageListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.getDisplayMessages())
    }
  }
}
