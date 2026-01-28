"""FastAPI application factory and entry point for HomelabCmd."""

import logging
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import uvicorn
from apscheduler import AsyncScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from cryptography.fernet import Fernet
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from homelab_cmd import __version__
from homelab_cmd.api.routes import (
    actions,
    agent_deploy,
    agent_register,
    agents,
    alerts,
    config,
    connectivity_settings,
    costs,
    discovery,
    metrics,
    scan,
    servers,
    services,
    ssh_settings,
    system,
    tailscale,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db import dispose_engine, init_database
from homelab_cmd.services.scheduler import (
    STALE_CHECK_INTERVAL_SECONDS,
    check_stale_servers,
    prune_old_metrics,
    run_metrics_rollup,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _validate_encryption_key() -> None:
    """Validate encryption key is present and valid at startup.

    Raises:
        RuntimeError: If key is missing or invalid format.
    """
    settings = get_settings()

    if not settings.encryption_key:
        raise RuntimeError(
            "HOMELABCMD_ENCRYPTION_KEY environment variable is required. "
            "Generate one with: python -m homelab_cmd.cli generate-key"
        )

    try:
        Fernet(settings.encryption_key.encode())
    except Exception as e:
        raise RuntimeError(
            "Invalid encryption key format. "
            "Key must be 32 url-safe base64-encoded bytes. "
            "Generate a new key with: python -m homelab_cmd.cli generate-key"
        ) from e


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup and shutdown."""
    # Startup
    logger.info("Starting HomelabCmd v%s", __version__)
    system.set_start_time(datetime.now(UTC))

    # Trigger settings load and dev key warning
    get_settings()

    # Validate encryption key (EP0008: Tailscale Integration)
    # Skip validation if running in test mode (no encryption key needed for most tests)
    if os.environ.get("HOMELAB_CMD_TESTING") != "true":
        _validate_encryption_key()
        logger.info("Encryption key validated")

    # Initialise database
    await init_database()
    logger.info("Database initialised")

    # US0093: Migrate any existing Tailscale SSH key to unified storage
    from homelab_cmd.db.session import get_session_factory
    from homelab_cmd.services.ssh import migrate_tailscale_ssh_key

    try:
        session_factory = get_session_factory()
        async with session_factory() as session:
            if await migrate_tailscale_ssh_key(session):
                logger.info("SSH key migration completed")
    except Exception as e:
        logger.warning("SSH key migration failed (non-fatal): %s", e)

    # Start background scheduler for status detection and data retention
    async with AsyncScheduler() as scheduler:
        # Stale server detection (every 60 seconds)
        await scheduler.add_schedule(
            check_stale_servers,
            IntervalTrigger(seconds=STALE_CHECK_INTERVAL_SECONDS),
            id="check_stale_servers",
        )

        # Data pruning (daily at midnight UTC)
        await scheduler.add_schedule(
            prune_old_metrics,
            CronTrigger(hour=0, minute=0),
            id="prune_old_metrics",
        )

        # Tiered metrics rollup (daily at 01:00 UTC, after prune)
        await scheduler.add_schedule(
            run_metrics_rollup,
            CronTrigger(hour=1, minute=0),
            id="run_metrics_rollup",
        )

        await scheduler.start_in_background()
        logger.info("Background scheduler started with 3 jobs")

        yield

        # Scheduler auto-stops when exiting async context
        logger.info("Background scheduler stopping")

    # Shutdown
    await dispose_engine()
    logger.info("Shutting down HomelabCmd")


# OpenAPI tag metadata with descriptions
OPENAPI_TAGS = [
    {
        "name": "System",
        "description": "System health and status. No authentication required.",
    },
    {
        "name": "Servers",
        "description": "Server registration, configuration, and lifecycle management.",
    },
    {
        "name": "Agents",
        "description": "Agent heartbeat and metrics ingestion.",
    },
    {
        "name": "Agent Deployment",
        "description": "Remote agent installation, upgrade, and removal.",
    },
    {
        "name": "Agent Registration",
        "description": "Pull-based agent installation with per-agent tokens.",
    },
    {
        "name": "Metrics",
        "description": "Historical metrics and time-series data.",
    },
    {
        "name": "Configuration",
        "description": "System settings, thresholds, and notifications.",
    },
    {
        "name": "Alerts",
        "description": "Alert viewing, acknowledgement, and resolution.",
    },
    {
        "name": "Actions",
        "description": "Remediation action queue and lifecycle management.",
    },
    {
        "name": "Costs",
        "description": "Electricity cost estimation and tracking.",
    },
    {
        "name": "Scanning",
        "description": "Ad-hoc SSH scanning of transient devices.",
    },
    {
        "name": "Discovery",
        "description": "Network device discovery via TCP port 22 scanning.",
    },
    {
        "name": "Tailscale",
        "description": "Tailscale API integration for device discovery.",
    },
]


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
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
        lifespan=lifespan,
    )

    # CORS middleware - permissive for LAN deployment
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount system routes (health check - no auth required)
    app.include_router(system.router, prefix="/api/v1")

    # Mount server routes (auth required)
    app.include_router(servers.router, prefix="/api/v1")

    # Mount agent routes (auth required)
    app.include_router(agents.router, prefix="/api/v1")

    # Mount agent deployment routes (auth required) - EP0007
    app.include_router(agent_deploy.router, prefix="/api/v1")

    # Mount agent registration routes (mixed auth) - Secure Agent Architecture
    app.include_router(agent_register.router, prefix="/api/v1")

    # Mount metrics routes (auth required)
    app.include_router(metrics.router, prefix="/api/v1")

    # Mount config routes (auth required)
    app.include_router(config.router, prefix="/api/v1")

    # Mount Tailscale settings routes (auth required) - EP0008: Tailscale Integration
    app.include_router(tailscale.router, prefix="/api/v1")

    # Mount Tailscale device discovery routes (auth required) - US0077
    app.include_router(tailscale.devices_router, prefix="/api/v1")

    # Mount SSH settings routes (auth required) - US0079: SSH Connection via Tailscale
    app.include_router(ssh_settings.router, prefix="/api/v1")

    # Mount connectivity settings routes (auth required) - US0080: Connectivity Mode Management
    app.include_router(connectivity_settings.router, prefix="/api/v1")

    # Mount alerts routes (auth required)
    app.include_router(alerts.router, prefix="/api/v1")

    # Mount services routes (auth required)
    app.include_router(services.router, prefix="/api/v1")

    # Mount actions routes (auth required)
    app.include_router(actions.router, prefix="/api/v1")

    # Mount costs routes (auth required)
    app.include_router(costs.router, prefix="/api/v1")

    # Mount scan routes (auth required) - EP0006: Ad-hoc Scanning
    app.include_router(scan.router, prefix="/api/v1")

    # Mount discovery routes (auth required) - US0041: Network Discovery
    app.include_router(discovery.router, prefix="/api/v1")
    app.include_router(discovery.settings_router, prefix="/api/v1")

    return app


# Create the application instance
app = create_app()


def run() -> None:
    """Run the application using uvicorn."""
    settings = get_settings()
    uvicorn.run(
        "homelab_cmd.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    run()
