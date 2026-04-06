# Roadmap Progress

## v1.0 — Initial Release

### Core Features
- [x] Project scaffolding (Docker Compose, Dockerfiles, directory structure)
- [x] Backend: FastAPI app with async SQLAlchemy + PostgreSQL
- [x] Backend: Alembic migrations (initial schema)
- [x] Backend: CRUD API for Groups, Variables, Templates, Executions
- [x] Backend: Template renderer (placeholder substitution)
- [x] Frontend: React + TypeScript + Vite setup
- [x] Frontend: Layout with sidebar navigation
- [x] Frontend: Group management (create, edit, delete)
- [x] Frontend: Variable management per group
- [x] Frontend: Template editor (create, edit, delete)
- [x] Frontend: Live prompt preview with variable substitution
- [x] Frontend: Copy-to-clipboard for rendered prompts
- [x] Frontend: Save execution to history
- [x] Frontend: Execution history page with filtering

### Pending
- [ ] Import/export prompt groups (JSON)
- [ ] Search across templates
- [ ] Template ordering (drag-and-drop)
- [ ] Variable validation rules
- [ ] Dark/light theme toggle

## Claude Code Orchestrator — Sidecar Service

### Completed
- [x] Orchestrator sidecar: project scaffold (requirements.txt, run.sh, app structure)
- [x] Orchestrator sidecar: Pydantic settings config (app/config.py)
- [x] Orchestrator sidecar: Request/response schemas (app/schemas.py)
- [x] Orchestrator sidecar: SessionManager core — subprocess spawn, stdout reader, message queue, stream, abort, shutdown (app/session_manager.py)
- [x] Orchestrator sidecar: Session REST endpoints + SSE streaming (app/routers/sessions.py)
- [x] Orchestrator sidecar: FastAPI app with auth middleware, CORS, /health, lifespan, structlog (app/main.py)

### Pending
- [ ] Orchestrator sidecar: Cost tracking and session timeout enforcement
- [ ] Orchestrator sidecar: Tool approval flow (human-in-the-loop via can_use_tool callback)

## Claude Code Orchestrator — Backend Foundation

### Completed
- [x] Backend: Expanded config.py with orchestrator settings (orchestrator_url, sidecar_secret, workspace_root, session limits, auth, logging)
- [x] Backend: database.py pool configuration (pool_size=10, max_overflow=20, pool_pre_ping, pool_recycle)
- [x] Backend: ClaudeSession model (UUID PK, FK to groups/templates/executions, status enum, cost tracking, JSONB config)
- [x] Backend: SessionMessage model (BigInteger PK, session FK, sequence, role, content, JSONB metadata, cost)
- [x] Backend: PendingApproval model (session FK, tool_use_id, tool_name, JSONB tool_input, resolution tracking)
- [x] Backend: Pydantic schemas for sessions, messages, approvals (SessionCreate, SessionResponse, SessionUpdate, etc.)
- [x] Backend: Alembic migration 002_claude_sessions (3 tables, indexes including partial index for unresolved approvals)
- [x] Backend: requirements.txt updated (structlog, prometheus-client, httpx, websockets)
- [x] Backend: Auth middleware with session-cookie auth (HMAC-signed tokens, dev bypass, login/status/logout endpoints)
- [x] Backend: main.py updated (structlog logging, lifespan handler, CORS lockdown, DB health check, /api/metrics stub)

- [x] Backend: Sidecar HTTP client with circuit breaker (app/services/sidecar_client.py)
- [x] Backend: Session manager — lifecycle, background SSE relay, WebSocket fan-out, message persistence (app/services/session_manager.py)
- [x] Backend: Session CRUD router — POST/GET/DELETE /api/sessions, abort, messages, sidecar health proxy (app/routers/sessions.py)
- [x] Backend: WebSocket endpoint /ws/orchestrator — subscribe/unsubscribe/abort/ping-pong (app/routers/websocket.py)
- [x] Backend: main.py updated — sessions + websocket routers registered, session_manager.shutdown() in lifespan
- [x] Backend: database.py — async_session_factory alias for background tasks
- [x] Backend: SessionCreate schema updated — prompt field, permission_mode, allowed_tools

### Pending
- [x] Backend: Test suite — pytest + pytest-asyncio + aiosqlite, in-memory SQLite with PG type compilation, 63 tests covering health, groups CRUD, templates CRUD + render, renderer unit tests, sessions with mocked sidecar, sidecar circuit breaker unit tests, WebSocket ping/pong/subscribe/error handling
- [ ] Backend: Approval router (GET/POST /api/approvals)
- [ ] Backend: Tool approval flow integration with sidecar

## Claude Code Orchestrator — Frontend Foundation

### Completed
- [x] Frontend: Session TypeScript types (src/types/session.ts) — SessionStatus, ContentBlock variants, SessionMessage, ToolApprovalRequest, ClaudeSession, WsClientMessage, WsServerMessage, SessionState, SessionAction
- [x] Frontend: Session store with useSyncExternalStore (src/stores/sessionStore.ts) — zero-dependency state management with reducer, singleton store, selector hooks, convenience selectors
- [x] Frontend: WebSocket connection manager (src/hooks/useWebSocket.ts) — auto-connect, exponential backoff reconnect, heartbeat, rAF message batching
- [x] Frontend: Session action helpers (src/hooks/useSessionActions.ts) — createSession, sendInput, approveToolUse, abortSession, removeSession, loadSessions
- [x] Frontend: WebSocket React context provider (src/providers/WebSocketContext.tsx) — provides send() and actions to component tree
- [x] Frontend: Extended API client with session endpoints (src/api/client.ts) — getSessions, createSession, getSession, deleteSession, getSessionMessages, checkSidecarHealth
- [x] Frontend: Vite WebSocket proxy config (vite.config.ts) — /ws proxy to backend
- [x] Frontend: App entry point updated (src/main.tsx) — WebSocketProvider wraps App

### Pending
- [ ] Frontend: Session list sidebar component

## Claude Code Orchestrator — Docker & Developer Tooling

### Completed
- [x] Docker: Network isolation (frontend-net, backend-net) in docker-compose.yml
- [x] Docker: extra_hosts for Linux host.docker.internal compatibility
- [x] Docker: Orchestrator env vars in backend service (ORCHESTRATOR_URL, SIDECAR_SECRET, etc.)
- [x] Docker: Logging driver config (json-file, 10m max, 3 files) on all services
- [x] Docker: DB port restricted to localhost (127.0.0.1)
- [x] Docker: .dockerignore for backend and frontend services
- [x] Config: .env.example updated with orchestrator and auth sections
- [x] Tooling: Makefile with unified dev commands (setup, dev, stop, logs, test, sidecar-*, db-*, clean)
- [x] Tooling: scripts/setup.sh prerequisites checker
- [x] Docs: README.md with architecture diagram, config reference, and troubleshooting
- [x] Git: .gitignore updated for sidecar, data, logs, Playwright

### Completed (Testing)
- [x] Frontend: Vitest config + jsdom test environment (vitest.config.ts)
- [x] Frontend: Test setup with WebSocket mock (src/__tests__/setup.ts)
- [x] Frontend: Session store unit tests — 20 tests covering all reducer actions, subscriptions (src/__tests__/sessionStore.test.ts)
- [x] Frontend: API client unit tests — 9 tests covering GET/POST/DELETE, error handling (src/__tests__/api.test.ts)
- [x] Frontend: Playwright E2E config (playwright.config.ts)
- [x] Frontend: E2E navigation tests (e2e/navigation.spec.ts)
- [x] Frontend: E2E group management tests (e2e/groups.spec.ts)
- [x] Frontend: E2E template management tests (e2e/templates.spec.ts)
- [x] Frontend: E2E session page tests (e2e/sessions.spec.ts)
- [x] Frontend: E2E full workflow tests (e2e/prompt-workflow.spec.ts)
- [x] Frontend: package.json test scripts (test, test:watch, test:e2e, test:e2e:ui)

### Completed (Frontend UI)
- [x] Frontend: SessionsPage with tab bar, session list sidebar, new session button (src/pages/SessionsPage.tsx)
- [x] Frontend: SessionTerminal — scrollable message display with auto-scroll, type-based rendering (src/components/session/SessionTerminal.tsx)
- [x] Frontend: ToolApprovalCard — inline approve/deny with keyboard shortcuts (src/components/session/ToolApprovalCard.tsx)
- [x] Frontend: SessionCreateModal — prompt, working dir, model, name config (src/components/session/SessionCreateModal.tsx)
- [x] Frontend: ConnectionStatus — WS/sidecar connection indicator (src/components/session/ConnectionStatus.tsx)
- [x] Frontend: Layout updated — Sessions nav link with approval badge count
- [x] Frontend: App.tsx — /sessions route added
- [x] Frontend: GroupPage — "Send to Claude" button in preview pane

### Pending (Future Enhancements)
- [ ] Frontend: Markdown rendering for assistant messages
- [ ] Frontend: Code block syntax highlighting
- [ ] Frontend: Token/cost display component
- [ ] Frontend: Virtual scrolling for 10K+ messages
- [ ] Frontend: Session search and filtering
