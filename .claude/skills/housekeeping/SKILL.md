---
name: housekeeping
description: Commit, push, create PR, merge, close issue, update docs, rebuild Docker
user_invocable: true
---

Execute the full housekeeping workflow as defined in CLAUDE.md. Run ALL steps in order without asking questions.

## Prerequisites (auto-detect)
- **Branch name**: current git branch (must NOT be `develop` or `main`)
- **Issue number**: extract from branch name (e.g., `feat/14-add-history` → `#14`)
- **Changed services**: which `services/*/` directories were modified

If currently on `develop` or `main`, STOP and tell the user: "Housekeeping must be run from a feature/fix branch."

## Steps

### 1. Commit
- Run `git status` and `git diff --stat`
- Stage and commit with descriptive message + `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

### 2. Push
- Push the current branch to origin

### 3. Create PR (if none exists)
- Create PR targeting `develop` with summary of all commits
- Use: `gh pr create --repo DMPlisken/PromptManager --title "[#issue] title" --body "summary" --base develop`

### 4. Health check
- `docker compose ps`
- Test API: `curl -s http://localhost:8010/api/health`

### 5. Merge the PR
- `gh pr merge <pr-number> --repo DMPlisken/PromptManager --merge --delete-branch`

### 6. Close the GitHub issue
- `gh issue close <issue-number> --repo DMPlisken/PromptManager`

### 7. Update documentation
- Update `docs/ROADMAP_PROGRESS.md`
- Update `docs/BUG_REGISTRY.md` (if bug fix)
- Commit docs on `develop`

### 8. Switch to develop and pull
- `git checkout develop && git pull origin develop`

### 9. Rebuild Docker
- `docker compose up -d --build` (changed services)

### 10. Summary
Output a summary with branch, PR, issue, docs, Docker status.
