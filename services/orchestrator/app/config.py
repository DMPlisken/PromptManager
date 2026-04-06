"""Configuration for the orchestrator sidecar service."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Sidecar configuration loaded from environment variables.

    All settings can be overridden via environment variables prefixed with
    SIDECAR_ (e.g. SIDECAR_PORT=9100, SIDECAR_AUTH_TOKEN=secret).
    """

    host: str = "127.0.0.1"
    port: int = 9100
    auth_token: str = ""
    workspace_root: str = ""
    max_concurrent_sessions: int = 5
    session_timeout_seconds: int = 1800
    max_session_cost_usd: float = 10.0
    claude_cli_path: str = ""
    default_model: str = "sonnet"
    default_permission_mode: str = "default"
    log_level: str = "info"

    model_config = {"env_prefix": "SIDECAR_"}


def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
