# PromptFlow — User Manual

**Version:** 2.0
**Last updated:** 2026-04-09

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

### Workflow 3: Duplicating a Task

1. On the Tasks overview page, find the task you want to copy.
2. Click the **"Copy"** button on the task card.
3. A new task is created with the suffix "(copy)" containing:
   - The same templates (in the same order, with use counts reset to 0)
   - The same variable values
   - The same tags
   - The same image attachments
4. Execution history is **not** copied — the duplicate starts fresh.

### Workflow 4: Re-using a Past Prompt

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
