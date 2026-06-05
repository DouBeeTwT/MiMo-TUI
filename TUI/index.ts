import {
  createCliRenderer,
  Box,
  Text,
  Input,
  ASCIIFont,
  t,
  bold,
  fg,
  InputRenderableEvents,
} from "@opentui/core"

// ── Colors (Claude Code-inspired palette) ──────────────────────────────
const COLORS = {
  accent: "#D97706",     // warm amber (Claude Code's signature color)
  primary: "#E5E5E5",    // near-white text
  secondary: "#A1A1AA",  // muted gray
  dim: "#52525B",        // dimmer gray
  surface: "#18181B",    // dark surface
  inputBg: "#27272A",    // input background
  inputFocusBg: "#3F3F46", // input focused background
  border: "#3F3F46",     // border color
  success: "#22C55E",    // green for status
} as const

// ── Model configuration ────────────────────────────────────────────────
const MODEL_NAME = "MiMo-7B-RL"
const MODEL_VERSION = "v0.1.0"
const PROVIDER = "Xiaomi"

// ── Create renderer ────────────────────────────────────────────────────
const renderer = await createCliRenderer({
  exitOnCtrlC: true,
})

// ── Header: ASCII art logo ─────────────────────────────────────────────
const logo = ASCIIFont({
  text: "MIMO",
  font: "tiny",
  color: COLORS.accent,
})

// ── Header: model info ─────────────────────────────────────────────────
const modelInfo = Box(
  {
    flexDirection: "column",
    gap: 0,
    paddingLeft: 1,
    paddingTop: 1,
  },
  // Model name line
  Text({
    content: t`${bold(fg(COLORS.primary)(MODEL_NAME))}  ${fg(COLORS.dim)("·")}  ${fg(COLORS.secondary)(MODEL_VERSION)}`,
  }),
  // Provider line
  Text({
    content: t`${fg(COLORS.dim)(PROVIDER)}`,
  }),
)

// ── Header separator ───────────────────────────────────────────────────
const separator = Text({
  content: "─".repeat(60),
  fg: COLORS.dim,
})

// ── Middle: tips / shortcuts ───────────────────────────────────────────
const shortcuts = Box(
  {
    flexDirection: "column",
    gap: 1,
    paddingLeft: 1,
    paddingTop: 1,
  },
  Text({
    content: t`${bold(fg(COLORS.accent)("Tips for getting started:"))}`,
  }),
  Text({
    content: t`  ${fg(COLORS.secondary)("1.")} ${fg(COLORS.primary)("Ask questions, edit files, or run commands.")}`,
  }),
  Text({
    content: t`  ${fg(COLORS.secondary)("2.")} ${fg(COLORS.primary)("Be specific for best results.")}`,
  }),
  Text({
    content: t`  ${fg(COLORS.secondary)("3.")} ${fg(COLORS.primary)("Type")} ${bold(fg(COLORS.accent)("/help"))}${fg(COLORS.primary)(" for available commands.")}`,
  }),
  Text({
    content: t`  ${fg(COLORS.secondary)("4.")} ${fg(COLORS.primary)("Type")} ${bold(fg(COLORS.accent)("/quit"))}${fg(COLORS.primary)(" to exit.")}`,
  }),
)

// ── Bottom: input area ─────────────────────────────────────────────────
const inputPrompt = Text({
  content: t`${bold(fg(COLORS.accent)("❯"))}`,
  selectable: false,
})

const input = Input({
  id: "main-input",
  placeholder: "Ask MiMo anything...",
  backgroundColor: COLORS.inputBg,
  focusedBackgroundColor: COLORS.inputFocusBg,
  textColor: COLORS.primary,
  cursorColor: COLORS.accent,
})

// Focus the input on start
input.focus()

const inputArea = Box(
  {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    paddingLeft: 1,
    paddingRight: 1,
    width: "100%",
  },
  inputPrompt,
  Box(
    {
      flexGrow: 1,
    },
    input,
  ),
)

// ── Bottom bar: status ─────────────────────────────────────────────────
const statusBar = Box(
  {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingLeft: 1,
    paddingRight: 1,
  },
  Text({
    content: t`${fg(COLORS.dim)("Ctrl+C")} to quit  ${fg(COLORS.dim)("·")}  ${fg(COLORS.dim)("/help")} for commands`,
    selectable: false,
  }),
  Text({
    content: t`${fg(COLORS.success)("●")} ${fg(COLORS.dim)("ready")}`,
    selectable: false,
  }),
)

// ── Root layout ────────────────────────────────────────────────────────
renderer.root.add(
  Box(
    {
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: COLORS.surface,
    },
    // ── Top section: logo + model info ──
    Box(
      {
        flexDirection: "column",
        padding: 1,
        paddingBottom: 0,
      },
      logo,
      modelInfo,
    ),
    // ── Separator ──
    Box(
      {
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
      },
      separator,
    ),
    // ── Middle: tips area (takes remaining space) ──
    Box(
      {
        flexGrow: 1,
        flexDirection: "column",
      },
      shortcuts,
    ),
    // ── Input separator ──
    Box(
      {
        paddingLeft: 1,
        paddingRight: 1,
      },
      Text({
        content: "─".repeat(60),
        fg: COLORS.border,
      }),
    ),
    // ── Bottom: input bar ──
    Box(
      {
        flexDirection: "column",
        paddingTop: 0,
        paddingBottom: 1,
      },
      inputArea,
    ),
    // ── Status bar ──
    statusBar,
  ),
)

// ── Handle input events ────────────────────────────────────────────────
input.on(InputRenderableEvents.ENTER, (value: string) => {
  if (value.trim()) {
    // For now, just clear the input after submission
    input.value = ""
  }
})
