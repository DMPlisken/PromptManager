"""Unit tests for the SidecarClient circuit breaker logic."""

import time
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.services.sidecar_client import SidecarClient, CircuitBreakerOpen


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fresh_client() -> SidecarClient:
    """Return a SidecarClient with a very short reset timeout for testing."""
    client = SidecarClient()
    client._reset_timeout = 1  # 1 second for fast tests
    return client


# ---------------------------------------------------------------------------
# Circuit breaker tests
# ---------------------------------------------------------------------------


def test_circuit_breaker_starts_closed():
    client = _fresh_client()
    assert client._circuit_open is False
    assert client._failure_count == 0


def test_circuit_breaker_opens_after_max_failures():
    """After _max_failures consecutive failures the circuit should open."""
    client = _fresh_client()

    for _ in range(client._max_failures):
        client._record_failure()

    assert client._circuit_open is True
    assert client._failure_count == client._max_failures

    # Subsequent calls should raise CircuitBreakerOpen
    with pytest.raises(CircuitBreakerOpen):
        client._check_circuit()


def test_circuit_breaker_stays_closed_below_threshold():
    """Fewer than _max_failures should keep the circuit closed."""
    client = _fresh_client()

    for _ in range(client._max_failures - 1):
        client._record_failure()

    assert client._circuit_open is False
    # Should not raise
    client._check_circuit()


def test_circuit_breaker_resets_on_success():
    """A successful call should reset the failure counter and close the circuit."""
    client = _fresh_client()

    # Accumulate some failures (but not enough to open)
    client._record_failure()
    client._record_failure()
    assert client._failure_count == 2

    client._record_success()
    assert client._failure_count == 0
    assert client._circuit_open is False


def test_circuit_breaker_half_open_after_timeout():
    """After the reset timeout, the circuit should transition to half-open (closed)."""
    client = _fresh_client()
    client._reset_timeout = 0  # immediate reset for this test

    # Trip the breaker
    for _ in range(client._max_failures):
        client._record_failure()
    assert client._circuit_open is True

    # Simulate time passing beyond the reset window
    client._circuit_open_until = time.time() - 1

    # _check_circuit should now succeed (half-open -> closed)
    client._check_circuit()
    assert client._circuit_open is False
    assert client._failure_count == 0


def test_circuit_breaker_rejects_while_open():
    """While the circuit is open and timeout has not expired, calls are rejected."""
    client = _fresh_client()
    client._reset_timeout = 60  # long timeout

    for _ in range(client._max_failures):
        client._record_failure()

    with pytest.raises(CircuitBreakerOpen):
        client._check_circuit()


# ---------------------------------------------------------------------------
# health_check tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health_check_returns_none_when_unreachable():
    """health_check should return None when the sidecar is not reachable."""
    client = _fresh_client()

    # Mock httpx.AsyncClient to raise a connection error
    with patch("app.services.sidecar_client.httpx.AsyncClient") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        mock_instance.get = AsyncMock(side_effect=ConnectionError("refused"))
        mock_cls.return_value = mock_instance

        result = await client.health_check()

    assert result is None


@pytest.mark.asyncio
async def test_health_check_returns_data_on_success():
    """health_check should return the JSON payload when the sidecar responds."""
    client = _fresh_client()

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"status": "healthy", "sessions": 0}

    with patch("app.services.sidecar_client.httpx.AsyncClient") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        mock_instance.get = AsyncMock(return_value=mock_response)
        mock_cls.return_value = mock_instance

        result = await client.health_check()

    assert result == {"status": "healthy", "sessions": 0}
    assert client._failure_count == 0


@pytest.mark.asyncio
async def test_health_check_records_failure():
    """A failed health check should increment the failure count."""
    client = _fresh_client()
    assert client._failure_count == 0

    with patch("app.services.sidecar_client.httpx.AsyncClient") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        mock_instance.get = AsyncMock(side_effect=ConnectionError("refused"))
        mock_cls.return_value = mock_instance

        await client.health_check()

    assert client._failure_count == 1


@pytest.mark.asyncio
async def test_health_check_returns_none_when_circuit_open():
    """health_check should return None (not raise) when the circuit is open."""
    client = _fresh_client()
    client._reset_timeout = 60

    # Trip the breaker
    for _ in range(client._max_failures):
        client._record_failure()
    assert client._circuit_open is True

    result = await client.health_check()
    assert result is None
