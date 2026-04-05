# PromptFlow — Update Proxmox Deployment

Deploy the latest version of PromptFlow from `origin/develop` to the Proxmox VM.

## Connection Details

- **VM**: deploy@192.168.1.78
- **Password**: Martina66
- **Project dir on VM**: ~/PromptFlow
- **SSH method**: Use Python `paramiko` (password auth, `look_for_keys=False, allow_agent=False`)

## Steps — Execute ALL in order

### Step 1: Fetch latest from origin/develop

SSH into the VM and run:
```
cd ~/PromptFlow && git fetch origin && git checkout develop && git pull origin develop
```

If the repo doesn't exist yet, clone it first:
```
git clone https://github.com/DMPlisken/PromptManager.git ~/PromptFlow
cd ~/PromptFlow && git checkout develop
cp .env.production .env
```

Report the latest commit hash and message.

### Step 2: Build and deploy containers

```
cd ~/PromptFlow && sudo docker compose up -d --build
```

This may take several minutes. Use a long timeout (600s). Report which containers were recreated.

### Step 3: Run database migrations (if needed)

Alembic migrations run automatically on container startup via the backend entrypoint. Verify by checking logs:

```
sudo docker compose logs --tail=30 backend 2>&1 | grep -i -E "(alembic|migration|upgrade|revision)"
```

Report any migration activity found, or "No pending migrations" if none.

### Step 4: Verify all containers are running

```
sudo docker compose ps
```

Check that all services (db, backend, frontend) show as "running" or "healthy". Report any that are not.

### Step 5: Check service availability

```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 10
```

Also check the backend health endpoint:
```
curl -s http://localhost:8000/api/health --max-time 10
```

Report HTTP status codes. 200 = success.

## Output Format

After all steps complete, output a summary:

```
## Proxmox Deployment Update — PromptFlow

- **Commit**: <hash> — <message>
- **Branch**: develop
- **Containers rebuilt**: <list>
- **Migrations**: <found / none>
- **Services**: <count> running, <count> failed
- **Frontend (3000)**: <status code>
- **Backend (8000)**: <status code>
```

If any step fails, report the error and continue with remaining steps. Do NOT stop on failure.

## Important Notes

- All `docker` and `docker compose` commands need `sudo` (prefix with `echo Martina66 | sudo -S`)
- Filter out `[sudo]` password prompt lines from output
- Use paramiko for SSH — `sshpass` is not available on this workstation
- If the VM is unreachable, report the error and stop
