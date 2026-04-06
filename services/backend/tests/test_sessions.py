"""Tests for /api/sessions endpoints with mocked sidecar client."""

import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.services.sidecar_client import CircuitBreakerOpen


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Unique group counter to avoid UNIQUE constraint violations across tests.
_group_counter = 0


async def _create_group(client, name=None):
    global _group_counter
    _group_counter += 1
    name = name or f"Session Test Group {_group_counter}"
    resp = await client.post("/api/groups", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


def _mock_sidecar():
    """Return a mock that replaces the sidecar_client module-level singleton."""
    mock = MagicMock()
    mock.create_session = AsyncMock(
        return_value={"session_id": "mock-sid", "status": "running"}
    )
    mock.abort_session = AsyncMock(return_value={"status": "terminated"})
    mock.health_check = AsyncMock(return_value={"status": "healthy"})

    # stream_session must return an async iterator; provide an empty one
    async def _empty_stream(session_id):
        return
        yield  # noqa: make it an async generator

    mock.stream_session = _empty_stream
    return mock


async def _noop_stream_relay(self, session_id):
    """No-op replacement for SessionManager._stream_relay in tests."""
    pass


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_session(client):
    group_id = await _create_group(client)

    with patch("app.services.session_manager.sidecar_client", _mock_sidecar()):
        resp = await client.post(
            "/api/sessions",
            json={
                "prompt": "Write hello world",
                "working_directory": "/tmp",
                "model": "sonnet",
                "group_id": group_id,
            },
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] in ("starting", "running")
    assert data["initial_prompt"] == "Write hello world"
    assert data["group_id"] == group_id
    assert data["model"] == "sonnet"


@pytest.mark.asyncio
async def test_create_session_without_group(client):
    with patch("app.services.session_manager.sidecar_client", _mock_sidecar()):
        resp = await client.post(
            "/api/sessions",
            json={
                "prompt": "Hello",
                "working_directory": "/tmp",
            },
        )
    assert resp.status_code == 201
    assert resp.json()["group_id"] is None


@pytest.mark.asyncio
async def test_create_session_sidecar_unavailable(client):
    """When the circuit breaker is open, session creation should fail with 503."""
    mock = _mock_sidecar()
    mock.create_session = AsyncMock(side_effect=CircuitBreakerOpen("open"))

    # The session_manager catches CircuitBreakerOpen and raises ValueError,
    # which the router maps to 503.
    with patch("app.services.session_manager.sidecar_client", mock):
        resp = await client.post(
            "/api/sessions",
            json={"prompt": "Test", "working_directory": "/tmp"},
        )
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_list_sessions_empty(client):
    resp = await client.get("/api/sessions")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_sessions(client):
    group_id = await _create_group(client)
    mock = _mock_sidecar()

    with patch("app.services.session_manager.sidecar_client", mock):
        await client.post(
            "/api/sessions",
            json={"prompt": "S1", "working_directory": "/tmp", "group_id": group_id},
        )
        await client.post(
            "/api/sessions",
            json={"prompt": "S2", "working_directory": "/tmp", "group_id": group_id},
        )

    resp = await client.get("/api/sessions")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_get_session(client):
    group_id = await _create_group(client)
    mock = _mock_sidecar()

    with patch("app.services.session_manager.sidecar_client", mock):
        create_resp = await client.post(
            "/api/sessions",
            json={"prompt": "Test", "working_directory": "/tmp", "group_id": group_id},
        )
    session_id = create_resp.json()["id"]

    resp = await client.get(f"/api/sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == session_id


@pytest.mark.asyncio
async def test_get_session_not_found(client):
    resp = await client.get("/api/sessions/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_abort_session(client):
    group_id = await _create_group(client)
    mock = _mock_sidecar()

    with (
        patch("app.services.session_manager.sidecar_client", mock),
        patch(
            "app.services.session_manager.SessionManager._stream_relay",
            _noop_stream_relay,
        ),
    ):
        create_resp = await client.post(
            "/api/sessions",
            json={"prompt": "Test", "working_directory": "/tmp", "group_id": group_id},
        )
        session_id = create_resp.json()["id"]

        resp = await client.post(f"/api/sessions/{session_id}/abort")
    assert resp.status_code == 200
    assert resp.json()["status"] == "terminated"


@pytest.mark.asyncio
async def test_delete_session(client):
    group_id = await _create_group(client)
    mock = _mock_sidecar()

    with patch("app.services.session_manager.sidecar_client", mock):
        create_resp = await client.post(
            "/api/sessions",
            json={"prompt": "Test", "working_directory": "/tmp", "group_id": group_id},
        )
    session_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/sessions/{session_id}")
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/sessions/{session_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_get_session_messages_empty(client):
    """A newly created session should have no messages."""
    group_id = await _create_group(client)
    mock = _mock_sidecar()

    with patch("app.services.session_manager.sidecar_client", mock):
        create_resp = await client.post(
            "/api/sessions",
            json={"prompt": "Test", "working_directory": "/tmp", "group_id": group_id},
        )
    session_id = create_resp.json()["id"]

    resp = await client.get(f"/api/sessions/{session_id}/messages")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_sessions_filter_by_status(client):
    """Filtering by status should only return matching sessions."""
    group_id = await _create_group(client)
    mock = _mock_sidecar()

    with patch("app.services.session_manager.sidecar_client", mock):
        await client.post(
            "/api/sessions",
            json={"prompt": "Test", "working_directory": "/tmp", "group_id": group_id},
        )

    # The session should be in 'running' status after successful creation
    resp = await client.get("/api/sessions", params={"status": "running"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = await client.get("/api/sessions", params={"status": "completed"})
    assert resp.status_code == 200
    assert len(resp.json()) == 0
