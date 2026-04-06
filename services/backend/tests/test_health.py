"""Tests for the /api/health endpoint."""

import pytest


@pytest.mark.asyncio
async def test_health_endpoint_returns_ok(client):
    """Health endpoint should return status ok when the test DB is reachable."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_health_endpoint_contains_required_keys(client):
    """Health response must contain 'status' and 'database' keys."""
    response = await client.get("/api/health")
    data = response.json()
    assert "status" in data
    assert "database" in data
