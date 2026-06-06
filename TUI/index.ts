import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  ScrollBoxRenderable,
  ASCIIFontRenderable,
  RGBA,
  t,
  bold,
  fg,
  InputRenderableEvents,
  Box,
} from "@opentui/core"
import { WsClient, type ConnectionState } from "./lib/ws-client"
import { ChatStore } from "./lib/chat-store"

// ── Colors ─────────────────────────────────────────────────────────────
const C = {
  accent: "#D97706",
  primary: "#E5E5E5",
  secondary: "#A1A1AA",
  dim: "#52525B",
  surface: "#18181B",
  inputBg: "#27272A",
  inputFocusBg: "#3F3F46",
  border: "#3F3F46",
  success: "#22C55E",
  error: "#EF4444",
} as const

// ── Renderer ───────────────────────────────────────────────────────────
const renderer = await createCliRenderer({ exitOnCtrlC: false })

// ── State ──────────────────────────────────────────────────────────────
const chatStore = new ChatStore()
let prevMsgCount = 0

// ── Header: logo ───────────────────────────────────────────────────────
const logo = new ASCIIFontRenderable(renderer, {
  id: "logo",
  text: " MiMo TUI ",
  font: "tiny",
  color: RGBA.fromHex(C.accent),
})

// ── Header: model info ─────────────────────────────────────────────────
const modelInfo = new BoxRenderable(renderer, {
  id: "model-info",
  flexDirection: "column",
  padding: 1,
})
modelInfo.add(
  new TextRenderable(renderer, {
    id: "model-name",
    content: t`${bold(fg(C.primary)("MiMo V2.5 pro"))}  ${fg(C.dim)("·")}  ${fg(C.secondary)("v0.1.0")}`,
  }),
)
modelInfo.add(
  new TextRenderable(renderer, {
    id: "model-provider",
    content: t`${fg(C.dim)("Xiaomi")}`,
  }),
)

// ── Chat area: ScrollBox with sticky bottom ────────────────────────────
const chatScroll = new ScrollBoxRenderable(renderer, {
  id: "chat-scroll",
  flexGrow: 1,
  paddingLeft: 1,
  paddingRight: 1,
  paddingTop: 1,
  stickyScroll: true,
  stickyStart: "bottom",
  contentOptions: {
    flexDirection: "column",
    gap: 1,
  },
})

// ── Message rendering helpers ──────────────────────────────────────────
const ROLE_PREFIX: Record<string, string> = {
  user: "❯ ",
  assistant: "● ",
  error: "✗ ",
}
const ROLE_COLOR: Record<string, string> = {
  user: C.accent,
  assistant: C.success,
  error: C.error,
}

function makeMsgText(index: number, role: string, content: string): TextRenderable {
  const prefix = ROLE_PREFIX[role] ?? ROLE_PREFIX["assistant"]!
  const color = ROLE_COLOR[role] ?? C.primary
  const msgColor = role === "error" ? C.error : C.primary
  return new TextRenderable(renderer, {
    id: `msg-${index}`,
    content: t`${bold(fg(color)(prefix))}${fg(msgColor)(content)}`,
    selectable: true,
  })
}

function renderMessages() {
  const messages = chatStore.getDisplayMessages()

  // ── Clear ──
  if (messages.length === 0) {
    for (const child of chatScroll.getChildren()) {
      child.destroy()
    }
    prevMsgCount = 0
    return
  }

  // ── Streaming: update last element in-place ──
  if (chatStore.isStreaming() && messages.length <= prevMsgCount) {
    const last = messages[messages.length - 1]!
    const lastId = `msg-${prevMsgCount - 1}`
    chatScroll.remove(lastId)
    chatScroll.add(makeMsgText(prevMsgCount - 1, last.role, last.content))
    return
  }

  // ── New messages: append ──
  while (prevMsgCount < messages.length) {
    const msg = messages[prevMsgCount]!
    chatScroll.add(makeMsgText(prevMsgCount, msg.role, msg.content))
    prevMsgCount++
  }
}

chatStore.onChange(() => renderMessages())

// ── Status bar ─────────────────────────────────────────────────────────
const statusLeft = new TextRenderable(renderer, {
  id: "status-left",
  content: "",
  selectable: false,
})
const statusRight = new TextRenderable(renderer, {
  id: "status-right",
  content: t`${fg(C.dim)("/quit")} to quit  ${fg(C.dim)("·")}  ${fg(C.dim)("/help")} for commands`,
  selectable: false,
})

function updateStatus(state: ConnectionState) {
  const map: Record<ConnectionState, { dot: string; label: string }> = {
    connecting: { dot: C.accent, label: "connecting..." },
    connected: { dot: C.success, label: "connected" },
    disconnected: { dot: C.dim, label: "disconnected" },
    error: { dot: C.error, label: "connection error" },
  }
  const { dot, label } = map[state]
  statusLeft.content = t`${fg(dot)("●")} ${fg(C.dim)(label)}`
}

const statusBar = new BoxRenderable(renderer, {
  id: "status-bar",
  flexDirection: "row",
  justifyContent: "space-between",
  width: "100%",
  paddingLeft: 1,
  paddingRight: 1,
})
statusBar.add(statusLeft)
statusBar.add(statusRight)

// ── Input area ─────────────────────────────────────────────────────────
const inputPrompt = new TextRenderable(renderer, {
  id: "input-prompt",
  content: t`${bold(fg(C.accent)("❯ "))}`,
  selectable: false,
})

const input = new InputRenderable(renderer, {
  id: "main-input",
  placeholder: "Ask MiMo anything...",
  backgroundColor: C.inputBg,
  focusedBackgroundColor: C.inputFocusBg,
  textColor: C.primary,
  cursorColor: C.accent,
  flexGrow: 1,
})

input.focus()

const inputRow = new BoxRenderable(renderer, {
  id: "input-row",
  flexDirection: "row",
  alignItems: "center",
  width: "100%",
  paddingLeft: 1,
  paddingRight: 1,
  height: 1,
})
inputRow.add(inputPrompt)
inputRow.add(input)

// ── Root layout ────────────────────────────────────────────────────────
const root = new BoxRenderable(renderer, {
  id: "root",
  width: "100%",
  height: "100%",
  flexDirection: "column",
  backgroundColor: C.surface,
})

const header = new BoxRenderable(renderer, {
  id: "header",
  flexDirection: "column",
  padding: 1,
  paddingBottom: 0,
})
header.add(logo)
header.add(modelInfo)

root.add(Box({borderStyle: "single", borderColor: C.accent},logo, modelInfo))
root.add(chatScroll)
root.add(Box({borderStyle: "single",height: 3, width: "105%", marginX:-1, borderColor: C.border},inputRow))
root.add(statusBar)

renderer.root.add(root)

// ── WebSocket client ───────────────────────────────────────────────────
const ws = new WsClient({
  url: "ws://localhost:8765/ws",
  onToken(token) {
    chatStore.appendToken(token)
  },
  onDone() {
    chatStore.finishStreaming()
    input.focus()
  },
  onError(message) {
    chatStore.handleError(message)
    input.focus()
  },
  onStateChange(state) {
    updateStatus(state)
  },
})

updateStatus("connecting")
ws.connect()

// ── Handle user input ──────────────────────────────────────────────────
input.on(InputRenderableEvents.ENTER, (value: string) => {
  const content = value.trim()
  if (!content) return
  if (chatStore.isStreaming()) return

  if (content === "/quit") {
    ws.disconnect()
    renderer.destroy()
    process.exit(0)
  }

  if (content === "/clear") {
    chatStore.clear()
    ws.clearHistory()
    input.value = ""
    return
  }

  if (content === "/help") {
    chatStore.addMessage(
      "assistant",
      "Available commands:\n  /clear  - Clear chat history\n  /quit   - Exit\n  /help   - Show this help",
    )
    input.value = ""
    return
  }

  chatStore.addMessage("user", content)
  chatStore.startStreaming()
  ws.sendMessage(content)
  input.value = ""
})
