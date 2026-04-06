"""Tests for CRUD operations on /api/groups."""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_group(client, name="Test Group", description="A test group"):
    resp = await client.post(
        "/api/groups", json={"name": name, "description": description}
    )
    return resp


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_group(client):
    resp = await _create_group(client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Group"
    assert data["description"] == "A test group"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_group_without_description(client):
    resp = await client.post("/api/groups", json={"name": "Minimal"})
    assert resp.status_code == 201
    assert resp.json()["description"] is None


@pytest.mark.asyncio
async def test_list_groups_empty(client):
    resp = await client.get("/api/groups")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_groups(client):
    await _create_group(client, name="Alpha")
    await _create_group(client, name="Beta")
    resp = await client.get("/api/groups")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    names = [g["name"] for g in data]
    assert "Alpha" in names
    assert "Beta" in names


@pytest.mark.asyncio
async def test_get_group(client):
    create_resp = await _create_group(client)
    group_id = create_resp.json()["id"]

    resp = await client.get(f"/api/groups/{group_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == group_id
    assert resp.json()["name"] == "Test Group"


@pytest.mark.asyncio
async def test_get_group_not_found(client):
    resp = await client.get("/api/groups/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_group(client):
    create_resp = await _create_group(client)
    group_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/groups/{group_id}",
        json={"name": "Updated Name", "description": "Updated desc"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated desc"


@pytest.mark.asyncio
async def test_update_group_partial(client):
    create_resp = await _create_group(client, name="Original", description="Original desc")
    group_id = create_resp.json()["id"]

    # Update only name, description should stay the same
    resp = await client.put(f"/api/groups/{group_id}", json={"name": "Changed"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Changed"
    assert data["description"] == "Original desc"


@pytest.mark.asyncio
async def test_update_group_not_found(client):
    resp = await client.put("/api/groups/9999", json={"name": "X"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_group(client):
    create_resp = await _create_group(client)
    group_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/groups/{group_id}")
    assert del_resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/api/groups/{group_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_group_not_found(client):
    resp = await client.delete("/api/groups/9999")
    assert resp.status_code == 404
