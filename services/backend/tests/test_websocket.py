"""Tests for the /ws/orchestrator WebSocket endpoint."""

import json

import pytest
from starlette.testclient import TestClient

from tests.conftest import _override_get_db

# We need the app but with the DB override applied.
# For synchronous WebSocket tests (starlette TestClient is sync), we apply
# the override once at module level.
from app.main import app
from app.database import get_db

app.dependency_overrides[get_db] = _override_get_db


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_websocket_connect_and_ping():
    """Client should be able to connect and receive a pong for a ping."""
    client = TestClient(app)
    with client.websocket_connect("/ws/orchestrator") as ws:
        ws.send_text(json.dumps({"type": "protocol.ping", "timestamp": 12345}))
        data = json.loads(ws.receive_text())
        assert data["type"] == "protocol.pong"
        assert data["timestamp"] == 12345
        assert "serverTimestamp" in data


def test_websocket_invalid_json():
    """Sending non-JSON text should yield a protocol.error response."""
    client = TestClient(app)
    with client.websocket_connect("/ws/orchestrator") as ws:
        ws.send_text("this is not json")
        data = json.loads(ws.receive_text())
        assert data["type"] == "protocol.error"
        assert data["code"] == "INVALID_MESSAGE"


def test_websocket_unknown_message_type():
    """Sending an unknown message type should not crash the connection.

    The server simply ignores unknown types and keeps the connection alive.
    We verify the connection is still functional by sending a ping after.
    """
    client = TestClient(app)
    with client.websocket_connect("/ws/orchestrator") as ws:
        ws.send_text(json.dumps({"type": "unknown.type"}))
        # Connection should still work -- send a ping to verify
        ws.send_text(json.dumps({"type": "protocol.ping", "timestamp": 99}))
        data = json.loads(ws.receive_text())
        assert data["type"] == "protocol.pong"
        assert data["timestamp"] == 99


def test_websocket_subscribe_unsubscribe():
    """Subscribe and unsubscribe messages should not error."""
    client = TestClient(app)
    with client.websocket_connect("/ws/orchestrator") as ws:
        ws.send_text(
            json.dumps({"type": "session.subscribe", "sessionId": "test-session-id"})
        )
        ws.send_text(
            json.dumps({"type": "session.unsubscribe", "sessionId": "test-session-id"})
        )
        # Verify connection is still alive
        ws.send_text(json.dumps({"type": "protocol.ping", "timestamp": 1}))
        data = json.loads(ws.receive_text())
        assert data["type"] == "protocol.pong"


def test_websocket_multiple_pings():
    """Multiple pings should each get their own pong with the correct timestamp."""
    client = TestClient(app)
    with client.websocket_connect("/ws/orchestrator") as ws:
        for ts in [100, 200, 300]:
            ws.send_text(json.dumps({"type": "protocol.ping", "timestamp": ts}))
            data = json.loads(ws.receive_text())
            assert data["type"] == "protocol.pong"
            assert data["timestamp"] == ts
