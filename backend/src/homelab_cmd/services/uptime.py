"""Uptime tracking service for workstation cost calculation.

US0092: Workstation Cost Tracking

Tracks actual uptime from heartbeat data and provides period-based
uptime aggregation for cost calculations.
"""

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.uptime import ServerUptimeDaily


async def update_server_uptime(
    session: AsyncSession,
    server_id: str,
    uptime_seconds: int,
    current_time: datetime,
) -> None:
    """Update daily uptime tracking from heartbeat.

    Called during heartbeat processing to record the server's uptime.
    The uptime_seconds from the agent represents how long the system has
    been running since boot.

    Args:
        session: Database session
        server_id: Server identifier
        uptime_seconds: System uptime in seconds (from agent heartbeat)
        current_time: Current timestamp
    """
    today = current_time.date()

    # Convert seconds to hours, cap at 24 hours per day
    uptime_hours = uptime_seconds / 3600
    uptime_hours = min(uptime_hours, 24.0)

    # Upsert: insert or update the daily record
    # Using SQLite's INSERT OR REPLACE via dialect-specific insert
    stmt = sqlite_insert(ServerUptimeDaily).values(
        server_id=server_id,
        date=today,
        uptime_hours=uptime_hours,
        last_updated=current_time,
    )

    # On conflict, update the uptime_hours and last_updated
    stmt = stmt.on_conflict_do_update(
        index_elements=["server_id", "date"],
        set_={
            "uptime_hours": uptime_hours,
            "last_updated": current_time,
        },
    )

    await session.execute(stmt)
    await session.commit()


async def get_uptime_for_period(
    session: AsyncSession,
    server_id: str,
    start_date: date,
    end_date: date,
) -> float:
    """Get total uptime hours for a server within a date range.

    Args:
        session: Database session
        server_id: Server identifier
        start_date: Start of date range (inclusive)
        end_date: End of date range (inclusive)

    Returns:
        Total uptime hours in the period, or 0.0 if no records.
    """
    result = await session.execute(
        select(func.sum(ServerUptimeDaily.uptime_hours))
        .where(ServerUptimeDaily.server_id == server_id)
        .where(ServerUptimeDaily.date >= start_date)
        .where(ServerUptimeDaily.date <= end_date)
    )
    total = result.scalar_one_or_none()
    return total or 0.0


async def get_all_uptime_for_period(
    session: AsyncSession,
    start_date: date,
    end_date: date,
) -> dict[str, float]:
    """Get total uptime hours for all servers within a date range.

    Args:
        session: Database session
        start_date: Start of date range (inclusive)
        end_date: End of date range (inclusive)

    Returns:
        Dictionary mapping server_id to total uptime hours.
    """
    result = await session.execute(
        select(
            ServerUptimeDaily.server_id,
            func.sum(ServerUptimeDaily.uptime_hours).label("total_hours"),
        )
        .where(ServerUptimeDaily.date >= start_date)
        .where(ServerUptimeDaily.date <= end_date)
        .group_by(ServerUptimeDaily.server_id)
    )

    return {row.server_id: row.total_hours or 0.0 for row in result}
