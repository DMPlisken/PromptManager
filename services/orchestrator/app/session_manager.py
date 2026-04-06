"""Core session manager: spawns and manages Claude Code CLI subprocesses."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import time
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, AsyncIterator

import structlog

if TYPE_CHECKING:
    from app.config import Settings

logger = structlog.get_logger()


@dataclass
class ManagedSession:
    """State container for a single Claude CLI subprocess session."""

    session_id: str
    process: asyncio.subprocess.Process | None = None
    status: str = "starting"
    working_directory: str = ""
    model: str = "sonnet"
    started_at: float = field(default_factory=time.time)
    message_queue: asyncio.Queue = field(
        default_factory=lambda: asyncio.Queue(maxsize=10_000)
    )
    _reader_task: asyncio.Task | None = field(default=None, repr=False)
    approval_events: dict[str, asyncio.Event] = field(default_factory=dict)
    approval_results: dict[str, bool] = field(default_factory=dict)


class SessionManager:
    """Manages the lifecycle of Claude Code CLI subprocess sessions.

    Each session corresponds to a single `claude --print` invocation.
    Output is read line-by-line (stream-json format) and placed on an
    asyncio.Queue that the SSE endpoint drains.
    """

    def __init__(self, config: Settings) -> None:
        self.config = config
        self.sessions: dict[str, ManagedSession] = {}
        self.boot_id: str = str(uuid.uuid4())[:12]
        self._start_time: float = time.time()

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def active_count(self) -> int:
        """Number of sessions that are still in progress."""
        return sum(
            1
            for s in self.sessions.values()
            if s.status in ("starting", "running", "waiting_approval")
        )

    @property
    def uptime_seconds(self) -> float:
        return time.time() - self._start_time

    # ------------------------------------------------------------------
    # CLI detection
    # ------------------------------------------------------------------

    def _resolve_cli_path(self) -> str | None:
        """Return the resolved path to the claude CLI binary, or None."""
        if self.config.claude_cli_path:
            path = self.config.claude_cli_path
            # If it's an absolute path, check it directly
            if os.path.isabs(path):
                return path if os.path.isfile(path) and os.access(path, os.X_OK) else None
            # Otherwise try which
            return shutil.which(path)
        return shutil.which("claude")

    def cli_available(self) -> bool:
        """Check whether the Claude CLI binary can be found."""
        return self._resolve_cli_path() is not None

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    async def create_session(
        self,
        session_id: str,
        prompt: str,
        working_directory: str,
        model: str | None = None,
        permission_mode: str | None = None,
        allowed_tools: list[str] | None = None,
    ) -> ManagedSession:
        """Spawn a new Claude CLI subprocess for the given prompt."""

        # Guard: CLI must be available
        cli_path = self._resolve_cli_path()
        if cli_path is None:
            raise RuntimeError(
                "Claude CLI binary not found. Install it or set SIDECAR_CLAUDE_CLI_PATH."
            )

        # Guard: concurrency limit
        if self.active_count >= self.config.max_concurrent_sessions:
            raise ValueError(
                f"Max concurrent sessions ({self.config.max_concurrent_sessions}) reached"
            )

        # Guard: duplicate session
        if session_id in self.sessions:
            raise ValueError(f"Session {session_id} already exists")

        # Guard: working directory exists
        if not os.path.isdir(working_directory):
            raise ValueError(
                f"Working directory does not exist: {working_directory}"
            )

        # Guard: workspace_root restriction
        if self.config.workspace_root:
            real_wd = os.path.realpath(working_directory)
            real_root = os.path.realpath(self.config.workspace_root)
            if not real_wd.startswith(real_root):
                raise ValueError(
                    f"Working directory {working_directory} is outside allowed "
                    f"workspace root {self.config.workspace_root}"
                )

        session = ManagedSession(
            session_id=session_id,
            working_directory=working_directory,
            model=model or self.config.default_model,
        )
        self.sessions[session_id] = session

        # Build the CLI command
        cmd: list[str] = [
            cli_path,
            "--print",
            "--output-format",
            "stream-json",
            "--model",
            session.model,
            "--max-turns",
            "50",
        ]

        pm = permission_mode or self.config.default_permission_mode
        if pm:
            cmd.extend(["--permission-mode", pm])

        if allowed_tools:
            for tool in allowed_tools:
                cmd.extend(["--allowedTools", tool])

        # Spawn the subprocess
        try:
            session.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_directory,
            )

            # Write the prompt to stdin and close it so Claude starts processing
            if session.process.stdin:
                session.process.stdin.write(prompt.encode("utf-8") + b"\n")
                await session.process.stdin.drain()
                session.process.stdin.close()

            session.status = "running"
            session._reader_task = asyncio.create_task(
                self._read_output(session),
                name=f"reader-{session_id}",
            )

            logger.info(
                "session_created",
                session_id=session_id,
                pid=session.process.pid,
                model=session.model,
            )
            return session

        except Exception as exc:
            session.status = "failed"
            logger.error(
                "session_create_failed",
                session_id=session_id,
                error=str(exc),
            )
            raise

    # ------------------------------------------------------------------
    # Output reader (background task per session)
    # ------------------------------------------------------------------

    async def _read_output(self, session: ManagedSession) -> None:
        """Read stdout from the Claude CLI subprocess and enqueue parsed messages."""
        sequence = 0
        rc = -1
        try:
            assert session.process is not None and session.process.stdout is not None

            async for raw_line in session.process.stdout:
                line_str = raw_line.decode("utf-8", errors="replace").strip()
                if not line_str:
                    continue

                sequence += 1

                try:
                    msg = json.loads(line_str)
                except json.JSONDecodeError:
                    # Non-JSON output (progress indicators, warnings, etc.)
                    msg = {
                        "type": "system",
                        "content": line_str,
                    }

                msg["_sequence"] = sequence
                msg["_session_id"] = session.session_id
                await session.message_queue.put(msg)

            # Subprocess stdout is exhausted -- wait for exit
            await session.process.wait()
            rc = session.process.returncode or 0

            if rc == 0:
                session.status = "completed"
            else:
                session.status = "failed"
                # Capture stderr for diagnostics
                stderr_text = ""
                if session.process.stderr:
                    stderr_bytes = await session.process.stderr.read()
                    stderr_text = stderr_bytes.decode("utf-8", errors="replace")[:5000]
                sequence += 1
                await session.message_queue.put(
                    {
                        "_sequence": sequence,
                        "_session_id": session.session_id,
                        "type": "error",
                        "error": f"Process exited with code {rc}",
                        "stderr": stderr_text,
                    }
                )

        except asyncio.CancelledError:
            session.status = "terminated"

        except Exception as exc:
            session.status = "failed"
            logger.error(
                "session_read_error",
                session_id=session.session_id,
                error=str(exc),
            )
            sequence += 1
            await session.message_queue.put(
                {
                    "_sequence": sequence,
                    "_session_id": session.session_id,
                    "type": "error",
                    "error": str(exc),
                }
            )

        finally:
            # Always send the sentinel so SSE consumers know the stream is over
            await session.message_queue.put(None)
            logger.info(
                "session_ended",
                session_id=session.session_id,
                status=session.status,
                return_code=rc,
            )

    # ------------------------------------------------------------------
    # Streaming
    # ------------------------------------------------------------------

    async def stream_messages(self, session_id: str) -> AsyncIterator[dict]:
        """Yield messages from a session's queue as they arrive.

        Returns when the sentinel (None) is received, indicating the
        subprocess has exited and all output has been flushed.
        """
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        while True:
            msg = await session.message_queue.get()
            if msg is None:
                break
            yield msg

    # ------------------------------------------------------------------
    # Abort / cleanup
    # ------------------------------------------------------------------

    async def abort_session(self, session_id: str) -> None:
        """Terminate a running session's subprocess."""
        session = self.sessions.get(session_id)
        if not session or not session.process:
            return

        session.status = "terminated"

        if session._reader_task and not session._reader_task.done():
            session._reader_task.cancel()

        try:
            session.process.terminate()
            try:
                await asyncio.wait_for(session.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                session.process.kill()
        except ProcessLookupError:
            pass

        logger.info("session_aborted", session_id=session_id)

    async def remove_session(self, session_id: str) -> None:
        """Abort (if running) and remove a session from the registry."""
        await self.abort_session(session_id)
        self.sessions.pop(session_id, None)
        logger.info("session_removed", session_id=session_id)

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    async def get_session_status(self, session_id: str) -> dict:
        """Return a status dict for a single session."""
        session = self.sessions.get(session_id)
        if not session:
            return {"session_id": session_id, "status": "not_found"}
        return {
            "session_id": session_id,
            "status": session.status,
            "pid": session.process.pid if session.process else None,
            "started_at": session.started_at,
        }

    def list_sessions(self) -> list[dict]:
        """Return status dicts for all sessions."""
        results = []
        for session in self.sessions.values():
            results.append(
                {
                    "session_id": session.session_id,
                    "status": session.status,
                    "pid": session.process.pid if session.process else None,
                    "started_at": session.started_at,
                }
            )
        return results

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    async def shutdown_all(self) -> None:
        """Abort every active session. Called during application shutdown."""
        for sid in list(self.sessions.keys()):
            await self.abort_session(sid)
        logger.info("all_sessions_shutdown", count=len(self.sessions))
