# PromptManager — Agent Instructions

## Required Reading Before Any Work

Before starting any development task, **always read these files first**:

1. **`docs/ROADMAP_PROGRESS.md`** — What has been completed and what remains.
2. **`docs/BUG_REGISTRY.md`** — Known bug patterns and fixes.

## Required Updates After Any Work

After completing any development task:

1. **Update `docs/ROADMAP_PROGRESS.md`** — Mark completed items as DONE with commit hash/PR number.
2. **Update `docs/BUG_REGISTRY.md`** — If you found and fixed a bug, document the root cause pattern, symptom, fix, and affected files.

## Prompt Log (MANDATORY — Every Prompt)

**After every user prompt**, append a new entry to **`docs/PROMPT_LOG.md`**. This is a persistent audit trail of all user requests.

**Format** — each entry is a section with metadata line + full prompt text:

```markdown
### YYYY-MM-DD HH:MM — <very short task description> (`<branch-name>`)

> <exact original prompt text, verbatim>
```

- **Date/time**: Use the current date and time (24h format).
- **Description**: Maximum ~10 words — just enough to identify the request at a glance.
- **Branch**: The current git branch at the time of the prompt.
- **Prompt body**: The user's exact wording in a blockquote. Copy verbatim — do not paraphrase, shorten, or translate.
- Log **every** user prompt, including follow-ups, clarifications, and "do housekeeping".
- Do NOT skip this step. Do NOT batch entries. Log immediately after receiving each prompt.

## Bug/Feature Intake — Prefilled Form + Questions (Mandatory)

Whenever the user mentions a **problem/bug** or proposes a **new feature/change request** (even informally), you MUST do the following **before** implementation:

1) Create a **prefilled intake form** (Bug Report or Feature Request) using all information already provided.
2) Identify missing fields and ask **targeted questions** to fill the gaps.
3) Only after the user answered (or explicitly skipped), create the **GitHub Issue** with the finalized content.

### Step 1 — Output a Prefilled Intake Form

You MUST output the form in markdown under the heading:

- `### Draft: Bug Report` OR `### Draft: Feature Request`

Use this exact structure:

#### Bug Report Form
- **Title:** {prefilled or placeholder}
- **Context:** {what the user was trying to do}
- **Current behavior:** {what happens}
- **Expected behavior:** {what should happen}
- **Steps to reproduce:** {list or "Unknown yet"}
- **Frequency / impact:** {e.g. always / sometimes; severity guess}
- **Logs / screenshots:** {links/snippets or "Not provided"}
- **Environment:** {branch/commit, OS, docker stack, service, module if relevant}
- **Acceptance criteria:**
  - {bullet list; prefilled if possible}

#### Feature Request Form
- **Title:** {prefilled or placeholder}
- **Problem / motivation:** {why needed}
- **Proposed solution:** {what to build/change}
- **Scope (in/out):**
  - In: {...}
  - Out: {...}
- **User stories / use cases:** {bullets or "Not provided"}
- **UX / UI notes (if relevant):** {...}
- **Technical notes (if relevant):** {...}
- **Acceptance criteria:**
  - {bullet list; prefilled if possible}

### Step 2 — Ask Questions to Fill the Gaps

After showing the draft form, you MUST ask questions to fill missing info.

Rules for questions:
- Ask only what is necessary; keep it short and structured.
- Ask **at most 7 questions per turn**.
- Prefer **multiple choice** when possible.
- If a field is unknown, explicitly ask for it OR ask whether to proceed with "Not provided/Unknown".

Use the heading:
- `### Questions to finalize the issue`

### Step 3 — Create the GitHub Issue (After Clarification)

Once enough info is available (or user says "create it anyway"), you MUST create the GitHub issue.

**Classification**
- **Bug report** -> label `bug`
- **Feature request** -> label `enhancement`

**Preferred method: GitHub CLI**
- Bug:
  `gh issue create --repo DMPlisken/PromptManager --title "{TITLE}" --body "{BODY}" --label "bug"`
- Feature:
  `gh issue create --repo DMPlisken/PromptManager --title "{TITLE}" --body "{BODY}" --label "enhancement"`

**After creating the issue**
- Paste the created Issue URL/number into the chat output for traceability.
- Reference the issue number in:
  - branch name (e.g., `fix/123-symbol-mapping`)
  - PR title (e.g., `[#123] Fix symbol mapping`)
- Only then proceed with implementation work.

### Exception

Only skip this flow if the user explicitly says:
- "Do not create an issue for this." OR "No questions, just implement."

In that case: create the issue with best-effort assumptions and mark unknown fields as "Not provided".

## Project Context

- **Architecture**: Three Docker containers — Frontend, Backend, Database
- **Backend stack**: Python 3.12+, FastAPI, SQLAlchemy 2.0 (async), Alembic
- **Frontend**: React 18 + TypeScript with Vite
- **Database**: PostgreSQL 16
- **Orchestration**: Docker Compose

### Service Layout

| Service | Directory | Port | Purpose |
|---------|-----------|------|---------|
| Backend | `services/backend/` | 8000 | FastAPI REST API |
| Frontend | `services/frontend/` | 3000 | React SPA (Vite dev server) |
| Database | (Docker image) | 5432 | PostgreSQL 16 |

### Data Model

- **PromptGroup** — A collection of related prompts sharing variables (e.g., "Design", "Develop", "Audit")
- **Variable** — A placeholder definition scoped to a group (`{{NAME}}` syntax)
- **PromptTemplate** — A template with `{{PLACEHOLDER}}` tokens
- **TaskExecution** — A historical record of a rendered prompt with variable values

### Key Directories

- `services/backend/app/models/` — SQLAlchemy models
- `services/backend/app/routers/` — FastAPI route handlers
- `services/backend/app/schemas/` — Pydantic request/response schemas
- `services/backend/app/services/` — Business logic (renderer)
- `services/backend/alembic/` — Database migrations
- `services/frontend/src/api/` — API client
- `services/frontend/src/components/` — Reusable UI components
- `services/frontend/src/pages/` — Page-level components

## Git Branching Policy

- **`develop`** is the integration branch. All feature/fix work targets `develop`.
- **`main`** is the release branch. Only stable releases from `develop` are merged into `main`. NEVER commit directly to `main`.
- **NEVER commit directly to `develop`** either. Always create a feature/topic branch first.
- Branch naming convention: `<type>/<issue-number>-<short-description>` where type is `feat`, `fix`, `refactor`, `test`, `docs`, or `chore`.
- Create the branch from `develop`: `git checkout develop && git checkout -b <branch-name>`.
- After work is complete and verified, create a PR to merge into `develop`.
- **Release flow**: When `develop` is stable -> merge into `main` -> tag with version.

## Critical Rules

- **One service per container**: Backend, Frontend, and Database each have their own container and lifecycle.
- **Environment variables**: All secrets and config via `.env` files. Never hardcode credentials.
- **API-first**: Frontend communicates with Backend exclusively through REST API (`/api/*`).
- **Placeholder syntax**: Always use `{{VARIABLE_NAME}}` (double curly braces) for template placeholders.

## Model Usage Strategy

### Default Model
Use **Opus 4.6** (`opus`) as the default model for the lead agent and for complex reasoning, architecture decisions, debugging, and agentic workflows.

### Hybrid Model Strategy (`opusplan`)
Use the `opusplan` alias for cost-efficient sessions:
- **Plan mode** -> Opus for complex reasoning and architecture decisions
- **Execution mode** -> Automatically switches to Sonnet 4.6 for code generation and implementation

### Context Management
- Monitor context usage with `/context` — when approaching **~70%**, either compact or generate a continuation prompt before resetting.

## Housekeeping Workflow — "do housekeeping"

When the user says **"do housekeeping"**, execute ALL of the following steps in order. Do NOT ask questions — just run through the full checklist. Report a summary at the end.

### Prerequisites (auto-detect)

- **Branch name**: current git branch (must NOT be `develop` or `main`)
- **Issue number**: extract from branch name (e.g., `feat/14-add-history` → `#14`)
- **Changed services**: which `services/*/` directories were modified

If currently on `develop` or `main`, STOP and tell the user: "Housekeeping must be run from a feature/fix branch."

### Step 1 — Commit
1. Run `git status` and `git diff --stat`.
2. Stage and commit with descriptive message + `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.

### Step 2 — Push
Push the current branch to origin.

### Step 3 — Create PR (if none exists)
Create PR targeting `develop` with summary of all commits.

### Step 4 — Health check
1. **Docker health**: `docker compose ps`
2. **API smoke test**: `curl -s http://localhost:8000/api/health`

### Step 5 — Merge the PR
`gh pr merge <pr-number> --repo DMPlisken/PromptManager --merge --delete-branch`

### Step 6 — Close the GitHub issue
Close and comment on the issue.

### Step 7 — Update documentation
Update `docs/ROADMAP_PROGRESS.md` and `docs/BUG_REGISTRY.md`.

### Step 8 — Switch to develop and pull
`git checkout develop && git pull origin develop`

### Step 9 — Rebuild Docker
`docker compose up -d --build <changed-services>`

### Step 10 — Summary report
Output a summary with branch, PR, issue, docs updated, and health status.
