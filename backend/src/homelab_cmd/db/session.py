"""Database session management for HomelabCmd."""

import logging
from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from homelab_cmd.config import get_settings
from homelab_cmd.db.base import Base

logger = logging.getLogger(__name__)

# Global engine and session factory
_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


def _get_async_database_url() -> str:
    """Convert sync database URL to async format."""
    settings = get_settings()
    url = settings.database_url

    # Convert sqlite:/// to sqlite+aiosqlite:///
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)

    return url


def get_engine() -> AsyncEngine:
    """Get or create the async database engine."""
    global _engine

    if _engine is None:
        database_url = _get_async_database_url()
        logger.info("Creating database engine: %s", database_url.split("///")[-1])

        _engine = create_async_engine(
            database_url,
            echo=False,  # Set to True for SQL logging
            connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
        )

    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Get or create the async session factory."""
    global _async_session_factory

    if _async_session_factory is None:
        engine = get_engine()
        _async_session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    return _async_session_factory


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides an async database session.

    Usage in FastAPI:
        @app.get("/items")
        async def get_items(session: AsyncSession = Depends(get_async_session)):
            ...
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_database() -> None:
    """Initialise the database, creating tables if they don't exist.

    This function:
    1. Ensures the data directory exists
    2. Creates all tables defined in the models
    3. Verifies database connectivity
    """
    settings = get_settings()

    # Extract path from database URL and ensure directory exists
    if settings.database_url.startswith("sqlite:///"):
        db_path = settings.database_url.replace("sqlite:///", "")
        if db_path.startswith("./"):
            db_path = db_path[2:]

        db_file = Path(db_path)
        if db_file.parent.name:  # Has a directory component
            db_file.parent.mkdir(parents=True, exist_ok=True)
            logger.info("Ensured data directory exists: %s", db_file.parent)

    # Import models to register them with Base.metadata
    # This import is here to avoid circular imports
    from homelab_cmd.db import models  # noqa: F401

    engine = get_engine()

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")

    # Verify connectivity
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        result.scalar()
        logger.info("Database connectivity verified")


async def check_database_connection() -> bool:
    """Check if the database is connected and responsive.

    Returns:
        True if database is connected, False otherwise.
    """
    try:
        engine = get_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("Database connection check failed: %s", e)
        return False


async def dispose_engine() -> None:
    """Dispose of the database engine and cleanup connections."""
    global _engine, _async_session_factory

    if _engine is not None:
        await _engine.dispose()
        logger.info("Database engine disposed")
        _engine = None
        _async_session_factory = None
