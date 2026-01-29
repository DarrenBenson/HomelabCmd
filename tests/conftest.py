"""Pytest fixtures for HomelabCmd tests."""

import os
from collections.abc import AsyncGenerator, Generator
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from cryptography.fernet import Fernet as _Fernet
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Set test API key before importing app
TEST_API_KEY = "test-api-key-12345"
os.environ["HOMELAB_CMD_API_KEY"] = TEST_API_KEY

# Use in-memory database for tests
os.environ["HOMELAB_CMD_DATABASE_URL"] = "sqlite:///:memory:"

# Skip encryption key validation for most tests
os.environ["HOMELAB_CMD_TESTING"] = "true"

# Test encryption key (valid Fernet key for credential service tests)
TEST_ENCRYPTION_KEY = _Fernet.generate_key().decode()
os.environ["HOMELAB_CMD_ENCRYPTION_KEY"] = TEST_ENCRYPTION_KEY


@pytest.fixture
def api_key() -> str:
    """Return the test API key."""
    return TEST_API_KEY


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client for the FastAPI application.

    Uses a test-specific lifespan that skips the background scheduler
    to ensure clean async resource cleanup.
    """
    from collections.abc import AsyncGenerator
    from contextlib import asynccontextmanager
    from datetime import UTC, datetime

    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    from homelab_cmd.api.routes import (
        actions,
        agent_register,
        agents,
        alerts,
        config,
        connectivity_settings,
        costs,
        discovery,
        metrics,
        preferences,
        scan,
        servers,
        services,
        system,
        tailscale,
        widget_layout,
    )
    from homelab_cmd.config import get_settings
    from homelab_cmd.db import dispose_engine, init_database
    from homelab_cmd.main import OPENAPI_TAGS

    @asynccontextmanager
    async def test_lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        """Test lifespan without scheduler to avoid async cleanup issues."""
        system.set_start_time(datetime.now(UTC))
        await init_database()
        yield
        await dispose_engine()

    def create_test_app() -> FastAPI:
        """Create test app without background scheduler."""
        settings = get_settings()
        app = FastAPI(
            title=settings.api_title,
            version=settings.api_version,
            summary="Self-hosted homelab infrastructure monitoring API",
            description="""
HomelabCmd provides a comprehensive monitoring and management platform for
homelab infrastructure. Features include:

- **Server Monitoring**: Track CPU, memory, disk, and network metrics
- **Alert Management**: Configurable thresholds with Slack notifications
- **Agent Communication**: Lightweight agents push metrics via heartbeat
- **Historical Data**: Time-series metrics with configurable retention
""",
            openapi_tags=OPENAPI_TAGS,
            contact={
                "name": "HomelabCmd",
                "url": "https://github.com/DarrenBenson/HomelabCmd",
            },
            license_info={
                "name": "MIT",
                "identifier": "MIT",
            },
            servers=[
                {"url": "/", "description": "Current server"},
            ],
            docs_url="/api/docs",
            redoc_url="/api/redoc",
            openapi_url="/api/openapi.json",
            lifespan=test_lifespan,
        )
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        app.include_router(system.router, prefix="/api/v1")
        app.include_router(servers.router, prefix="/api/v1")
        app.include_router(agents.router, prefix="/api/v1")
        app.include_router(agent_register.router, prefix="/api/v1")
        app.include_router(metrics.router, prefix="/api/v1")
        app.include_router(config.router, prefix="/api/v1")
        app.include_router(alerts.router, prefix="/api/v1")
        app.include_router(services.router, prefix="/api/v1")
        app.include_router(actions.router, prefix="/api/v1")
        app.include_router(costs.router, prefix="/api/v1")
        app.include_router(scan.router, prefix="/api/v1")
        app.include_router(discovery.router, prefix="/api/v1")
        app.include_router(discovery.settings_router, prefix="/api/v1")
        app.include_router(tailscale.router, prefix="/api/v1")
        app.include_router(tailscale.devices_router, prefix="/api/v1")
        # US0093: ssh_settings router removed - SSH key management now in scan.router
        app.include_router(connectivity_settings.router, prefix="/api/v1")
        # US0131: Card Order Persistence
        app.include_router(preferences.router, prefix="/api/v1")
        # US0173: Widget Layout Persistence
        app.include_router(widget_layout.router, prefix="/api/v1")
        return app

    test_app = create_test_app()
    with TestClient(test_app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers(api_key: str) -> dict[str, str]:
    """Return headers with valid API key."""
    return {"X-API-Key": api_key}


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session with in-memory SQLite.

    This fixture:
    1. Creates an in-memory async SQLite engine
    2. Creates all tables from the models
    3. Provides an async session for tests
    4. Cleans up after tests
    """
    from sqlalchemy import event

    from homelab_cmd.db import models  # noqa: F401 - Import to register models
    from homelab_cmd.db.base import Base

    # Create async in-memory engine
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
    )

    # Enable foreign key enforcement for SQLite
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session factory
    async_session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Provide session to tests
    async with async_session_factory() as session:
        yield session

    # Cleanup
    await engine.dispose()


# Factory fixtures for reducing test duplication


@pytest.fixture
def create_server():
    """Factory fixture to create servers for tests."""

    def _create(
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
        **kwargs,
    ):
        """Create a server with the given ID.

        Args:
            client: TestClient instance
            auth_headers: Authentication headers
            server_id: Server identifier
            **kwargs: Additional server attributes

        Returns:
            Response from the server creation request.
        """
        data = {
            "id": server_id,
            "hostname": kwargs.get("hostname", f"{server_id}.local"),
            "display_name": kwargs.get("display_name", f"Test Server {server_id}"),
            **kwargs,
        }
        return client.post("/api/v1/servers", json=data, headers=auth_headers)

    return _create


@pytest.fixture
def send_heartbeat():
    """Factory fixture to send heartbeats for tests."""

    def _send(
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
        metrics: dict | None = None,
        **kwargs,
    ):
        """Send a heartbeat for the given server.

        Args:
            client: TestClient instance
            auth_headers: Authentication headers
            server_id: Server identifier
            metrics: Optional metrics dict with cpu_percent, memory_percent, disk_percent
            **kwargs: Additional heartbeat attributes

        Returns:
            Response from the heartbeat request.
        """
        data = {
            "server_id": server_id,
            "hostname": kwargs.get("hostname", f"{server_id}.local"),
            "timestamp": kwargs.get("timestamp", datetime.now(UTC).isoformat()),
            **kwargs,
        }
        if metrics:
            data["metrics"] = metrics
        return client.post("/api/v1/agents/heartbeat", json=data, headers=auth_headers)

    return _send


@pytest.fixture
def create_server_with_heartbeat(create_server, send_heartbeat):
    """Factory fixture to create a server and send an initial heartbeat."""

    def _create(
        client: TestClient,
        auth_headers: dict[str, str],
        server_id: str,
        metrics: dict | None = None,
        **kwargs,
    ):
        """Create a server and send an initial heartbeat.

        Args:
            client: TestClient instance
            auth_headers: Authentication headers
            server_id: Server identifier
            metrics: Optional metrics dict
            **kwargs: Additional server/heartbeat attributes

        Returns:
            Tuple of (server_response, heartbeat_response).
        """
        server_response = create_server(client, auth_headers, server_id, **kwargs)
        heartbeat_response = send_heartbeat(
            client, auth_headers, server_id, metrics=metrics, **kwargs
        )
        return server_response, heartbeat_response

    return _create


# =============================================================================
# SSH Service Mock Fixtures
# =============================================================================


@pytest.fixture
def mock_ssh_client():
    """Mock paramiko.SSHClient for SSH connection tests."""
    with patch("homelab_cmd.services.ssh.paramiko.SSHClient") as mock:
        client = MagicMock()
        client.connect = MagicMock()
        client.exec_command = MagicMock()
        client.close = MagicMock()
        client.set_missing_host_key_policy = MagicMock()
        mock.return_value = client
        yield client


@pytest.fixture
def mock_ssh_settings(tmp_path):
    """Mock SSH settings with a temporary key path."""
    with patch("homelab_cmd.services.ssh.get_settings") as mock:
        settings = MagicMock()
        settings.ssh_key_path = str(tmp_path / "ssh-keys")
        settings.ssh_default_port = 22
        settings.ssh_default_username = "root"
        settings.ssh_connection_timeout = 10
        mock.return_value = settings
        yield settings
