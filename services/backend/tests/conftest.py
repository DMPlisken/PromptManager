"""Shared test fixtures: in-memory SQLite engine, async client, DB override.

Strategy
--------
The production ``app.database`` module creates a PostgreSQL engine at import
time with pool arguments that are incompatible with SQLite's StaticPool.
We therefore create our *own* SQLite engine and session factory, then
**monkey-patch** the ``app.database`` module attributes before any router
code touches the DB.  The ``get_db`` FastAPI dependency is overridden via
``app.dependency_overrides`` so request-scoped sessions also use our test DB.
"""

import os
import sys

# ---------------------------------------------------------------------------
# 1. Override DATABASE_URL so that ``app.config.Settings`` picks up a dummy
#    value, preventing any accidental real-DB connections.
# ---------------------------------------------------------------------------
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite://")

# ---------------------------------------------------------------------------
# 2. Bootstrap a minimal ``app.database`` replacement *before* any other app
#    module is imported.  This avoids the ``create_async_engine(postgresql…)``
#    call that happens at module scope in ``app/database.py``.
# ---------------------------------------------------------------------------

from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase  # noqa: E402

# Compile PostgreSQL-specific types to SQLite equivalents so that
# ``Base.metadata.create_all`` works against the SQLite engine.
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(PgUUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(36)"


# Create an in-memory SQLite async engine.
test_engine = create_async_engine("sqlite+aiosqlite://", echo=False)
test_session_factory = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False,
)


class _Base(DeclarativeBase):
    pass


# Build a lightweight stand-in module so that ``from app.database import …``
# resolves correctly no matter the import order.
import types  # noqa: E402

_db_mod = types.ModuleType("app.database")
_db_mod.engine = test_engine
_db_mod.async_session = test_session_factory
_db_mod.async_session_factory = test_session_factory
_db_mod.Base = _Base


async def _get_db():
    async with test_session_factory() as session:
        yield session


_db_mod.get_db = _get_db
_db_mod.create_async_engine = create_async_engine
_db_mod.async_sessionmaker = async_sessionmaker
_db_mod.AsyncSession = AsyncSession

# Insert our stand-in before the real module gets imported.
sys.modules["app.database"] = _db_mod

# ---------------------------------------------------------------------------
# 3. NOW import app code.  Every module that does
#    ``from app.database import Base`` will get our _Base.
# ---------------------------------------------------------------------------

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import AsyncClient, ASGITransport  # noqa: E402

# Force-import all models so they register on our _Base.metadata.
import app.models  # noqa: E402, F401

# Import the real get_db so we can use it as the override key.
# Since we replaced the module, this is our own _get_db.
from app.database import Base, get_db  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test and tear them down afterward."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _override_get_db():
    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    from app.main import app

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
