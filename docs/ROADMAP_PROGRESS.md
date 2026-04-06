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

### Completed (Documentation)
- [x] Docs: USER_MANUAL.md updated with Claude Code Sessions (section 13) and Multi-Machine Orchestration (section 14)
- [x] Docs: helpContent.ts updated with "sessions" and "machines" help sections
- [x] Docs: ManualPage.tsx updated with sectionMockups entries for new sections
- [x] Docs: USER_MANUAL.md sections 1 and 12 updated to document the orchestrator sidecar setup

## Multi-Machine Agent Management — Backend Infrastructure

### Completed
- [x] Backend: Machine model (app/models/machine.py) — machine_uuid, name, hostname, platform, status, agent/CLI versions, API key hash, pairing code, health JSON, registered_at
- [x] Backend: ClaudeSession model updated — machine_id FK to machines table, machine relationship, composite index on (machine_id, status)
- [x] Backend: Alembic migration 008_multi_machine — creates machines table with all columns/indexes, adds machine_id FK to claude_sessions
- [x] Backend: Machine Pydantic schemas (app/schemas/machine.py) — MachineCreate, MachineUpdate, MachineResponse, MachineHealthResponse, PairingCodeResponse, PairingRequest, PairingResponse
- [x] Backend: SessionCreate/SessionResponse schemas updated — machine_id field added
- [x] Backend: AgentConnectionManager service (app/services/agent_manager.py) — WebSocket connection tracking, API key validation, heartbeat handling, session output relay, session lifecycle (started/completed/failed), approval forwarding, shutdown
- [x] Backend: Machines REST router (app/routers/machines.py) — GET/POST/PUT/DELETE /api/machines, pairing-code generation, pair completion, health endpoint, install script serving (mac/windows)
- [x] Backend: Agent WebSocket endpoint (app/routers/agent_ws.py) — /ws/agent with agent.hello auth handshake, server.welcome, message loop, graceful disconnect cleanup
- [x] Backend: SessionManager updated (app/services/session_manager.py) — machine_id parameter in create_session, _create_session_on_agent dispatch, abort_session with remote agent support
- [x] Backend: Sessions router updated (app/routers/sessions.py) — machine_id query param on list_sessions, machine_id passed to create_session
- [x] Backend: models/__init__.py updated — Machine import added before ClaudeSession
- [x] Backend: main.py updated — machines + agent_ws routers registered, agent_manager.shutdown() in lifespan

## Node.js Agent Package — @promptflow/agent

### Completed
- [x] Agent: package.json with commander, ws, yaml dependencies (services/agent/package.json)
- [x] Agent: TypeScript config with CommonJS target ES2022 (services/agent/tsconfig.json)
- [x] Agent: Message protocol types — agent/server messages, stream-json types, content blocks (src/protocol.ts)
- [x] Agent: Config loader — YAML file + env vars + CLI args, cross-platform ~ expansion, config persistence (src/config.ts)
- [x] Agent: WebSocket client — outbound connection, agent.hello handshake, exponential backoff reconnect (1s-30s), 30s heartbeat (src/connection.ts)
- [x] Agent: Session runner — spawns Claude CLI with stream-json, stdin prompt, line-by-line stdout parsing, cross-platform abort (SIGTERM/taskkill) (src/session-runner.ts)
- [x] Agent: System health reporter — CPU, memory, disk metrics with Mac/Windows support (src/health.ts)
- [x] Agent: HTTP pairing flow — POST to /api/machines/pair, saves config on success (src/pairing.ts)
- [x] Agent: Main Agent class — orchestrates connection, sessions, health, signal handling (src/agent.ts)
- [x] Agent: CLI entry point — pair, start, status, config commands via commander (src/index.ts)
- [x] Agent: Example config file (promptflow-agent.yaml.example)
- [x] Agent: README with install, setup, and platform notes (README.md)

### Completed (Frontend — Multi-Machine UI)
- [x] Frontend: Machine TypeScript types (src/types/machine.ts) — Machine, MachineHealth, MachineStatus, MachinePlatform, PairingCode, MachineState, MachineAction
- [x] Frontend: Machine store with useSyncExternalStore (src/stores/machineStore.ts) — singleton store, reducer, cached selectors: useMachines, useMachine, useOnlineMachines, useMachineStats
- [x] Frontend: API client extended with machine endpoints (src/api/client.ts) — getMachines, getMachine, createMachine, updateMachine, deleteMachine, generatePairingCode, getInstallScript
- [x] Frontend: MachineCard component (src/components/machines/MachineCard.tsx) — color-coded border, platform badge, status dot, health bars (CPU/MEM/SESS), relative time, edit/remove actions
- [x] Frontend: MachineEditModal component (src/components/machines/MachineEditModal.tsx) — name, color picker (8 presets), workspace root, max sessions, remove with confirmation
- [x] Frontend: SetupWizard component (src/components/machines/SetupWizard.tsx) — 5-step modal (platform/pairing/instructions/waiting/done), pairing code generation, copyable install commands, auto-detection polling, step indicator
- [x] Frontend: MachinesPage (src/pages/MachinesPage.tsx) — stats bar (online/offline/pairing), machine card grid, empty state, wizard + edit modal integration
- [x] Frontend: Machine selector in SessionCreateModal — dropdown with online machines, session load display, auto (least loaded) default, color badge for selected machine
- [x] Frontend: Layout updated — Machines nav link with online count and offline alert badge
- [x] Frontend: App.tsx — /machines route added
- [x] Frontend: WebSocket handler updated — machine.status_changed and machine.registered message handling
- [x] Frontend: CSS variables added — --machine-online, --machine-offline, --machine-pairing
- [x] Frontend: SessionCreateRequest type updated — machineId field added
- [x] Frontend: WsServerMessage type updated — machine.status_changed and machine.registered variants

### Pending
- [ ] Backend: Tests for machine CRUD, pairing flow, agent WebSocket, agent manager

### Completed (Bug Fixes — E2E Testing)
- [x] Frontend: Fix SessionsPage crash on undefined initialPrompt/id substring (BUG-001)
- [x] Backend: Fix test_machine output extraction from metadata_json (BUG-002)
- [x] Frontend + Backend: SetupWizard cleanup on cancel — delete pending machine record (BUG-003)
- [x] Frontend: MachineCard null guard on machine_uuid.substring (BUG-004)
- [x] Frontend: ErrorBoundary component wrapping main content area in Layout
- [x] Frontend: Sessions page empty state with "Create your first session" CTA

### Pending (Future Enhancements)
- [ ] Frontend: Markdown rendering for assistant messages
- [ ] Frontend: Code block syntax highlighting
- [ ] Frontend: Token/cost display component
- [ ] Frontend: Virtual scrolling for 10K+ messages
- [ ] Frontend: Session search and filtering
