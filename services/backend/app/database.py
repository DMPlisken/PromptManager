from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# Alias for use outside of request context (e.g. background tasks).
# Usage: ``async with async_session_factory() as db: ...``
async_session_factory = async_session


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
