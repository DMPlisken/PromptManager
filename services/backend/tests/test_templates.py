"""Tests for /api/templates endpoints including render and placeholder extraction."""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_group(client, name="Template Test Group"):
    resp = await client.post("/api/groups", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_template(client, group_id, name="My Template", content="Hello {{NAME}}", order=0):
    resp = await client.post(
        "/api/templates",
        json={"group_id": group_id, "name": name, "content": content, "order": order},
    )
    return resp


# ---------------------------------------------------------------------------
# CRUD tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_template(client):
    group_id = await _create_group(client)
    resp = await _create_template(client, group_id)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Template"
    assert data["content"] == "Hello {{NAME}}"
    assert data["group_id"] == group_id
    assert data["order"] == 0


@pytest.mark.asyncio
async def test_list_templates(client):
    group_id = await _create_group(client)
    await _create_template(client, group_id, name="T1", content="A")
    await _create_template(client, group_id, name="T2", content="B")

    resp = await client.get("/api/templates", params={"group_id": group_id})
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_get_template(client):
    group_id = await _create_group(client)
    create_resp = await _create_template(client, group_id)
    tmpl_id = create_resp.json()["id"]

    resp = await client.get(f"/api/templates/{tmpl_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == tmpl_id


@pytest.mark.asyncio
async def test_get_template_not_found(client):
    resp = await client.get("/api/templates/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_template(client):
    group_id = await _create_group(client)
    create_resp = await _create_template(client, group_id)
    tmpl_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/templates/{tmpl_id}",
        json={"name": "Renamed", "content": "Bye {{USER}}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Renamed"
    assert data["content"] == "Bye {{USER}}"


@pytest.mark.asyncio
async def test_delete_template(client):
    group_id = await _create_group(client)
    create_resp = await _create_template(client, group_id)
    tmpl_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/templates/{tmpl_id}")
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/templates/{tmpl_id}")
    assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# Render endpoint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_render_template(client):
    group_id = await _create_group(client)
    create_resp = await _create_template(
        client, group_id, content="Hello {{NAME}}, welcome to {{PLACE}}!"
    )
    tmpl_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/templates/{tmpl_id}/render",
        json={"variables": {"NAME": "Alice", "PLACE": "Wonderland"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["rendered"] == "Hello Alice, welcome to Wonderland!"
    assert data["template_id"] == tmpl_id


@pytest.mark.asyncio
async def test_render_with_missing_variables(client):
    group_id = await _create_group(client)
    create_resp = await _create_template(
        client, group_id, content="Hello {{NAME}}, your role is {{ROLE}}"
    )
    tmpl_id = create_resp.json()["id"]

    # Only provide NAME, ROLE is missing -- should be left as literal placeholder
    resp = await client.post(
        f"/api/templates/{tmpl_id}/render",
        json={"variables": {"NAME": "Bob"}},
    )
    assert resp.status_code == 200
    assert resp.json()["rendered"] == "Hello Bob, your role is {{ROLE}}"


@pytest.mark.asyncio
async def test_render_template_not_found(client):
    resp = await client.post(
        "/api/templates/9999/render", json={"variables": {"X": "Y"}}
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Placeholder extraction endpoint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_extract_placeholders(client):
    group_id = await _create_group(client)
    create_resp = await _create_template(
        client,
        group_id,
        content="{{NAME}} does {{ACTION}} with {{NAME}} again",
    )
    tmpl_id = create_resp.json()["id"]

    resp = await client.get(f"/api/templates/{tmpl_id}/placeholders")
    assert resp.status_code == 200
    placeholders = resp.json()
    # NAME appears twice but should be deduplicated
    assert placeholders == ["NAME", "ACTION"]


@pytest.mark.asyncio
async def test_extract_placeholders_empty(client):
    group_id = await _create_group(client)
    create_resp = await _create_template(
        client, group_id, content="No placeholders here."
    )
    tmpl_id = create_resp.json()["id"]

    resp = await client.get(f"/api/templates/{tmpl_id}/placeholders")
    assert resp.status_code == 200
    assert resp.json() == []
