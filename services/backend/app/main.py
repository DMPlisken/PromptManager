import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine, async_session
from app.routers import groups, variables, templates, executions, tasks, images, tags, task_images, export_import, sessions, websocket, machines, agent_ws
from app.middleware.auth import router as auth_router
from app.services.session_manager import session_manager
from app.services.agent_manager import agent_manager

# Ensure new models are registered with Base.metadata
import app.models  # noqa: F401

# ---------------------------------------------------------------------------
# Structured logging setup
# ---------------------------------------------------------------------------

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(settings.log_level.upper())
    ),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("startup", version="2.0.0", log_level=settings.log_level)
    # Verify DB connectivity on startup
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("database_connected")
    except Exception as exc:
        logger.error("database_connection_failed", error=str(exc))

    yield

    # Shutdown
    await agent_manager.shutdown()
    await session_manager.shutdown()
    await engine.dispose()
    logger.info("shutdown")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(title="PromptManager API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(auth_router, tags=["auth"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(variables.router, prefix="/api/variables", tags=["variables"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(executions.router, prefix="/api/executions", tags=["executions"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(images.router, prefix="/api/images", tags=["images"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
app.include_router(task_images.router, prefix="/api/task-images", tags=["task-images"])
app.include_router(export_import.router, prefix="/api/groups", tags=["export-import"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(machines.router, prefix="/api/machines", tags=["machines"])
app.include_router(websocket.router)
app.include_router(agent_ws.router)


# ---------------------------------------------------------------------------
# Health & metrics
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    """Health check with database connectivity probe."""
    db_ok = False
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    status = "ok" if db_ok else "degraded"
    return {"status": status, "database": "connected" if db_ok else "unreachable"}


@app.get("/api/metrics")
async def metrics():
    """Stub metrics endpoint for future Prometheus integration."""
    return {"message": "metrics endpoint — not yet implemented"}
