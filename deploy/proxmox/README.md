# PromptFlow — Proxmox VM Deployment

## VM Specifications

| Parameter | Value |
|---|---|
| Proxmox Host | 192.168.1.99 |
| VM-ID | 200 |
| VM-Name | promptflow |
| IP | 192.168.1.78 |
| User | deploy |
| Password | Martina66 |
| OS | Ubuntu 24.04 LTS |
| CPU | 4 cores |
| RAM | 8 GB |
| Disk | 100 GB (thin-provisioned) |

## Software (installed via cloud-init)

- Docker Engine + Docker Compose (plugin)
- Portainer CE (HTTPS on port 9443)
- QEMU Guest Agent
- Git

## Access

| Service | URL / Command |
|---|---|
| SSH | `ssh deploy@192.168.1.78` |
| Portainer | `https://192.168.1.78:9443` |
| Frontend | `http://192.168.1.78:3000` |
| Backend API | `http://192.168.1.78:8000` |
| Health Check | `http://192.168.1.78:8000/api/health` |

## Usage

### 1. Create the VM

```bash
ssh root@192.168.1.99 'bash -s' < deploy/proxmox/create-vm.sh
```

Wait 2-5 minutes for cloud-init, then verify:

```bash
ssh deploy@192.168.1.78 'cloud-init status --wait'
ssh deploy@192.168.1.78 'docker --version && docker compose version'
```

### 2. Deploy PromptFlow

```bash
ssh deploy@192.168.1.78

# Clone the repo
git clone https://github.com/DMPlisken/PromptManager.git ~/PromptFlow
cd ~/PromptFlow

# Configure environment
cp .env.production .env
# Edit .env if needed: nano .env

# Start all services
docker compose up -d --build

# Verify
docker compose ps
curl http://localhost:8000/api/health
```

### 3. Set up Portainer (one-time)

Open `https://192.168.1.78:9443` in browser within 5 minutes and create admin account.

### 4. Update deployment

Via Claude Code skill:
```
/promptflow-update-proxmox
```

Or manually:
```bash
ssh deploy@192.168.1.78
cd ~/PromptFlow
git pull origin develop
docker compose up -d --build
docker compose ps
```

## Deploying additional projects

This VM is multi-purpose. To add another project:

```bash
ssh deploy@192.168.1.78
git clone https://github.com/<org>/<repo>.git ~/<ProjectName>
cd ~/<ProjectName>
cp .env.example .env   # configure
docker compose up -d --build
```

Ensure port mappings don't conflict between projects (use different host ports in each project's .env).
