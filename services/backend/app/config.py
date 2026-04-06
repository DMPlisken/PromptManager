from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://promptmgr:promptmgr@db:5432/promptmanager"
    database_url_sync: str = "postgresql://promptmgr:promptmgr@db:5432/promptmanager"
    upload_dir: str = "/app/uploads"

    # Orchestrator settings
    orchestrator_url: str = "http://127.0.0.1:9100"
    sidecar_secret: str = ""
    workspace_root: str = ""
    max_concurrent_sessions: int = 5
    session_timeout_minutes: int = 30
    session_cost_budget_usd: float = 10.0
    claude_default_model: str = "sonnet"
    claude_permission_mode: str = "default"

    # Auth
    app_secret: str = ""  # For session cookie auth
    cors_allowed_origin: str = "http://localhost:3000"

    # Logging
    log_level: str = "info"

    class Config:
        env_file = ".env"


settings = Settings()
