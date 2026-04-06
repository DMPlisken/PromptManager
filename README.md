# PromptManager

A web-based tool for managing, filling, and reusing prompt templates with shared variables -- plus an optional Claude Code CLI orchestrator for spawning AI coding sessions directly from the UI.

## Quick Start

```bash
git clone https://github.com/DMPlisken/PromptManager.git
cd PromptManager
make setup    # installs deps, builds containers
make dev      # starts all services
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

```
 Browser :3000         Backend :8000          DB :5432
+--------------+      +---------------+      +----------+
|  React SPA   |----->|  FastAPI API  |----->| Postgres |
|  (Vite)      |      |  (async)      |      |   16     |
+--------------+      +-------+-------+      +----------+
   frontend-net     frontend-net | backend-net  backend-net

                          |
                    host.docker.internal
                          |
                  +-------v-------+
                  |   Sidecar     |
                  |  :9100        |
                  |  (host-native)|
                  +---------------+
                  Claude Code CLI
                  orchestrator
```

- **Frontend** -- React 18 + TypeScript, served by Vite dev server.
- **Backend** -- Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic migrations.
- **Database** -- PostgreSQL 16 (Alpine), persistent volume.
- **Sidecar** -- Host-native FastAPI service managing Claude Code CLI subprocesses. Communicates with the backend via `host.docker.internal`.

Network isolation: Frontend and Backend share `frontend-net`. Backend and Database share `backend-net`. The database is not reachable from the frontend container.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `promptmgr` | Database user |
| `POSTGRES_PASSWORD` | `promptmgr` | Database password |
| `POSTGRES_DB` | `promptmanager` | Database name |
| `DB_PORT` | `5432` | Host port for PostgreSQL |
| `BACKEND_PORT` | `8000` | Host port for backend API |
| `FRONTEND_PORT` | `3000` | Host port for frontend |
| `SIDECAR_PORT` | `9100` | Host port for orchestrator sidecar |
| `SIDECAR_SECRET` | (empty) | Shared secret for backend-sidecar auth |
| `WORKSPACE_ROOT` | `~/projects` | Root directory for Claude sessions |
| `MAX_CONCURRENT_SESSIONS` | `5` | Max simultaneous Claude sessions |
| `SESSION_TIMEOUT_MINUTES` | `30` | Session auto-timeout |
| `SESSION_COST_BUDGET_USD` | `10.0` | Per-session cost limit |
| `CLAUDE_DEFAULT_MODEL` | `sonnet` | Default Claude model |
| `APP_SECRET` | (empty) | App-level auth secret |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:3000` | CORS origin |

## Development Commands

All commands are run from the project root via `make`:

| Command | Description |
|---|---|
| `make setup` | Install dependencies, build containers |
| `make dev` | Start all services (Docker + sidecar) |
| `make stop` | Stop all services |
| `make restart` | Stop then start all services |
| `make logs` | Tail logs from all services |
| `make status` | Show service status and health |
| `make health` | Detailed health check output |
| `make test` | Run backend and frontend tests |
| `make test-backend` | Run backend tests only |
| `make test-frontend` | Run frontend tests only |
| `make test-e2e` | Run Playwright end-to-end tests |
| `make db-migrate` | Run Alembic migrations |
| `make db-reset` | Drop and recreate the database |
| `make sidecar-start` | Start orchestrator sidecar |
| `make sidecar-stop` | Stop orchestrator sidecar |
| `make sidecar-restart` | Restart orchestrator sidecar |
| `make sidecar-logs` | Tail sidecar logs |
| `make clean` | Stop services, remove volumes and venvs |

## Orchestrator (Sidecar)

The orchestrator is an optional host-native service that lets you spawn and manage Claude Code CLI sessions through the web UI. It runs outside Docker because it needs direct access to the host filesystem and the `claude` CLI binary.

**Prerequisites for orchestrator features:**
- Node.js 18+ (for Claude Code CLI)
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- Python 3.12+ (for the sidecar process)

The sidecar manages sessions as subprocesses, streams output via SSE, and enforces cost/timeout budgets. The backend communicates with it over HTTP using `host.docker.internal`.

## Prerequisites Check

Run the prerequisites checker before first setup:

```bash
./scripts/setup.sh
```

This verifies Docker, Docker Compose, Python, Node.js, and Claude CLI are installed, and checks that required ports are available.

## Troubleshooting

**Port already in use**
Change the port in `.env` (e.g., `BACKEND_PORT=8001`) or stop the conflicting process.

**Database connection refused**
Wait a few seconds after `make dev` -- the backend waits for the DB health check. Check with `docker compose ps` to verify the DB container is healthy.

**Sidecar won't start**
Run `make setup` first to create the virtual environment. Check `logs/sidecar.log` for errors.

**Backend can't reach sidecar (Linux)**
The `extra_hosts` config maps `host.docker.internal` to the host gateway. If it still fails, set `ORCHESTRATOR_URL=http://172.17.0.1:9100` in `.env`.

**Alembic migration errors**
Run `make db-reset` to start fresh, or `make db-migrate` to apply pending migrations.

**Container build failures**
Run `make clean` then `make setup` to rebuild from scratch.
