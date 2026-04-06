"""Simple session-cookie authentication middleware.

When ``app_secret`` is an empty string (the default for local dev), auth
is bypassed entirely and every request is treated as authenticated.

In production, set ``APP_SECRET`` to a passphrase.  The ``/api/auth/login``
endpoint validates that passphrase and sets a signed session cookie.
"""

import hashlib
import hmac
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel

from app.config import settings

router = APIRouter()

# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------

_COOKIE_NAME = "pm_session"
_COOKIE_MAX_AGE = 60 * 60 * 24  # 24 hours


def _sign_token(payload: str) -> str:
    """Create an HMAC-signed token: <payload>.<signature>."""
    secret = settings.app_secret or "dev"
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _verify_token(token: str) -> bool:
    """Verify an HMAC-signed token."""
    if "." not in token:
        return False
    payload, sig = token.rsplit(".", 1)
    secret = settings.app_secret or "dev"
    expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected)


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------


async def require_auth(pm_session: Annotated[str | None, Cookie()] = None) -> bool:
    """FastAPI dependency: enforce auth when app_secret is set.

    When ``app_secret`` is empty (dev mode), every request passes.
    """
    if not settings.app_secret:
        # Dev mode — auth disabled
        return True

    if pm_session is None or not _verify_token(pm_session):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return True


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    passphrase: str


class AuthStatusResponse(BaseModel):
    authenticated: bool
    auth_required: bool


@router.post("/api/auth/login")
async def login(body: LoginRequest, response: Response):
    """Validate passphrase and set session cookie."""
    if not settings.app_secret:
        # Dev mode — always succeed
        response.set_cookie(
            key=_COOKIE_NAME,
            value=_sign_token(f"dev-{int(time.time())}"),
            httponly=True,
            samesite="lax",
            max_age=_COOKIE_MAX_AGE,
        )
        return {"status": "ok", "message": "Auth disabled in dev mode"}

    if not secrets.compare_digest(body.passphrase, settings.app_secret):
        raise HTTPException(status_code=403, detail="Invalid passphrase")

    token_payload = f"{secrets.token_hex(16)}-{int(time.time())}"
    response.set_cookie(
        key=_COOKIE_NAME,
        value=_sign_token(token_payload),
        httponly=True,
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
    )
    return {"status": "ok"}


@router.get("/api/auth/status", response_model=AuthStatusResponse)
async def auth_status(pm_session: Annotated[str | None, Cookie()] = None):
    """Check whether the current request is authenticated."""
    auth_required = bool(settings.app_secret)
    if not auth_required:
        return AuthStatusResponse(authenticated=True, auth_required=False)

    authenticated = pm_session is not None and _verify_token(pm_session)
    return AuthStatusResponse(authenticated=authenticated, auth_required=True)


@router.post("/api/auth/logout")
async def logout(response: Response):
    """Clear the session cookie."""
    response.delete_cookie(key=_COOKIE_NAME)
    return {"status": "ok"}
