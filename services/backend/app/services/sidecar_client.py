"""HTTP client for the Claude sidecar process with circuit-breaker protection."""

import json
import time
from typing import AsyncIterator

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger()


class CircuitBreakerOpen(Exception):
    """Raised when the circuit breaker is open and calls are rejected."""


class SidecarClient:
    """Async HTTP client that talks to the sidecar at ``settings.orchestrator_url``."""

    def __init__(self) -> None:
        self.base_url = settings.orchestrator_url
        self.timeout = httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)

        # Circuit-breaker state
        self._failure_count: int = 0
        self._circuit_open: bool = False
        self._circuit_open_until: float = 0.0
        self._max_failures: int = 3
        self._reset_timeout: int = 10  # seconds

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _get_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if settings.sidecar_secret:
            headers["Authorization"] = f"Bearer {settings.sidecar_secret}"
        return headers

    def _check_circuit(self) -> None:
        if self._circuit_open:
            if time.time() > self._circuit_open_until:
                self._circuit_open = False
                self._failure_count = 0
                logger.info("circuit_breaker_half_open")
            else:
                raise CircuitBreakerOpen("Sidecar circuit breaker is open")

    def _record_failure(self) -> None:
        self._failure_count += 1
        if self._failure_count >= self._max_failures:
            self._circuit_open = True
            self._circuit_open_until = time.time() + self._reset_timeout
            logger.warning("circuit_breaker_opened", failures=self._failure_count)

    def _record_success(self) -> None:
        self._failure_count = 0
        self._circuit_open = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def health_check(self) -> dict | None:
        """Return sidecar health payload, or ``None`` if unreachable."""
        try:
            self._check_circuit()
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    f"{self.base_url}/health", headers=self._get_headers()
                )
                resp.raise_for_status()
                self._record_success()
                return resp.json()
        except CircuitBreakerOpen:
            return None
        except Exception as exc:
            self._record_failure()
            logger.warning("sidecar_health_check_failed", error=str(exc))
            return None

    async def create_session(
        self,
        session_id: str,
        prompt: str,
        working_directory: str,
        model: str | None = None,
        permission_mode: str | None = None,
        allowed_tools: list[str] | None = None,
    ) -> dict:
        """Ask the sidecar to spawn a new Claude session."""
        self._check_circuit()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/sessions",
                    headers=self._get_headers(),
                    json={
                        "session_id": session_id,
                        "prompt": prompt,
                        "working_directory": working_directory,
                        "model": model,
                        "permission_mode": permission_mode,
                        "allowed_tools": allowed_tools,
                    },
                )
                resp.raise_for_status()
                self._record_success()
                return resp.json()
        except Exception:
            self._record_failure()
            raise

    async def stream_session(self, session_id: str) -> AsyncIterator[dict]:
        """Connect to sidecar SSE and yield parsed JSON messages."""
        self._check_circuit()
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(connect=5.0, read=None, write=5.0, pool=5.0)
            ) as client:
                async with client.stream(
                    "GET",
                    f"{self.base_url}/sessions/{session_id}/stream",
                    headers=self._get_headers(),
                ) as response:
                    self._record_success()
                    buffer = ""
                    async for chunk in response.aiter_text():
                        buffer += chunk
                        while "\n\n" in buffer:
                            event, buffer = buffer.split("\n\n", 1)
                            for line in event.split("\n"):
                                if line.startswith("data: "):
                                    data = line[6:]
                                    try:
                                        yield json.loads(data)
                                    except json.JSONDecodeError:
                                        pass
        except Exception:
            self._record_failure()
            raise

    async def abort_session(self, session_id: str) -> dict:
        """Tell the sidecar to abort a running session."""
        self._check_circuit()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/sessions/{session_id}/abort",
                    headers=self._get_headers(),
                )
                resp.raise_for_status()
                self._record_success()
                return resp.json()
        except Exception:
            self._record_failure()
            raise

    async def get_sessions(self) -> list[dict]:
        """List all sessions known to the sidecar."""
        self._check_circuit()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    f"{self.base_url}/sessions", headers=self._get_headers()
                )
                resp.raise_for_status()
                self._record_success()
                return resp.json()
        except Exception:
            self._record_failure()
            raise


# Module-level singleton
sidecar_client = SidecarClient()
