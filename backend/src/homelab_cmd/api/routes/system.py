"""System endpoints including health check."""

from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

from homelab_cmd.config import get_settings
from homelab_cmd.db.session import check_database_connection

router = APIRouter(prefix="/system", tags=["System"])

# Track application start time (set by main.py lifespan)
_start_time: datetime | None = None


def set_start_time(start: datetime) -> None:
    """Set the application start time (called during startup)."""
    global _start_time
    _start_time = start


def get_uptime_seconds() -> int:
    """Get the application uptime in seconds."""
    if _start_time is None:
        return 0
    delta = datetime.now(UTC) - _start_time
    return int(delta.total_seconds())


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str = Field(..., description="Overall health status (healthy or degraded)")
    version: str = Field(..., description="API version string")
    uptime_seconds: int = Field(..., description="Application uptime in seconds")
    database: str = Field(..., description="Database connection status")
    timestamp: str = Field(..., description="Current server timestamp (ISO8601)")


@router.get(
    "/health",
    response_model=HealthResponse,
    operation_id="get_health",
    summary="Health check",
)
async def health_check() -> HealthResponse:
    """Health check endpoint (no authentication required).

    Returns the current health status of the application including
    version, uptime, and database connectivity status.

    This endpoint is used by Docker health checks and monitoring systems.
    """
    settings = get_settings()

    # Check actual database connectivity
    db_connected = await check_database_connection()
    database_status = "connected" if db_connected else "disconnected"
    overall_status = "healthy" if db_connected else "degraded"

    return HealthResponse(
        status=overall_status,
        version=settings.api_version,
        uptime_seconds=get_uptime_seconds(),
        database=database_status,
        timestamp=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
