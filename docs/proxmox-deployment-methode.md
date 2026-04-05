# Proxmox Deployment-Methode — PromptFlow

Dieses Dokument beschreibt die vollstaendige Deployment-Methode fuer PromptFlow auf dem Proxmox-Server. Die Methode ist identisch zur CPGrid Bot Deployment-Methode und laesst sich 1:1 auf weitere Applikationen uebertragen.

---

## Inhaltsverzeichnis

1. [Architektur-Ueberblick](#1-architektur-ueberblick)
2. [Voraussetzungen](#2-voraussetzungen)
3. [Phase 1: VM-Provisionierung (Proxmox Host)](#3-phase-1-vm-provisionierung)
4. [Phase 2: Ersteinrichtung auf der VM](#4-phase-2-ersteinrichtung-auf-der-vm)
5. [Phase 3: App-Deployment via Docker Compose](#5-phase-3-app-deployment-via-docker-compose)
6. [Phase 4: Laufende Updates](#6-phase-4-laufende-updates)
7. [Infrastruktur-Komponenten im Detail](#7-infrastruktur-komponenten-im-detail)
8. [Netzwerk und Zugriff](#8-netzwerk-und-zugriff)
9. [Mehrere Projekte auf einer VM](#9-mehrere-projekte-auf-einer-vm)
10. [Checkliste: Deployment durchfuehren](#10-checkliste-deployment-durchfuehren)

---

## 1. Architektur-Ueberblick

```
Windows Entwicklungs-PC                    Proxmox Host (192.168.1.99)
(Docker Desktop, Git, Code)                (Proxmox VE)
        |                                         |
        |  ssh root@proxmox 'bash -s'             |
        |  < create-vm.sh                         |
        |─────────────────────────────────────────>|
        |                                         |
        |                              ┌──────────┴──────────┐
        |                              │  VM 111 (cpgrid)    │
        |                              │  192.168.1.79       │
        |                              │  CPGrid Bot         │
        |                              ├─────────────────────┤
        |                              │  VM 200 (promptflow)│
        |                              │  192.168.1.78       │
        |                              │  Ubuntu 24.04 LTS   │
        |                              │                     │
        |                              │  Docker Engine      │
        |                              │  Docker Compose     │
        |                              │  Portainer CE       │
        |                              │                     │
        |                              │  ┌───────────────┐  │
        |  git push origin develop     │  │ PromptFlow    │  │
        |──────> GitHub ──────────────>│  │ (3 Container) │  │
        |                              │  │ db/backend/fe │  │
        |                              │  └───────────────┘  │
        |                              │                     │
        |                              │  (weitere Projekte  │
        |                              │   moeglich)         │
        |                              └─────────────────────┘
```

### Prinzip

1. **Proxmox Host** stellt VMs bereit (via `qm`-Befehle + cloud-init)
2. Die **VM** bekommt Ubuntu 24.04, Docker Engine, Docker Compose und Portainer automatisch installiert
3. Die **App** wird als Git-Repo auf die VM geklont
4. **Docker Compose** orchestriert alle Services (Backend, Frontend, DB)
5. **Updates** erfolgen per `git pull` + `docker compose up -d --build`
6. Die VM ist **multi-purpose** — weitere Projekte koennen parallel deployed werden

---

## 2. Voraussetzungen

### Proxmox Host

| Komponente | Details |
|---|---|
| Proxmox VE | Version 7.x oder 8.x |
| Storage | `local-lvm` (thin-provisioned) fuer VM-Disks |
| Snippets-Storage | `local` mit aktiviertem Content-Type `snippets` |
| Netzwerk-Bridge | `vmbr0` (Standard-Bridge mit Zugang zum LAN) |
| SSH-Zugang | `root@192.168.1.99` |

### Entwicklungs-PC

| Komponente | Details |
|---|---|
| SSH-Client | Fuer Zugriff auf Proxmox Host und VMs |
| Git | Zum Pushen von Code auf GitHub |
| Python + paramiko | Fuer automatisierte SSH-Updates via Claude Code Skill |

---

## 3. Phase 1: VM-Provisionierung

Die VM wird vollautomatisch mit dem Skript `deploy/proxmox/create-vm.sh` erstellt.

### Konfigurierbare Parameter

| Variable | Wert (PromptFlow) | Beschreibung |
|---|---|---|
| `VMID` | `200` | Proxmox VM-ID |
| `VM_NAME` | `promptflow` | Anzeigename in Proxmox |
| `CORES` | `4` | CPU-Kerne |
| `MEMORY` | `8192` | RAM in MB (8 GB) |
| `DISK_SIZE` | `100G` | Festplattengroesse |
| `STORAGE` | `local-lvm` | Proxmox Storage-Pool |
| `BRIDGE` | `vmbr0` | Netzwerk-Bridge |
| `VM_IP` | `192.168.1.78/24` | Statische IP + Subnetz |
| `VM_GW` | `192.168.1.1` | Gateway |
| `VM_DNS` | `192.168.1.1 8.8.8.8` | DNS-Server |
| `CI_USER` | `deploy` | SSH-Benutzername |
| `CI_PASSWORD` | `Martina66` | SSH-Passwort |

### Was cloud-init beim ersten Boot installiert

1. **QEMU Guest Agent** — Proxmox-Integration (Shutdown, IP-Anzeige, Snapshots)
2. **SSH mit Passwort-Auth** — Remote-Zugriff sofort moeglich
3. **Git** — Zum Klonen von Repos
4. **Docker Engine** — Offizielle Docker-Repo (docker-ce, containerd, buildx, compose-plugin)
5. **Docker Compose** — Als Docker-Plugin (`docker compose`)
6. **Portainer CE** — Web-UI fuer Docker-Management (Port 9443 HTTPS)

### Ausfuehrung

```bash
# VM erstellen
ssh root@192.168.1.99 'bash -s' < deploy/proxmox/create-vm.sh

# Cloud-init Status pruefen (nach 2-5 Minuten)
ssh deploy@192.168.1.78 'cloud-init status --wait'

# Docker pruefen
ssh deploy@192.168.1.78 'docker --version && docker compose version'
```

---

## 4. Phase 2: Ersteinrichtung auf der VM

### Schritt 1: SSH-Verbindung

```bash
ssh deploy@192.168.1.78
```

### Schritt 2: Repo klonen

```bash
git clone https://github.com/DMPlisken/PromptManager.git ~/PromptFlow
cd ~/PromptFlow
```

### Schritt 3: Umgebungsvariablen konfigurieren

```bash
cp .env.production .env
nano .env   # Passwort aendern falls gewuenscht
```

Die `.env.production` enthaelt bereits produktions-taugliche Werte mit Standard-Ports:

| Variable | Wert | Beschreibung |
|---|---|---|
| `POSTGRES_USER` | `promptmgr` | Datenbank-Benutzer |
| `POSTGRES_PASSWORD` | `PromptFlow2025!Prod` | Datenbank-Passwort |
| `POSTGRES_DB` | `promptmanager` | Datenbank-Name |
| `DB_PORT` | `5432` | PostgreSQL Port |
| `BACKEND_PORT` | `8000` | FastAPI Backend Port |
| `FRONTEND_PORT` | `3000` | React Frontend Port |

### Schritt 4: Services starten

```bash
docker compose up -d --build
```

### Schritt 5: Verifizieren

```bash
docker compose ps                    # Alle Container laufen?
docker compose logs -f --tail=50     # Fehler in den Logs?
curl http://localhost:8000/api/health # Backend OK?
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000  # Frontend OK?
```

### Schritt 6: Portainer einrichten (einmalig)

1. Oeffne `https://192.168.1.78:9443` im Browser
2. Admin-Account erstellen (innerhalb von 5 Minuten nach Deployment!)
3. Portainer zeigt alle laufenden Container, Volumes, Netzwerke

---

## 5. Phase 3: App-Deployment via Docker Compose

### PromptFlow Service-Architektur

```
PromptFlow/
├── docker-compose.yml          # 3 Services: db, backend, frontend
├── .env.production             # Produktions-Konfiguration
├── .env                        # Aktive Konfiguration (nicht im Git)
└── services/
    ├── backend/
    │   ├── Dockerfile          # Python 3.12 + FastAPI + Alembic
    │   ├── requirements.txt
    │   ├── alembic.ini
    │   ├── alembic/            # DB-Migrationen
    │   └── app/                # FastAPI Application
    └── frontend/
        ├── Dockerfile          # Multi-stage: Node 20 Build + Nginx
        ├── nginx.conf          # SPA-Routing + API-Proxy
        ├── package.json
        └── src/                # React + TypeScript
```

### Services

| Service | Image/Build | Port | Beschreibung |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | PostgreSQL Datenbank |
| `backend` | Build `./services/backend` | 8000 | FastAPI REST-API |
| `frontend` | Build `./services/frontend` | 3000 | React SPA via Nginx |

### Volumes

| Volume | Beschreibung |
|---|---|
| `pgdata` | Persistente PostgreSQL-Daten |
| `image_uploads` | Hochgeladene Bilder |

### Healthchecks

```bash
# Backend API
curl http://192.168.1.78:8000/api/health

# Frontend
curl -s -o /dev/null -w "%{http_code}" http://192.168.1.78:3000

# PostgreSQL (innerhalb der VM)
docker compose exec db pg_isready -U promptmgr
```

---

## 6. Phase 4: Laufende Updates

### Manuelles Update (SSH)

```bash
ssh deploy@192.168.1.78
cd ~/PromptFlow
git pull origin develop
docker compose up -d --build
docker compose ps
```

### Automatisiertes Update (Claude Code Skill)

Nutze den Skill `/promptflow-update-proxmox` in Claude Code. Der Skill:

1. Verbindet sich per SSH (Python `paramiko`) zur VM
2. Fuehrt `git fetch + pull` auf `develop` aus
3. Baut Container neu mit `docker compose up -d --build`
4. Prueft Container-Status
5. Fuehrt Health-Checks auf Frontend (3000) und Backend (8000) durch
6. Gibt eine Zusammenfassung aus

**Ablauf:**

```
┌──────────────────────────────────────────────────┐
│  1. SSH-Verbindung zur VM (paramiko, Passwort)   │
│                                                    │
│  2. git fetch origin && git checkout develop      │
│     && git pull origin develop                    │
│                                                    │
│  3. docker compose up -d --build                  │
│     (Timeout: 600s, da Build dauert)              │
│                                                    │
│  4. Container-Status pruefen (docker compose ps)  │
│                                                    │
│  5. Health-Checks auf Endpunkte                   │
│     → Frontend: curl http://localhost:3000        │
│     → API: curl http://localhost:8000/api/health  │
│                                                    │
│  6. Zusammenfassung ausgeben                      │
└──────────────────────────────────────────────────┘
```

**Wichtig**: Docker-Befehle auf der VM benoetigen `sudo`:
```bash
echo Martina66 | sudo -S docker compose up -d --build
```

---

## 7. Infrastruktur-Komponenten im Detail

### PostgreSQL

- **Image**: `postgres:16-alpine`
- **Persistenz**: Docker Volume `pgdata`
- **Migrationen**: Alembic, laeuft automatisch beim Backend-Container-Start
- **Health Check**: `pg_isready` alle 5 Sekunden

### Portainer CE

- **Zugriff**: `https://192.168.1.78:9443`
- **Funktion**: Web-UI fuer Docker-Management (Container, Volumes, Logs, Shell)
- **Installation**: Automatisch via cloud-init
- **Ersteinrichtung**: Admin-Account innerhalb von 5 Minuten erstellen!

---

## 8. Netzwerk und Zugriff

### IP-Schema

| VM | IP | App |
|---|---|---|
| cpgrid-bot (VM 111) | 192.168.1.79 | CPGrid Bot |
| promptflow (VM 200) | 192.168.1.78 | PromptFlow (+ weitere) |
| Proxmox Host | 192.168.1.99 | Proxmox VE Web-UI |

### Port-Zugriff auf VM 200

| Port | Dienst | URL |
|---|---|---|
| 22 | SSH | `ssh deploy@192.168.1.78` |
| 3000 | PromptFlow Frontend | `http://192.168.1.78:3000` |
| 8000 | PromptFlow Backend API | `http://192.168.1.78:8000` |
| 9443 | Portainer (HTTPS) | `https://192.168.1.78:9443` |
| 5432 | PostgreSQL | Nur intern |

---

## 9. Mehrere Projekte auf einer VM

Diese VM ist als Multi-Purpose Docker Host konzipiert. Um ein weiteres Projekt hinzuzufuegen:

### Port-Konflikte vermeiden

Jedes Projekt muss eigene Host-Ports verwenden. Beispiel:

| Projekt | Frontend | Backend | DB |
|---|---|---|---|
| PromptFlow | 3000 | 8000 | 5432 |
| Projekt B | 3001 | 8001 | 5433 |
| Projekt C | 3002 | 8002 | 5434 |

### Neues Projekt deployen

```bash
ssh deploy@192.168.1.78
git clone https://github.com/<org>/<repo>.git ~/<ProjektName>
cd ~/<ProjektName>
cp .env.example .env
# Ports in .env anpassen, damit keine Konflikte entstehen!
nano .env
docker compose up -d --build
```

### Claude Code Skill fuer neues Projekt

Erstelle `.claude/commands/<projekt>-update-proxmox.md` mit:
- Connection Details (gleiche VM, gleicher User)
- Projekt-spezifisches Verzeichnis auf der VM
- Passende Health-Check Ports

---

## 10. Checkliste: Deployment durchfuehren

### VM erstellen

- [ ] Freie VM-ID pruefen (Proxmox UI: Datacenter)
- [ ] `create-vm.sh` ausfuehren: `ssh root@192.168.1.99 'bash -s' < deploy/proxmox/create-vm.sh`
- [ ] 2-5 Minuten warten, cloud-init pruefen: `ssh deploy@192.168.1.78 'cloud-init status --wait'`
- [ ] Docker pruefen: `ssh deploy@192.168.1.78 'docker --version && docker compose version'`

### PromptFlow deployen

- [ ] SSH auf VM: `ssh deploy@192.168.1.78`
- [ ] Repo klonen: `git clone https://github.com/DMPlisken/PromptManager.git ~/PromptFlow`
- [ ] `.env.production` → `.env` kopieren: `cd ~/PromptFlow && cp .env.production .env`
- [ ] Services starten: `docker compose up -d --build`
- [ ] Container-Status: `docker compose ps` — alle 3 Container gesund?
- [ ] Backend Health: `curl http://localhost:8000/api/health`
- [ ] Frontend: `http://192.168.1.78:3000` im Browser oeffnen
- [ ] Portainer: `https://192.168.1.78:9443` — Admin erstellen

### Nach dem Deployment

- [ ] Postgres-Passwort in `.env` aendern (falls gewuenscht)
- [ ] Claude Code Skill testen: `/promptflow-update-proxmox`

---

## Referenz: Aktuelle PromptFlow VM

| Parameter | Wert |
|---|---|
| Proxmox Host | 192.168.1.99 |
| VM-ID | 200 |
| VM-Name | promptflow |
| IP | 192.168.1.78 |
| User | deploy |
| OS | Ubuntu 24.04 LTS |
| CPU | 4 Kerne |
| RAM | 8 GB |
| Disk | 100 GB (thin) |
| Docker | Latest + Compose |
| Portainer | `https://192.168.1.78:9443` |
| Frontend | `http://192.168.1.78:3000` |
| Backend API | `http://192.168.1.78:8000` |
| Repo auf VM | `~/PromptFlow` |
| Branch | `develop` |
