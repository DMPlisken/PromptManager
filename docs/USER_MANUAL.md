# PromptFlow — User Manual

**Version:** 2.0
**Last updated:** 2026-04-06

> **Note:** This manual is also available interactively inside the app. Click the **"Manual"** link in the sidebar or click any **"?"** button next to a section header for context-specific help. The interactive manual and this file are kept in sync — the source of truth is `src/data/helpContent.ts`.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Core Concepts](#2-core-concepts)
3. [Dashboard](#3-dashboard)
4. [Managing Groups](#4-managing-groups)
5. [Managing Variables](#5-managing-variables)
6. [Managing Templates](#6-managing-templates)
7. [Filling Variables & Previewing Prompts](#7-filling-variables--previewing-prompts)
8. [Copying the Final Prompt](#8-copying-the-final-prompt)
9. [Saving Executions to History](#9-saving-executions-to-history)
10. [Browsing Execution History](#10-browsing-execution-history)
11. [Typical Workflows](#11-typical-workflows)
12. [Docker Commands Reference](#12-docker-commands-reference)
13. [Claude Code Sessions](#13-claude-code-sessions)
14. [Multi-Machine Orchestration (Coming Soon)](#14-multi-machine-orchestration-coming-soon)

---

## 1. Getting Started

### Prerequisites

- Docker and Docker Compose installed on your machine.

### Starting the Application

```bash
cd PromptFlow
docker compose up -d --build
```

This starts three containers:

| Service   | URL                        | Purpose                |
|-----------|----------------------------|------------------------|
| Frontend  | http://localhost:3003       | Web UI (nginx)         |
| Backend   | http://localhost:8010       | REST API (FastAPI)     |
| Database  | localhost:5433              | PostgreSQL 16          |

Open **http://localhost:3003** in your browser.

### Claude Code Orchestrator (Optional Sidecar)

To use the **Claude Code Sessions** feature (see [Section 13](#13-claude-code-sessions)), start the orchestrator sidecar on your host machine:

```bash
cd services/orchestrator
./run.sh
```

The sidecar runs on **http://localhost:9100** and manages Claude Code CLI subprocesses. It communicates with the backend over a shared secret (`SIDECAR_SECRET` in `.env`). The sidecar must run on the same machine where Claude Code CLI is installed — it is **not** containerized.

### Stopping the Application

```bash
docker compose down
```

Data is persisted in a Docker volume (`pgdata`). Your groups, templates, variables, and execution history survive restarts.

---

## 2. Core Concepts

PromptFlow is built around four entities:

| Concept        | What it is                                                                 |
|----------------|---------------------------------------------------------------------------|
| **Group**      | A collection of related prompts that share the same set of variables. Example: "Design", "Develop", "Audit". |
| **Variable**   | A named placeholder scoped to a group. Written as `{{VARIABLE_NAME}}` inside templates. All templates in the same group share the same variables. |
| **Template**   | A prompt text containing `{{PLACEHOLDER}}` tokens. When you fill in the variables, the placeholders are replaced with your values. |
| **Execution**  | A saved record of a fully rendered prompt along with the variable values used and optional notes. This is your history/audit trail. |

### How They Relate

```
Group (e.g. "Design Prompts")
 ├── Variables: {{TASK_TITLE}}, {{DESCRIPTION}}, {{ITERATIONS}}
 ├── Template A: "Design a UI for {{TASK_TITLE}}..."
 ├── Template B: "Review the design of {{TASK_TITLE}}..."
 └── Executions: saved rendered prompts with timestamps
```

Fill the variables **once** — all templates in the group update simultaneously.

---

## 3. Dashboard

The dashboard is the landing page at **http://localhost:3003**.

- Shows all existing **groups** as cards in a grid.
- Click any group card to open it.
- If no groups exist, a message prompts you to create one via the sidebar.

---

## 4. Managing Groups

### Creating a Group

1. In the **sidebar** (left panel), click **"+ New Group"**.
2. Type a group name (e.g., "Design", "Develop", "Audit").
3. Click **"Add"**.
4. The group appears in the sidebar and you can click it to open.

### Editing a Group

1. Open the group by clicking its name in the sidebar.
2. Click the **"Edit"** button (top right, next to the group name).
3. Modify the name and/or description.
4. Click **"Save"**.

### Deleting a Group

1. Open the group.
2. Click the **"Delete"** button (red, top right).
3. Confirm the deletion in the dialog.

> **Warning:** Deleting a group removes all its variables, templates, and execution history permanently.

---

## 5. Managing Variables

Variables are placeholders that you define per group. They use the `{{NAME}}` syntax inside templates.

### Adding a Variable

1. Open a group.
2. In the **Variables** card (left column), click **"+ Add"**.
3. Fill in:
   - **Variable name** — The placeholder name, e.g., `TASK_TITLE`, `DESCRIPTION`, `ITERATIONS`. Do NOT include the curly braces — just the name.
   - **Type** — Choose from:
     - `text` — Single-line input (default). Good for titles, short values.
     - `textarea` — Multi-line input. Good for descriptions, content blocks, code snippets.
     - `number` — Numeric input. Good for iteration counts, limits.
   - **Default value** (optional) — Pre-filled when you open the group.
4. Click **"Add Variable"**.

### Editing a Variable

1. Click **"edit"** next to any variable.
2. An inline form opens where you can change:
   - **Name** — The placeholder name.
   - **Type** — text, textarea, or number.
   - **Default value** — The pre-filled value.
3. Click **"Save"** to apply changes.

> **Note:** Renaming a variable does not auto-update existing templates. Update the `{{PLACEHOLDER}}` in your templates manually after renaming.

### Filling Variable Values

Once variables are defined, input fields appear in the Variables card. Simply type your values into the fields. The values are applied **live** to all templates in the group.

### Deleting a Variable

Click **"del"** next to any variable and confirm the deletion.

---

## 6. Managing Templates

Templates are the prompt texts that contain `{{PLACEHOLDER}}` tokens.

### Creating a Template

1. Open a group.
2. In the **Templates** card (left column, below Variables), click **"+ Add"**.
3. Fill in:
   - **Template name** — A descriptive name, e.g., "Design and Plan", "Code Review Prompt".
   - **Content** — The prompt text. Use `{{VARIABLE_NAME}}` wherever you want a placeholder to be substituted.
4. Click **"Create Template"**.

#### Example Template Content

```
Please design a solution for {{TASK_TITLE}}.

Description:
{{DESCRIPTION}}

Requirements:
- Provide {{ITERATIONS}} design iterations
- Include the following artefact: {{ARTEFACT}}
```

### Editing a Template

1. In the Templates list, click **"edit"** next to the template name.
2. The editor opens pre-filled with the current name and content.
3. Make your changes.
4. Click **"Update Template"**.

### Deleting a Template

Click **"del"** next to the template name. Confirm the deletion.

### Selecting a Template

Click a template name in the list to select it. The selected template is highlighted and its rendered preview appears in the right column.

---

## 7. Filling Variables & Previewing Prompts

This is the core workflow:

1. **Open a group** from the sidebar.
2. **Fill in the variable values** in the Variables card (left column). Type values into each field.
3. **Select a template** from the Templates list by clicking its name.
4. The **Prompt Preview** card (right column) shows the fully rendered prompt in real-time.
   - All `{{PLACEHOLDER}}` tokens are replaced with your variable values.
   - Any unfilled placeholders remain as `{{NAME}}` in the preview so you can see what's still missing.

### Switching Templates

Click a different template in the list. The preview updates instantly using the **same variable values** — no need to re-enter anything.

---

## 8. Copying the Final Prompt

1. After previewing a rendered prompt, click the **"Copy to Clipboard"** button below the preview.
2. The button briefly changes to **"Copied!"** to confirm.
3. Paste the prompt wherever you need it (Claude, ChatGPT, another tool, a document, etc.).

---

## 9. Saving Executions to History

After rendering and copying a prompt, you can save it as an execution record:

1. In the **"Save to History"** section (below the preview), optionally type **notes** describing what this prompt was used for (e.g., "Design iteration for login page", "Bug fix #42").
2. Click **"Save Execution"**.
3. A confirmation appears. The execution is now stored with:
   - The fully rendered prompt text
   - All variable values used
   - Your notes
   - A timestamp

---

## 10. Browsing Execution History

1. Click **"History"** in the sidebar (bottom).
2. The History page shows all saved executions, newest first.

### Filtering

Use the **dropdown** at the top right to filter by group (e.g., show only "Design" executions).

### Viewing an Execution

Click any execution row to expand it. You'll see:

- **Template name** and **group name** (as a badge)
- **Timestamp** of when it was saved
- **Notes** (if provided)
- **Variables used** — shown as pill-shaped tags with name:value pairs
- **Full rendered prompt** — the exact text that was generated

### Copying from History

Click **"Copy Prompt"** on any expanded execution to copy the rendered prompt to your clipboard again.

### Deleting an Execution

Click **"Delete"** on an expanded execution to remove it from history.

---

## 11. Typical Workflows

### Workflow 1: Setting Up a New Prompt Group

1. Create a group (e.g., "Feature Development").
2. Add variables: `TASK_TITLE` (text), `DESCRIPTION` (textarea), `ITERATIONS` (number), `ARTEFACT` (textarea).
3. Create multiple templates that use these variables:
   - "Design Prompt" — focuses on design/architecture
   - "Implementation Prompt" — focuses on coding
   - "Audit Prompt" — focuses on code review
4. Now all three prompts share the same variable inputs.

### Workflow 2: Using Prompts for a Task

1. Open the group.
2. Fill in the variables once with your task details.
3. Select "Design Prompt" → copy → use it.
4. Select "Implementation Prompt" → copy → use it (same variables, different prompt).
5. Select "Audit Prompt" → copy → use it.
6. Save each execution to history with notes about the outcome.

### Workflow 3: Re-using a Past Prompt

1. Go to History.
2. Find the execution you want to re-use.
3. Expand it and click "Copy Prompt".
4. Or note the variable values used, go to the group, fill the same values, and generate a fresh prompt.

---

## 12. Docker Commands Reference

| Command | Purpose |
|---------|---------|
| `docker compose up -d --build` | Start/rebuild all services |
| `docker compose down` | Stop all services (data persists) |
| `docker compose down -v` | Stop and **delete all data** (destructive!) |
| `docker compose up -d --build frontend` | Rebuild only the frontend after code changes |
| `docker compose up -d --build backend` | Rebuild only the backend after code changes |
| `docker compose logs frontend` | View frontend logs |
| `docker compose logs backend` | View backend logs |
| `docker compose ps` | Check container status |

### Port Configuration

Ports are configured in `.env`:

```
FRONTEND_PORT=3003
BACKEND_PORT=8010
DB_PORT=5433
```

Change these if they conflict with other services on your machine.

### Orchestrator Sidecar

The orchestrator sidecar runs **outside Docker** on your host machine. It manages Claude Code CLI subprocesses and streams output to the backend via SSE.

| Command | Purpose |
|---------|---------|
| `cd services/orchestrator && ./run.sh` | Start the sidecar (port 9100) |
| `make sidecar-start` | Start the sidecar via Makefile |
| `make sidecar-stop` | Stop the sidecar |
| `make sidecar-logs` | View sidecar logs |
| `curl http://localhost:9100/health` | Check sidecar health |

The sidecar requires `claude` CLI to be installed and available in your `PATH`. Configure the sidecar secret and URL in `.env`:

```
ORCHESTRATOR_URL=http://host.docker.internal:9100
SIDECAR_SECRET=your-shared-secret
```

---

## 13. Claude Code Sessions

Sessions let you send rendered prompts directly to Claude Code CLI and see the output in real-time, right in your browser. Instead of copying a prompt and pasting it into a terminal, you can launch a Claude Code session from within PromptFlow and watch it work.

### Creating a Session

There are two ways to start a session:

1. **From a group page:** After filling variables and previewing a prompt, click the **"Send to Claude"** button (next to "Copy to Clipboard" in the prompt preview pane).
2. **From the Sessions page:** Click **"+ New Session"** in the top bar.

When creating a session, configure:

- **Prompt text** — Pre-filled from the rendered prompt if launched from a group.
- **Working directory** — The directory Claude Code will operate in.
- **Model** — Choose Sonnet, Opus, or Haiku.
- **Session name** — A label for the sidebar (optional, auto-generated if blank).
- **Permission mode** — Controls tool approval behavior.

### Session Lifecycle

Each session moves through these states:

| Status | Meaning |
|--------|---------|
| `starting` | Session is being created, CLI process is spawning |
| `running` | Claude is actively working, streaming output |
| `waiting_approval` | Claude wants to use a tool (edit a file, run a command) and needs your approval |
| `completed` | Claude finished the task |
| `failed` | An error occurred (CLI crash, timeout, etc.) |

### The Sessions Page

- **Tab bar** (top) — Each active session has a tab. Click to switch between sessions. The active tab shows a colored status indicator.
- **Terminal output** (center) — Scrollable message area showing Claude's work in real-time:
  - **Text responses** appear as terminal-style messages.
  - **Tool calls** (file edits, bash commands) appear as collapsible cards showing the tool name and input.
  - **Tool results** show the outcome of each tool execution.
  - **Errors** are highlighted in red.
- **Session sidebar** (right) — Lists all sessions (active and completed) with status badges, timestamps, and session names.

### Tool Approval

When Claude wants to modify files or run commands, the session enters the `waiting_approval` state:

1. An **approval card** appears in the terminal output showing the tool name, input, and what Claude intends to do.
2. Click **Approve** (or press **Y**) to allow the action.
3. Click **Deny** (or press **N**) to reject it. Claude will be told the action was denied and may try an alternative approach.
4. Approvals **time out after 5 minutes** — if you don't respond, the action is auto-denied.

### Session History

All sessions are persisted with their full message history:

- Completed sessions remain in the sidebar for review.
- Click any past session to see its full transcript.
- Sessions are linked to the group and template they were launched from (if applicable).

### Session Management

- **Multiple sessions** can run simultaneously (each in its own tab).
- Use the **Abort** button to stop a running session. The CLI subprocess is terminated.
- Use the **Delete** button to remove a session from the sidebar and database.

### Connection Status

The **colored dot** in the sidebar header shows the WebSocket connection state:

- **Green** = Connected. Messages stream in real-time.
- **Yellow** = Reconnecting. The browser is attempting to re-establish the connection.
- **Red** = Disconnected. Check your network or restart the backend.

Sessions continue running on the server even if your browser disconnects temporarily. When you reconnect, the message history is synced automatically.

---

## 14. Multi-Machine Orchestration (Coming Soon)

> **Status:** Planned feature. Not yet implemented.

Multi-machine orchestration will let you manage Claude Code CLI sessions across multiple computers from one PromptFlow dashboard.

### Vision

Today, the orchestrator sidecar runs on the same machine as your Docker stack. The multi-machine extension lets you install lightweight **agents** on remote workstations (Mac, Windows, Linux) that connect back to the PromptFlow server. You can then dispatch sessions to any connected machine from the web UI.

### Agent Concept

- A lightweight background process installed on each workstation.
- The agent connects **outbound** to the PromptFlow server — no firewall or port-forwarding configuration needed on the workstation.
- Each agent manages local Claude Code CLI subprocesses and relays output back to the server.
- Agents report health metrics (CPU, memory, active session count) at regular intervals.

### Machine Registration

1. Install the agent on the target workstation.
2. Run the pairing command — the agent contacts the server and registers itself.
3. The machine appears on the **Machines** dashboard in the web UI.
4. Approve the machine from the dashboard to allow it to receive sessions.

### Machine Dashboard

The Machines page will show:

- All connected machines with their hostname, OS, and status (online/offline).
- Health metrics: CPU usage, memory usage, number of active sessions.
- Last heartbeat timestamp.
- Quick actions: pause (stop accepting new sessions), remove, view sessions.

### Session Dispatch

When creating a new session, you will be able to:

- **Choose a specific machine** from a dropdown.
- **Auto-select** the least-loaded machine (based on active session count and resource usage).
- Sessions are routed to the selected machine's agent, which spawns the Claude Code CLI subprocess locally.

### Cross-Platform Support

The agent will work on:

- **macOS** — Native support for Apple Silicon and Intel.
- **Windows** — Runs as a background service or tray application.
- **Linux** — Runs as a systemd service or standalone process.

### Security

- **API key authentication** — Each agent authenticates with a unique API key issued during pairing.
- **Workspace restrictions** — Per-machine configuration limits which directories Claude Code can access.
- **TLS** — Agent-to-server communication is encrypted.
- **Revocation** — Remove a machine from the dashboard to immediately revoke its access.
