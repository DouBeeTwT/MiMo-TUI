"""
MiMo TUI Backend Server

WebSocket server that receives user messages from the TUI,
combines them with a system prompt, and streams responses
from an OpenAI-compatible LLM API.

Environment variables:
    OPENAI_API_KEY   - API key for the LLM service
    OPENAI_BASE_URL  - Base URL for OpenAI-compatible API (default: https://api.openai.com/v1)
    MODEL_NAME       - Model name to use (default: gpt-3.5-turbo)
    SYSTEM_PROMPT    - System prompt for the LLM (default: built-in MiMo prompt)
    WS_HOST          - WebSocket server host (default: 0.0.0.0)
    WS_PORT          - WebSocket server port (default: 8765)
"""

import json
import os
import asyncio
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from openai import AsyncOpenAI

# Load .env from .settings/ (one level up from Scripts/)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".settings", ".env"))

# ── Configuration ───────────────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-3.5-turbo")
WS_HOST = os.getenv("WS_HOST", "0.0.0.0")
WS_PORT = int(os.getenv("WS_PORT", "8765"))

DEFAULT_SYSTEM_PROMPT = (
    "你是 MiMo，一个由小米开发的智能助手。"
    "你善于思考，乐于助人，回答简洁准确。"
)

SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT)

# ── OpenAI client ───────────────────────────────────────────────────────
client = AsyncOpenAI(
    api_key=OPENAI_API_KEY,
    base_url=OPENAI_BASE_URL,
)

# ── FastAPI app ─────────────────────────────────────────────────────────
app = FastAPI(title="MiMo TUI Backend")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print("[server] Client connected")

    # Per-connection message history
    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    try:
        while True:
            # ── Receive message from TUI ────────────────────────────
            raw = await ws.receive_text()
            data = json.loads(raw)

            msg_type = data.get("type", "")

            if msg_type == "user_message":
                user_content = data.get("content", "").strip()
                if not user_content:
                    continue

                print(f"[server] User: {user_content}")

                # Add to conversation history
                messages.append({"role": "user", "content": user_content})

                # ── Call LLM with streaming ─────────────────────────
                try:
                    stream = await client.chat.completions.create(
                        model=MODEL_NAME,
                        messages=messages,
                        stream=True,
                    )

                    full_response = ""

                    async for chunk in stream:
                        if not chunk.choices:
                            continue
                        delta = chunk.choices[0].delta
                        if delta.content:
                            token = delta.content
                            full_response += token
                            await ws.send_json({
                                "type": "token",
                                "content": token,
                            })

                    # Add assistant response to history
                    messages.append({
                        "role": "assistant",
                        "content": full_response,
                    })

                    # Signal completion
                    await ws.send_json({"type": "done"})
                    print(f"[server] Response complete ({len(full_response)} chars)")

                except Exception as e:
                    error_msg = str(e)
                    print(f"[server] LLM error: {error_msg}")
                    await ws.send_json({
                        "type": "error",
                        "content": error_msg,
                    })

            elif msg_type == "clear":
                # Reset conversation history
                messages = [{"role": "system", "content": SYSTEM_PROMPT}]
                await ws.send_json({"type": "cleared"})

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        print("[server] Client disconnected")
    except Exception as e:
        print(f"[server] Error: {e}")


if __name__ == "__main__":
    import uvicorn

    print(f"[server] Starting MiMo TUI Backend")
    print(f"[server] Model: {MODEL_NAME}")
    print(f"[server] API: {OPENAI_BASE_URL}")
    print(f"[server] WebSocket: ws://{WS_HOST}:{WS_PORT}/ws")

    if not OPENAI_API_KEY:
        print("[server] WARNING: OPENAI_API_KEY is not set!")

    uvicorn.run(app, host=WS_HOST, port=WS_PORT)
