from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://promptmgr:promptmgr@db:5432/promptmanager"
    database_url_sync: str = "postgresql://promptmgr:promptmgr@db:5432/promptmanager"

    class Config:
        env_file = ".env"


settings = Settings()
