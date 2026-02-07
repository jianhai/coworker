# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A multi-room chat application with AI bot support. Backend in Rust (Axum), frontend in React (Vite). Data stored in memory with auto-save persistence to `~/.cowork/data.json`.

## Build Commands

```bash
# Using Makefile (recommended)
make build              # Build both backend and frontend
make backend            # Build backend only
make frontend           # Build frontend only
make run-backend        # Run backend server
make run-frontend       # Run frontend dev server
make clean              # Clean build artifacts
make init-config        # Create ~/.cowork/settings.json
make show-config        # Show current configuration

# Direct commands
cargo build --manifest-path=backend/Cargo.toml
cd frontend && npm run build       # Build frontend
cd frontend && npm run dev         # Dev server with hot reload
```

## Configuration

All configuration is in `~/.cowork/settings.json`:

```json
{
  "backend": {
    "url": "http://127.0.0.1:3000",
    "bind_address": "127.0.0.1:3000"
  },
  "frontend": {
    "port": 5173,
    "host": "0.0.0.0"
  },
  "ai": {
    "api_key": "...",
    "api_url": "https://api.deepseek.com/v1/chat/completions"
  }
}
```

- `backend.bind_address`: Where backend server binds (TCP listener)
- `backend.url`: Frontend uses this to connect to backend API
- `frontend.port/host`: Vite dev server settings (reads from config at build time)
- `ai.api_key/api_url`: AI bot configuration

Frontend `vite.config.ts` reads this file at startup for proxy target and port.

## Architecture

### Backend (`backend/`)

**Entry point:** `src/main.rs` - loads config, initializes `AppState`, starts Axum server

**Core modules:**
- `models.rs` - Core data structures: `AppState`, `Room`, `Message`, `Bot`, `ClientMessage`/`ServerMessage` enums
- `websocket.rs` - WebSocket handler, connection management, message routing
- `auth.rs` - JWT token generation/verification, user registration/login
- `rooms.rs` - HTTP API for room CRUD, bot management, member list
- `bot.rs` - Bot creation/deletion endpoints
- `ai.rs` - AI service integration (DeepSeek API)
- `storage.rs` - Persistence to `~/.cowork/data.json`, auto-save every 30s
- `config.rs` - Configuration loading from `~/.cowork/settings.json`

**Message flow:**
1. Client sends WebSocket message with token first
2. Server verifies token, extracts username
3. For `message` type: checks if @mentions a bot, routes to AI or keyword response
4. Broadcasts to all users in room (including sender)

**Bot system:**
- `room_bots: RoomBots` - room_id -> (bot_id -> Bot)
- `bot_memory: BotMemory` - conversation history per bot, keyed as "room_id:bot_id"
- `active_bots: ActiveBots` - tracks last @mentioned bot per user per room with 60s timeout
- Bots respond via keyword matching OR AI API (if configured)

### Frontend (`frontend/`)

**Entry point:** `src/App.tsx` - React Router with auth check

**Pages:**
- `src/pages/LoginPage.tsx` - Login/register forms
- `src/pages/ChatPage.tsx` - Main chat interface with room list and chat window

**Components:**
- `RoomList.tsx` - Room cards, double-click for member list
- `ChatWindow.tsx` - Chat header, message list, input
- `MessageList.tsx` - Message rendering with gradient bubbles
- `BotSettings.tsx` - Bot creation/management UI

**Hooks:**
- `useWebSocket.ts` - WebSocket connection with auto-reconnect, auth on connect

**API client:**
- `src/api.ts` - `getApiUrl()` fetches from `/api/config` endpoint, caches result

## WebSocket Protocol

**Client → Server:**
```json
{"type": "join_room", "room_id": "..."}
{"type": "message", "room_id": "...", "content": {"content_type": "text", "text": "..."}}
{"type": "leave_room", "room_id": "..."}
{"type": "typing", "room_id": "..."}
```

**Server → Client:**
```json
{"type": "message", "room_id": "...", "message": {...}}
{"type": "user_joined", "room_id": "...", "username": "..."}
{"type": "user_left", "room_id": "...", "username": "..."}
{"type": "history", "room_id": "...", "messages": [...]}
{"type": "error", "message": "..."}
```

**Authentication:** First message must be `{"token": "..."}`.

## Key Types

**Backend (models.rs):**
- `AppState` - Global state: users, rooms, connections, bots, memory, active_bots
- `Room` - id, name, members (HashSet), messages (Vec, max 100), bots (Vec)
- `Bot` - id, name, avatar, keywords (HashMap), default_reply, ai_model (optional)
- `ActiveBotInfo` - bot_id + timestamp (for timeout tracking)

**Frontend (types/index.ts):**
- `Message`, `Room`, `ClientMessage`, `ServerMessage`, `Bot`, `BotDetail`

## Data Persistence

- Location: `~/.cowork/data.json`
- Format: JSON with users, rooms, room_bots, bot_memory, active_bots
- Auto-saves every 30 seconds via `storage::auto_save_task()`
- Loads on startup via `storage::init_state_with_persistence()`
