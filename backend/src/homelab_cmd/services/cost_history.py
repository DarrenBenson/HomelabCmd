"""Cost history service for historical cost tracking.

US0183: Historical Cost Tracking (EP0005)

Provides methods for:
- Capturing daily cost snapshots for servers
- Retrieving cost history with aggregation (daily/weekly/monthly)
- Monthly summary with year-to-date totals
- Per-server cost history
- Rolling up old daily data to monthly aggregates
"""

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.routes.config import DEFAULT_COST, get_config_value
from homelab_cmd.api.schemas.config import CostConfig
from homelab_cmd.db.models.cost_snapshot import CostSnapshot, CostSnapshotMonthly
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.models.uptime import ServerUptimeDaily
from homelab_cmd.services.power import (
    calculate_daily_kwh,
    calculate_power_watts,
    calculate_workstation_cost,
    get_power_config,
)

logger = logging.getLogger(__name__)

# Retention period: 2 years of daily data
DAILY_RETENTION_DAYS = 730

# Default CPU percentage when no metrics available
DEFAULT_CPU_PERCENT = 50.0


@dataclass
class CostHistoryItem:
    """A single cost history record."""

    date: str
    estimated_kwh: float
    estimated_cost: float
    electricity_rate: float
    server_id: str | None = None
    server_hostname: str | None = None


@dataclass
class MonthlySummaryItem:
    """Monthly cost summary record."""

    year_month: str
    total_cost: float
    total_kwh: float
    previous_month_cost: float | None
    change_percent: float | None


@dataclass
class MonthlySummaryResult:
    """Result from get_monthly_summary."""

    year: int
    year_to_date_cost: float
    months: list[MonthlySummaryItem]


@dataclass
class ServerCostHistoryResult:
    """Result from get_server_history."""

    server_id: str
    hostname: str
    period: str
    items: list[CostHistoryItem]


class CostHistoryService:
    """Service for historical cost tracking operations."""

    def __init__(self, session: AsyncSession):
        """Initialise the cost history service.

        Args:
            session: Database session for queries.
        """
        self.session = session

    async def _get_electricity_rate(self) -> float:
        """Get the current electricity rate from configuration."""
        cost_data = await get_config_value(self.session, "cost")
        if cost_data:
            cost_config = CostConfig(**cost_data)
            return cost_config.electricity_rate
        return DEFAULT_COST.electricity_rate

    async def _get_avg_cpu_24h(self, server_id: str) -> float | None:
        """Get average CPU usage for a server over the last 24 hours."""
        from homelab_cmd.db.models.metrics import Metrics

        since = datetime.now(UTC) - timedelta(hours=24)

        result = await self.session.execute(
            select(func.avg(Metrics.cpu_percent))
            .where(Metrics.server_id == server_id)
            .where(Metrics.timestamp >= since)
            .where(Metrics.cpu_percent.isnot(None))
        )
        avg = result.scalar_one_or_none()
        return round(avg, 1) if avg is not None else None

    async def _get_uptime_hours_yesterday(self, server_id: str) -> float:
        """Get uptime hours for yesterday (for workstation cost calculation)."""
        yesterday = date.today() - timedelta(days=1)

        result = await self.session.execute(
            select(ServerUptimeDaily.uptime_hours)
            .where(ServerUptimeDaily.server_id == server_id)
            .where(ServerUptimeDaily.date == yesterday)
        )
        hours = result.scalar_one_or_none()
        return hours or 0.0

    async def capture_daily_snapshot(self, server_id: str) -> CostSnapshot | None:
        """Capture a daily cost snapshot for a single server.

        AC1: Daily cost snapshot with required fields.

        Args:
            server_id: The server ID to capture snapshot for.

        Returns:
            The created/updated CostSnapshot, or None if server not found.
        """
        # Get server
        result = await self.session.execute(select(Server).where(Server.id == server_id))
        server = result.scalar_one_or_none()

        if not server:
            logger.warning("Server %s not found for cost snapshot", server_id)
            return None

        # Get electricity rate
        rate = await self._get_electricity_rate()

        # Determine machine type
        is_workstation = server.machine_type == "workstation"
        machine_type = "workstation" if is_workstation else "server"

        # Get power configuration
        power_config = get_power_config(
            server.machine_category,
            server.machine_category_source,
            server.idle_watts,
            server.tdp_watts,
        )

        # Calculate cost based on server status and configuration
        estimated_kwh = 0.0
        estimated_cost = 0.0
        tdp_watts = None
        idle_watts = None
        avg_cpu = None
        hours_used = None

        # Only calculate cost for online servers with power config
        if server.status == ServerStatus.OFFLINE.value:
            # Server offline - zero cost
            pass
        elif power_config:
            tdp_watts = power_config.max_watts
            idle_watts = power_config.idle_watts

            if is_workstation:
                # Workstation: use actual hours
                hours_used = await self._get_uptime_hours_yesterday(server_id)
                # Cost = (TDP * hours * rate) / 1000
                estimated_kwh = (power_config.max_watts * hours_used) / 1000
                estimated_cost = calculate_workstation_cost(power_config.max_watts, hours_used, rate)
            else:
                # Server: 24/7 operation with CPU-based power estimate
                avg_cpu = await self._get_avg_cpu_24h(server_id)
                cpu_percent = avg_cpu if avg_cpu is not None else DEFAULT_CPU_PERCENT

                estimated_watts = calculate_power_watts(
                    power_config.idle_watts, power_config.max_watts, cpu_percent
                )
                estimated_kwh = calculate_daily_kwh(estimated_watts)
                estimated_cost = round(estimated_kwh * rate, 2)
        elif server.tdp_watts is not None:
            # Fallback: TDP-only mode
            tdp_watts = server.tdp_watts

            if is_workstation:
                hours_used = await self._get_uptime_hours_yesterday(server_id)
                estimated_kwh = (server.tdp_watts * hours_used) / 1000
                estimated_cost = calculate_workstation_cost(server.tdp_watts, hours_used, rate)
            else:
                estimated_kwh = calculate_daily_kwh(server.tdp_watts)
                estimated_cost = round(estimated_kwh * rate, 2)

        # Upsert snapshot (one per server per day)
        today = date.today()
        stmt = sqlite_insert(CostSnapshot).values(
            server_id=server_id,
            date=today,
            estimated_kwh=estimated_kwh,
            estimated_cost=estimated_cost,
            electricity_rate=rate,
            tdp_watts=tdp_watts,
            idle_watts=idle_watts,
            avg_cpu_percent=avg_cpu,
            machine_type=machine_type,
            hours_used=hours_used,
        )

        # On conflict, update the values
        stmt = stmt.on_conflict_do_update(
            index_elements=["server_id", "date"],
            set_={
                "estimated_kwh": estimated_kwh,
                "estimated_cost": estimated_cost,
                "electricity_rate": rate,
                "tdp_watts": tdp_watts,
                "idle_watts": idle_watts,
                "avg_cpu_percent": avg_cpu,
                "machine_type": machine_type,
                "hours_used": hours_used,
            },
        )

        await self.session.execute(stmt)
        await self.session.commit()

        # Fetch and return the snapshot
        result = await self.session.execute(
            select(CostSnapshot)
            .where(CostSnapshot.server_id == server_id)
            .where(CostSnapshot.date == today)
        )
        return result.scalar_one_or_none()

    async def capture_all_snapshots(self) -> int:
        """Capture daily cost snapshots for all servers.

        AC1: Capture snapshots for all servers at midnight UTC.

        Returns:
            Number of snapshots captured.
        """
        result = await self.session.execute(select(Server.id))
        server_ids = [row[0] for row in result.fetchall()]

        count = 0
        for server_id in server_ids:
            snapshot = await self.capture_daily_snapshot(server_id)
            if snapshot:
                count += 1

        logger.info("Captured %d cost snapshots", count)
        return count

    async def get_history(
        self,
        start_date: date,
        end_date: date,
        server_id: str | None = None,
        aggregation: str = "daily",
    ) -> list[CostHistoryItem]:
        """Get cost history with optional aggregation.

        AC2: Historical cost API with date range, server filter, and aggregation.

        Args:
            start_date: Start of date range (inclusive).
            end_date: End of date range (inclusive).
            server_id: Optional server ID to filter by.
            aggregation: 'daily', 'weekly', or 'monthly'.

        Returns:
            List of cost history items.
        """
        if aggregation == "daily":
            return await self._get_history_daily(start_date, end_date, server_id)
        elif aggregation == "weekly":
            return await self._get_history_weekly(start_date, end_date, server_id)
        elif aggregation == "monthly":
            return await self._get_history_monthly(start_date, end_date, server_id)
        else:
            raise ValueError(f"Invalid aggregation: {aggregation}")

    async def _get_history_daily(
        self, start_date: date, end_date: date, server_id: str | None
    ) -> list[CostHistoryItem]:
        """Get daily cost history."""
        query = (
            select(
                CostSnapshot.date,
                func.sum(CostSnapshot.estimated_kwh).label("total_kwh"),
                func.sum(CostSnapshot.estimated_cost).label("total_cost"),
                func.avg(CostSnapshot.electricity_rate).label("avg_rate"),
            )
            .where(CostSnapshot.date >= start_date)
            .where(CostSnapshot.date <= end_date)
        )

        if server_id:
            query = query.where(CostSnapshot.server_id == server_id)

        query = query.group_by(CostSnapshot.date).order_by(CostSnapshot.date)

        result = await self.session.execute(query)
        rows = result.fetchall()

        return [
            CostHistoryItem(
                date=row.date.isoformat(),
                estimated_kwh=round(row.total_kwh, 3),
                estimated_cost=round(row.total_cost, 2),
                electricity_rate=round(row.avg_rate, 4),
                server_id=server_id,
            )
            for row in rows
        ]

    async def _get_history_weekly(
        self, start_date: date, end_date: date, server_id: str | None
    ) -> list[CostHistoryItem]:
        """Get weekly aggregated cost history."""
        # SQLite: strftime to get ISO week
        week_expr = func.strftime("%Y-W%W", CostSnapshot.date)

        query = (
            select(
                week_expr.label("week"),
                func.sum(CostSnapshot.estimated_kwh).label("total_kwh"),
                func.sum(CostSnapshot.estimated_cost).label("total_cost"),
                func.avg(CostSnapshot.electricity_rate).label("avg_rate"),
            )
            .where(CostSnapshot.date >= start_date)
            .where(CostSnapshot.date <= end_date)
        )

        if server_id:
            query = query.where(CostSnapshot.server_id == server_id)

        query = query.group_by(week_expr).order_by(week_expr)

        result = await self.session.execute(query)
        rows = result.fetchall()

        return [
            CostHistoryItem(
                date=row.week,
                estimated_kwh=round(row.total_kwh, 3),
                estimated_cost=round(row.total_cost, 2),
                electricity_rate=round(row.avg_rate, 4),
                server_id=server_id,
            )
            for row in rows
        ]

    async def _get_history_monthly(
        self, start_date: date, end_date: date, server_id: str | None
    ) -> list[CostHistoryItem]:
        """Get monthly aggregated cost history."""
        # SQLite: strftime to get year-month
        month_expr = func.strftime("%Y-%m", CostSnapshot.date)

        query = (
            select(
                month_expr.label("month"),
                func.sum(CostSnapshot.estimated_kwh).label("total_kwh"),
                func.sum(CostSnapshot.estimated_cost).label("total_cost"),
                func.avg(CostSnapshot.electricity_rate).label("avg_rate"),
            )
            .where(CostSnapshot.date >= start_date)
            .where(CostSnapshot.date <= end_date)
        )

        if server_id:
            query = query.where(CostSnapshot.server_id == server_id)

        query = query.group_by(month_expr).order_by(month_expr)

        result = await self.session.execute(query)
        rows = result.fetchall()

        return [
            CostHistoryItem(
                date=row.month,
                estimated_kwh=round(row.total_kwh, 3),
                estimated_cost=round(row.total_cost, 2),
                electricity_rate=round(row.avg_rate, 4),
                server_id=server_id,
            )
            for row in rows
        ]

    async def get_monthly_summary(self, year: int) -> MonthlySummaryResult:
        """Get monthly cost summary for a year.

        AC5: Monthly cost summary with month-over-month change and YTD.

        Args:
            year: The year to get summary for.

        Returns:
            Monthly summary with year-to-date total.
        """
        # Query monthly totals for the year
        month_expr = func.strftime("%Y-%m", CostSnapshot.date)
        year_expr = func.strftime("%Y", CostSnapshot.date)

        query = (
            select(
                month_expr.label("month"),
                func.sum(CostSnapshot.estimated_kwh).label("total_kwh"),
                func.sum(CostSnapshot.estimated_cost).label("total_cost"),
            )
            .where(year_expr == str(year))
            .group_by(month_expr)
            .order_by(month_expr)
        )

        result = await self.session.execute(query)
        rows = result.fetchall()

        # Build monthly items with change percentages
        months: list[MonthlySummaryItem] = []
        previous_cost: float | None = None
        year_to_date = 0.0

        for row in rows:
            total_cost = round(row.total_cost, 2)
            year_to_date += total_cost

            # Calculate change percentage
            change_percent = None
            if previous_cost is not None and previous_cost > 0:
                change_percent = round(((total_cost - previous_cost) / previous_cost) * 100, 1)

            months.append(
                MonthlySummaryItem(
                    year_month=row.month,
                    total_cost=total_cost,
                    total_kwh=round(row.total_kwh, 3),
                    previous_month_cost=previous_cost,
                    change_percent=change_percent,
                )
            )

            previous_cost = total_cost

        return MonthlySummaryResult(
            year=year,
            year_to_date_cost=round(year_to_date, 2),
            months=months,
        )

    async def get_server_history(
        self, server_id: str, period: str = "30d"
    ) -> ServerCostHistoryResult | None:
        """Get cost history for a specific server.

        AC4: Per-server cost history.

        Args:
            server_id: The server ID.
            period: '7d', '30d', '90d', or '12m'.

        Returns:
            Server cost history result, or None if server not found.
        """
        # Get server
        result = await self.session.execute(select(Server).where(Server.id == server_id))
        server = result.scalar_one_or_none()

        if not server:
            return None

        # Calculate date range based on period
        today = date.today()
        if period == "7d":
            start_date = today - timedelta(days=7)
        elif period == "30d":
            start_date = today - timedelta(days=30)
        elif period == "90d":
            start_date = today - timedelta(days=90)
        elif period == "12m":
            start_date = today - timedelta(days=365)
        else:
            raise ValueError(f"Invalid period: {period}")

        # Query cost snapshots
        query = (
            select(CostSnapshot)
            .where(CostSnapshot.server_id == server_id)
            .where(CostSnapshot.date >= start_date)
            .where(CostSnapshot.date <= today)
            .order_by(CostSnapshot.date)
        )

        result = await self.session.execute(query)
        snapshots = result.scalars().all()

        items = [
            CostHistoryItem(
                date=snapshot.date.isoformat(),
                estimated_kwh=snapshot.estimated_kwh,
                estimated_cost=snapshot.estimated_cost,
                electricity_rate=snapshot.electricity_rate,
                server_id=server_id,
                server_hostname=server.hostname,
            )
            for snapshot in snapshots
        ]

        return ServerCostHistoryResult(
            server_id=server_id,
            hostname=server.hostname,
            period=period,
            items=items,
        )

    async def rollup_old_data(self) -> dict[str, int]:
        """Roll up old daily data to monthly aggregates.

        AC6: Data retention - daily data older than 2 years rolled up.

        Returns:
            Dictionary with counts: {'daily_deleted': N, 'monthly_created': N}
        """
        cutoff = date.today() - timedelta(days=DAILY_RETENTION_DAYS)

        # Query daily snapshots older than cutoff, grouped by server and month
        month_expr = func.strftime("%Y-%m", CostSnapshot.date)

        query = (
            select(
                CostSnapshot.server_id,
                month_expr.label("year_month"),
                func.sum(CostSnapshot.estimated_kwh).label("total_kwh"),
                func.sum(CostSnapshot.estimated_cost).label("total_cost"),
                func.avg(CostSnapshot.electricity_rate).label("avg_rate"),
                func.count().label("snapshot_count"),
            )
            .where(CostSnapshot.date < cutoff)
            .group_by(CostSnapshot.server_id, month_expr)
        )

        result = await self.session.execute(query)
        aggregates = result.fetchall()

        if not aggregates:
            logger.debug("No old cost snapshots to roll up")
            return {"daily_deleted": 0, "monthly_created": 0}

        monthly_created = 0
        for row in aggregates:
            # Upsert monthly aggregate
            stmt = sqlite_insert(CostSnapshotMonthly).values(
                server_id=row.server_id,
                year_month=row.year_month,
                total_kwh=row.total_kwh,
                total_cost=row.total_cost,
                avg_electricity_rate=row.avg_rate,
                snapshot_count=row.snapshot_count,
            )

            # On conflict, add to existing values
            stmt = stmt.on_conflict_do_update(
                index_elements=["server_id", "year_month"],
                set_={
                    "total_kwh": CostSnapshotMonthly.total_kwh + row.total_kwh,
                    "total_cost": CostSnapshotMonthly.total_cost + row.total_cost,
                    "snapshot_count": CostSnapshotMonthly.snapshot_count + row.snapshot_count,
                },
            )

            await self.session.execute(stmt)
            monthly_created += 1

        # Delete old daily snapshots
        delete_result = await self.session.execute(
            delete(CostSnapshot).where(CostSnapshot.date < cutoff)
        )
        daily_deleted = delete_result.rowcount

        await self.session.commit()

        logger.info(
            "Cost snapshot rollup: %d monthly aggregates created/updated, %d daily records deleted",
            monthly_created,
            daily_deleted,
        )

        return {"daily_deleted": daily_deleted, "monthly_created": monthly_created}
