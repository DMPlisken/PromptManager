"""REST endpoints for machine management and pairing."""

import hashlib
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.machine import Machine
from app.schemas.machine import (
    MachineCreate,
    MachineHealthResponse,
    MachineResponse,
    MachineUpdate,
    PairingCodeResponse,
    PairingRequest,
    PairingResponse,
)
from app.services.agent_manager import agent_manager

logger = structlog.get_logger()
router = APIRouter()

# ---------------------------------------------------------------------------
# Pairing helpers
# ---------------------------------------------------------------------------

_PAIRING_CODE_LENGTH = 6
_PAIRING_CODE_TTL_MINUTES = 15


def _generate_pairing_code() -> str:
    """Generate a 6-character alphanumeric pairing code (uppercase)."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(_PAIRING_CODE_LENGTH))


def _generate_api_key() -> str:
    """Generate a secure API key for machine authentication."""
    return f"pm_{secrets.token_urlsafe(32)}"


def _hash_api_key(api_key: str) -> str:
    """SHA-256 hash of API key for storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[MachineResponse])
async def list_machines(
    status: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Machine).order_by(desc(Machine.registered_at))
    if status:
        query = query.where(Machine.status == status)
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    machines = result.scalars().all()

    # Enrich with live online status from agent_manager
    for machine in machines:
        if agent_manager.is_online(machine.machine_uuid):
            machine.status = "online"

    return machines


@router.get("/{machine_id}", response_model=MachineResponse)
async def get_machine(machine_id: int, db: AsyncSession = Depends(get_db)):
    machine = await db.get(Machine, machine_id)
    if not machine:
        raise HTTPException(404, "Machine not found")

    # Enrich with live online status
    if agent_manager.is_online(machine.machine_uuid):
        machine.status = "online"

    return machine


@router.post("", response_model=MachineResponse, status_code=201)
async def create_machine(data: MachineCreate, db: AsyncSession = Depends(get_db)):
    """Manually register a machine (admin)."""
    machine = Machine(
        machine_uuid=str(uuid.uuid4()),
        name=data.name,
        hostname=data.hostname,
        platform=data.platform,
        workspace_root=data.workspace_root,
        max_concurrent_sessions=data.max_concurrent_sessions,
        color=data.color,
        status="offline",
    )
    db.add(machine)
    await db.commit()
    await db.refresh(machine)
    return machine


@router.put("/{machine_id}", response_model=MachineResponse)
async def update_machine(
    machine_id: int,
    data: MachineUpdate,
    db: AsyncSession = Depends(get_db),
):
    machine = await db.get(Machine, machine_id)
    if not machine:
        raise HTTPException(404, "Machine not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(machine, key, val)
    await db.commit()
    await db.refresh(machine)
    return machine


@router.delete("/{machine_id}", status_code=204)
async def delete_machine(machine_id: int, db: AsyncSession = Depends(get_db)):
    machine = await db.get(Machine, machine_id)
    if not machine:
        raise HTTPException(404, "Machine not found")
    await db.delete(machine)
    await db.commit()


# ---------------------------------------------------------------------------
# Pairing flow
# ---------------------------------------------------------------------------


@router.post("/pairing-code", response_model=PairingCodeResponse)
async def generate_pairing_code(db: AsyncSession = Depends(get_db)):
    """Generate a 6-char pairing code and temp API key.

    Step 1 of pairing: user clicks 'Add Machine' in the UI.
    Returns the code (to display) and the API key (to include in install command).
    """
    code = _generate_pairing_code()
    api_key = _generate_api_key()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=_PAIRING_CODE_TTL_MINUTES
    )

    # Create a placeholder machine record in "pairing" status
    machine = Machine(
        machine_uuid=str(uuid.uuid4()),
        name=f"Pending ({code})",
        status="pairing",
        pairing_code=code,
        pairing_expires_at=expires_at,
        api_key_hash=_hash_api_key(api_key),
        api_key_prefix=api_key[:8],
    )
    db.add(machine)
    await db.commit()

    logger.info("pairing_code_generated", code=code, expires_at=expires_at.isoformat())

    return PairingCodeResponse(code=code, api_key=api_key, expires_at=expires_at)


@router.post("/pair", response_model=PairingResponse)
async def pair_machine(
    data: PairingRequest,
    db: AsyncSession = Depends(get_db),
):
    """Complete machine pairing.

    Step 2 of pairing: the agent on the remote machine calls this endpoint
    with the pairing code and its machine info.
    """
    # Look up the pairing code
    result = await db.execute(
        select(Machine).where(
            Machine.pairing_code == data.pairing_code,
            Machine.status == "pairing",
        )
    )
    machine = result.scalar_one_or_none()

    if machine is None:
        raise HTTPException(404, "Invalid or expired pairing code")

    # Check expiration
    if (
        machine.pairing_expires_at
        and machine.pairing_expires_at < datetime.now(timezone.utc)
    ):
        # Clean up expired record
        await db.delete(machine)
        await db.commit()
        raise HTTPException(410, "Pairing code has expired")

    # Generate a permanent API key for the agent
    api_key = _generate_api_key()

    # Update machine with agent info
    machine.machine_uuid = data.machine_uuid
    machine.name = data.machine_name
    machine.platform = data.platform
    machine.hostname = data.hostname
    machine.platform_version = data.platform_version
    machine.agent_version = data.agent_version
    machine.claude_cli_version = data.claude_cli_version
    machine.claude_cli_available = data.claude_cli_available
    machine.workspace_root = data.workspace_root
    machine.status = "offline"
    machine.pairing_code = None  # Clear the code
    machine.pairing_expires_at = None
    machine.api_key_hash = _hash_api_key(api_key)
    machine.api_key_prefix = api_key[:8]
    machine.registered_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(machine)

    logger.info(
        "machine_paired",
        machine_uuid=data.machine_uuid,
        machine_name=data.machine_name,
        platform=data.platform,
    )

    return PairingResponse(
        machine_uuid=machine.machine_uuid,
        machine_id=machine.id,
        api_key=api_key,
        server_url="",  # Will be set by the frontend based on current URL
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/{machine_id}/health", response_model=MachineHealthResponse)
async def get_machine_health(machine_id: int, db: AsyncSession = Depends(get_db)):
    machine = await db.get(Machine, machine_id)
    if not machine:
        raise HTTPException(404, "Machine not found")

    # Enrich with live data if agent is connected
    live_info = agent_manager.machine_info.get(machine.machine_uuid, {})
    if live_info.get("health"):
        machine.last_health = live_info["health"]

    return MachineHealthResponse(
        machine_uuid=machine.machine_uuid,
        status="online" if agent_manager.is_online(machine.machine_uuid) else machine.status,
        last_health=machine.last_health,
        last_seen_at=machine.last_seen_at,
    )


# ---------------------------------------------------------------------------
# Install scripts
# ---------------------------------------------------------------------------

_MAC_INSTALL_SCRIPT = """\
#!/bin/bash
# PromptFlow Agent Installer — macOS
# Usage: curl -fsSL <server>/api/machines/install-script/mac | bash
set -euo pipefail

echo "=========================================="
echo "  PromptFlow Agent Installer (macOS)"
echo "=========================================="
echo ""

# Check prerequisites
echo "[1/4] Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Install it with: brew install node"
    echo "Or download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
echo "  Node.js: v$NODE_VERSION"

if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed."
    exit 1
fi
echo "  npm: $(npm --version)"

# Check for Claude CLI
CLAUDE_AVAILABLE=false
if command -v claude &> /dev/null; then
    CLAUDE_AVAILABLE=true
    echo "  Claude CLI: $(claude --version 2>/dev/null || echo 'installed')"
else
    echo "  Claude CLI: not found (optional — install later with: npm install -g @anthropic-ai/claude-code)"
fi

echo ""

# Install the agent
echo "[2/4] Installing promptflow-agent..."
npm install -g promptflow-agent@latest 2>/dev/null || {
    echo "NOTE: promptflow-agent package not yet published."
    echo "For now, download the agent from the PromptFlow releases page."
}

echo ""

# Pairing
echo "[3/4] Pairing with server..."
echo ""
echo "To pair this machine with your PromptFlow server, run:"
echo ""
echo "  promptflow-agent pair <PAIRING_CODE> --server <SERVER_URL>"
echo ""
echo "Get the pairing code from the PromptFlow web UI:"
echo "  Machines > Add Machine > copy the 6-character code"
echo ""

echo "[4/4] Done!"
echo ""
echo "After pairing, start the agent with:"
echo "  promptflow-agent start"
echo ""
echo "Or run it as a background service:"
echo "  promptflow-agent service install"
echo "  promptflow-agent service start"
"""

_WINDOWS_INSTALL_SCRIPT = """\
# PromptFlow Agent Installer — Windows
# Usage: irm <server>/api/machines/install-script/windows | iex
# Or save and run: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  PromptFlow Agent Installer (Windows)"     -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow

$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    Write-Host "ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/"
    exit 1
}

$nodeVersion = node --version
Write-Host "  Node.js: $nodeVersion"

$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCheck) {
    Write-Host "ERROR: npm is not installed." -ForegroundColor Red
    exit 1
}
Write-Host "  npm: $(npm --version)"

# Check for Claude CLI
$claudeCheck = Get-Command claude -ErrorAction SilentlyContinue
if ($claudeCheck) {
    Write-Host "  Claude CLI: installed"
} else {
    Write-Host "  Claude CLI: not found (optional - install later with: npm install -g @anthropic-ai/claude-code)"
}

Write-Host ""

# Install the agent
Write-Host "[2/4] Installing promptflow-agent..." -ForegroundColor Yellow
try {
    npm install -g promptflow-agent@latest 2>$null
} catch {
    Write-Host "NOTE: promptflow-agent package not yet published." -ForegroundColor Yellow
    Write-Host "For now, download the agent from the PromptFlow releases page."
}

Write-Host ""

# Pairing
Write-Host "[3/4] Pairing with server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "To pair this machine with your PromptFlow server, run:" -ForegroundColor Green
Write-Host ""
Write-Host "  promptflow-agent pair <PAIRING_CODE> --server <SERVER_URL>" -ForegroundColor White
Write-Host ""
Write-Host "Get the pairing code from the PromptFlow web UI:"
Write-Host "  Machines > Add Machine > copy the 6-character code"
Write-Host ""

Write-Host "[4/4] Done!" -ForegroundColor Green
Write-Host ""
Write-Host "After pairing, start the agent with:"
Write-Host "  promptflow-agent start" -ForegroundColor White
Write-Host ""
Write-Host "Or install as a Windows Service:"
Write-Host "  promptflow-agent service install" -ForegroundColor White
Write-Host "  promptflow-agent service start" -ForegroundColor White
"""


@router.post("/{machine_id}/test")
async def test_machine(machine_id: int, db: AsyncSession = Depends(get_db)):
    """Run a quick test prompt on a paired machine.

    Dispatches a simple prompt to the machine's agent, waits for the response
    (up to 30 seconds), and returns the output.
    """
    import asyncio
    from app.services.session_manager import session_manager

    machine = await db.get(Machine, machine_id)
    if not machine:
        raise HTTPException(404, "Machine not found")

    if not agent_manager.is_online(machine.machine_uuid):
        raise HTTPException(503, "Machine is offline")

    test_prompt = 'Respond with exactly: "PromptFlow agent test successful! Machine is connected and Claude Code CLI is working." Do not add anything else.'

    try:
        # Create a test session
        session = await session_manager.create_session(
            db=db,
            prompt=test_prompt,
            working_directory=machine.workspace_root or "/tmp",
            model="haiku",
            machine_id=machine.id,
            name=f"Test: {machine.name}",
        )

        # Wait for completion (poll session status, max 30s)
        session_id = session.id
        for _ in range(60):
            await asyncio.sleep(0.5)
            await db.refresh(session)
            if session.status in (
                SessionStatus.COMPLETED.value,
                SessionStatus.FAILED.value,
                SessionStatus.TERMINATED.value,
            ):
                break

        # Collect output messages
        from app.models.session_message import SessionMessage
        result = await db.execute(
            select(SessionMessage)
            .where(SessionMessage.session_id == session_id)
            .order_by(SessionMessage.sequence)
            .limit(50)
        )
        messages = result.scalars().all()

        output_text = "\n".join(
            msg.content for msg in messages
            if msg.role in ("assistant", "result") and msg.content
        )

        return {
            "success": session.status == SessionStatus.COMPLETED.value,
            "status": session.status,
            "output": output_text or "(no output received)",
            "session_id": session_id,
            "machine_name": machine.name,
            "message_count": len(messages),
        }

    except Exception as e:
        logger.error("test_machine_failed", machine_id=machine_id, error=str(e))
        raise HTTPException(500, f"Test failed: {str(e)}")


@router.get("/install-script/{platform}", response_class=PlainTextResponse)
async def get_install_script(platform: str):
    """Serve install script for mac or windows."""
    if platform == "mac":
        return PlainTextResponse(
            content=_MAC_INSTALL_SCRIPT,
            media_type="text/plain",
            headers={"Content-Disposition": "inline; filename=install.sh"},
        )
    elif platform == "windows":
        return PlainTextResponse(
            content=_WINDOWS_INSTALL_SCRIPT,
            media_type="text/plain",
            headers={"Content-Disposition": "inline; filename=install.ps1"},
        )
    else:
        raise HTTPException(
            400,
            f"Unsupported platform: {platform}. Use 'mac' or 'windows'.",
        )
