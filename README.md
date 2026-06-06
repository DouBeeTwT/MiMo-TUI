# MiMo-TUI

A TUI for Xiaomi MIMO — terminal-based chat interface powered by OpenTUI.

## Architecture

```
┌─────────────┐  WebSocket (ws://localhost:8765)  ┌──────────────┐  OpenAI API  ┌─────────────┐
│  TUI (Bun)  │ ◄═══════════════════════════════► │  Python      │ ──────────► │  LLM 服务   │
│  OpenTUI    │  JSON messages                    │  FastAPI     │ ◄────────── │  (线上模型)  │
└─────────────┘                                   └──────────────┘             └─────────────┘
```

## Quick Start

### First time setup

```bash
# Install Python dependencies
cd Scripts && pip install -r requirements.txt && cd ..

# Configure your API key
cp .settings/.env.example .settings/.env
# Edit .settings/.env with your API key and base URL

# Install TUI dependencies
cd TUI && bun install && cd ..
```

### Run (single command)

```bash
./mimo
```

This starts the Python backend, waits until it's ready, then launches the TUI. Both are cleaned up automatically on exit.

### Run manually (two terminals)

```bash
# Terminal 1: backend
cd Scripts && python server.py

# Terminal 2: TUI
cd TUI && bun run index.ts
```

## Commands

| Command  | Description             |
| -------- | ----------------------- |
| `/help`  | Show available commands |
| `/clear` | Clear chat history      |
| `/quit`  | Exit the application    |

## Project Structure

```
MiMo-TUI/
├── mimo                   # Single entry point (starts backend + TUI)
├── .settings/             # Configuration
│   └── .env.example       # API key & model config template
├── TUI/                   # Bun/TypeScript TUI (OpenTUI)
│   ├── index.ts           # Main TUI interface
│   ├── lib/
│   │   ├── ws-client.ts   # WebSocket client
│   │   └── chat-store.ts  # Chat message state
│   └── package.json
├── Scripts/               # Python backend
│   ├── server.py          # FastAPI WebSocket + LLM server
│   └── requirements.txt
└── README.md
```