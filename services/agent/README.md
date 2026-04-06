# PromptFlow Agent

A Node.js CLI agent that connects to the PromptFlow server to remotely orchestrate Claude Code CLI sessions. Runs on macOS and Windows developer workstations.

## Prerequisites

- **Node.js 18+** (required by Claude Code CLI)
- **Claude Code CLI** installed and authenticated (`claude` command in PATH)
- A running PromptFlow server instance

## Installation

```bash
# From the agent directory
npm install
npm run build

# Link globally (optional, for the `promptflow-agent` command)
npm link
```

## Quick Start

### 1. Generate a pairing code

Open the PromptFlow web UI and navigate to **Machines**. Click **Add Machine** to generate a 6-character pairing code.

### 2. Pair the agent

```bash
promptflow-agent pair ABC123 --server http://192.168.2.188:3001
```

This saves credentials to `~/.promptflow/agent.yaml`.

Optional flags:
- `--name "My Workstation"` — set a custom machine name
- `--workspace ~/projects` — set the workspace root directory
- `--max-sessions 5` — allow up to 5 concurrent sessions

### 3. Start the agent

```bash
promptflow-agent start
```

The agent connects to the server via WebSocket, reports health metrics every 30 seconds, and waits for session commands.

Press `Ctrl+C` to stop.

## Commands

| Command | Description |
|---|---|
| `promptflow-agent pair <code> -s <url>` | Pair with a PromptFlow server |
| `promptflow-agent start` | Start the agent (foreground) |
| `promptflow-agent status` | Show agent status and system health |
| `promptflow-agent config` | Show current configuration |
| `promptflow-agent config --path` | Print config file path |

## Configuration

Configuration is loaded from (highest priority first):

1. CLI flags
2. Environment variables (`PROMPTFLOW_AGENT_*`)
3. Config file (`~/.promptflow/agent.yaml`)
4. Built-in defaults

### Environment Variables

| Variable | Description |
|---|---|
| `PROMPTFLOW_AGENT_SERVER_URL` | WebSocket server URL |
| `PROMPTFLOW_AGENT_MACHINE_NAME` | Machine display name |
| `PROMPTFLOW_AGENT_AUTH_TOKEN` | Authentication token |
| `PROMPTFLOW_AGENT_MACHINE_UUID` | Machine unique ID |
| `PROMPTFLOW_AGENT_WORKSPACE_ROOT` | Root directory for workspaces |
| `PROMPTFLOW_AGENT_MAX_CONCURRENT_SESSIONS` | Max concurrent sessions |
| `PROMPTFLOW_AGENT_LOG_LEVEL` | Log level (debug/info/warn/error) |

### Config File

See `promptflow-agent.yaml.example` for a documented example.

## Development

```bash
# Run in development mode (with auto-reload via tsx)
npm run dev -- start

# Build TypeScript
npm run build

# Run from compiled output
npm start -- start
```

## How It Works

1. The agent connects **outbound** to the PromptFlow server via WebSocket.
2. On connect, it sends an `agent.hello` message with machine info and health metrics.
3. The server can dispatch `server.session.create` commands to spawn Claude CLI processes.
4. Claude CLI output (stream-json format) is parsed line-by-line and relayed back to the server in real-time.
5. Health metrics (CPU, memory, disk, active sessions) are reported every 30 seconds.
6. If the connection drops, the agent auto-reconnects with exponential backoff (1s to 30s max).

## Platform Notes

### macOS
- CPU usage is derived from `os.loadavg()` normalized to core count.
- Disk space is read from `df -k /`.
- Sessions are terminated via `SIGTERM`, with a `SIGKILL` fallback after 5 seconds.

### Windows
- CPU usage is estimated from `os.cpus()` idle time ratios.
- Disk space is read via `wmic logicaldisk`.
- Sessions are terminated via `taskkill /T /F` to kill the entire process tree.
- The CLI spawns with `shell: true` to resolve `.cmd` scripts.
