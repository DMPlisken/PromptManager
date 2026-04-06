"""FastAPI application entry point for the orchestrator sidecar."""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import Settings, get_settings
from app.routers.sessions import router as sessions_router
from app.schemas import HealthResponse
from app.session_manager import SessionManager

# ---------------------------------------------------------------------------
# Structured logging
# ---------------------------------------------------------------------------


def _configure_logging(level: str) -> None:
    """Set up structlog with human-readable console output."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            structlog.get_level_from_name(level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------


class AuthMiddleware(BaseHTTPMiddleware):
    """Validate Bearer token if auth_token is configured.

    When auth_token is empty, all requests are allowed (development mode).
    The /health endpoint is always exempt so monitoring can reach it.
    """

    def __init__(self, app, auth_token: str) -> None:  # noqa: ANN001
        super().__init__(app)
        self.auth_token = auth_token

    async def dispatch(self, request: Request, call_next):  # noqa: ANN001
        # Always allow health checks without auth
        if request.url.path == "/health":
            return await call_next(request)

        if self.auth_token:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return Response(
                    content='{"detail":"Missing Authorization header"}',
                    status_code=401,
                    media_type="application/json",
                )
            token = auth_header[len("Bearer ") :]
            if token != self.auth_token:
                return Response(
                    content='{"detail":"Invalid token"}',
                    status_code=403,
                    media_type="application/json",
                )

        return await call_next(request)


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize the SessionManager on startup,
    shut down all sessions on teardown.
    """
    logger = structlog.get_logger()
    settings: Settings = app.state.settings

    manager = SessionManager(settings)
    app.state.session_manager = manager

    logger.info(
        "sidecar_started",
        host=settings.host,
        port=settings.port,
        boot_id=manager.boot_id,
        cli_available=manager.cli_available(),
    )

    yield  # Application runs here

    logger.info("sidecar_shutting_down")
    await manager.shutdown_all()


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build and return the configured FastAPI application."""
    if settings is None:
        settings = get_settings()

    _configure_logging(settings.log_level)

    app = FastAPI(
        title="PromptManager Orchestrator Sidecar",
        description="Host-native sidecar managing Claude Code CLI sessions",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Store settings on app state so lifespan and middleware can access them
    app.state.settings = settings

    # -- Middleware (order matters: outermost first) --
    app.add_middleware(AuthMiddleware, auth_token=settings.auth_token)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -- Routers --
    app.include_router(sessions_router)

    # -- Health endpoint --
    @app.get("/health", response_model=HealthResponse, tags=["health"])
    async def health():
        manager: SessionManager = app.state.session_manager
        return HealthResponse(
            status="ok",
            boot_id=manager.boot_id,
            active_sessions=manager.active_count,
            cli_available=manager.cli_available(),
            uptime_seconds=round(manager.uptime_seconds, 2),
        )

    return app


# Module-level app instance for uvicorn
app = create_app()
