"""Background scheduler for server status detection, data retention, and alerting.

This module provides scheduled jobs for:
- Detecting stale servers and marking them offline (US0008)
- Triggering offline alerts with cooldown-aware re-notifications (US0011, US0012)
- Pruning old metrics data beyond retention period (US0009)
- Tiered data retention with rollup (US0046)
"""

import logging
import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select

from homelab_cmd.api.schemas.config import NotificationsConfig
from homelab_cmd.db.models.metrics import Metrics, MetricsDaily, MetricsHourly
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.session import get_session_factory
from homelab_cmd.services.alerting import AlertingService
from homelab_cmd.services.notifier import get_notifier

logger = logging.getLogger(__name__)

# Configuration constants
OFFLINE_THRESHOLD_SECONDS = 180  # 3 missed heartbeats (60s each)
STALE_CHECK_INTERVAL_SECONDS = 60  # Run check every 60 seconds
PRUNE_BATCH_SIZE = 10000  # Max records to delete per batch

# Tiered retention periods (US0046)
RAW_RETENTION_DAYS = 7  # Keep raw data for 7 days
HOURLY_RETENTION_DAYS = 90  # Keep hourly aggregates for 90 days
DAILY_RETENTION_DAYS = 365  # Keep daily aggregates for 12 months

# Legacy constant for backward compatibility
RETENTION_DAYS = RAW_RETENTION_DAYS


async def check_stale_servers(
    notifications_config: NotificationsConfig | None = None,
) -> int:
    """Check for and mark stale servers as offline.

    Servers that have not sent a heartbeat within OFFLINE_THRESHOLD_SECONDS
    are marked as offline. If a notifications config is provided, offline
    alerts will be triggered.

    Args:
        notifications_config: Optional notification settings for alerting

    Returns:
        Number of servers marked offline.
    """
    stale_threshold = datetime.now(UTC) - timedelta(seconds=OFFLINE_THRESHOLD_SECONDS)

    session_factory = get_session_factory()
    async with session_factory() as session:
        # Find online servers with last_seen older than threshold
        # Also filter out servers with None last_seen (never sent heartbeat)
        # Skip inactive servers (BG0011) - they have no agent, so offline is expected
        result = await session.execute(
            select(Server)
            .where(Server.status == ServerStatus.ONLINE.value)
            .where(Server.last_seen.isnot(None))
            .where(Server.last_seen < stale_threshold)
            .where(Server.is_inactive.is_(False))
        )
        stale_servers = result.scalars().all()

        count = 0
        alerting_service = AlertingService(session)
        notifier = None

        if notifications_config and notifications_config.slack_webhook_url:
            notifier = get_notifier(notifications_config.slack_webhook_url)

        for server in stale_servers:
            server.status = ServerStatus.OFFLINE.value
            count += 1

            # Skip offline alerts for workstations (EP0009: US0089)
            if server.machine_type == "workstation":
                logger.info(
                    "Workstation %s marked offline (last seen: %s) - no alert generated",
                    server.id,
                    server.last_seen,
                )
                continue

            logger.info(
                "Server %s marked offline (last seen: %s)",
                server.id,
                server.last_seen,
            )

            # Trigger offline alert (servers only)
            if notifications_config:
                event = await alerting_service.trigger_offline_alert(
                    server_id=server.id,
                    server_name=server.display_name or server.hostname,
                    cooldowns=notifications_config.cooldowns,
                )

                if event and notifier:
                    await notifier.send_alert(event, notifications_config)

        await session.commit()

    if count > 0:
        logger.info("Marked %d server(s) as offline", count)

    return count


async def check_offline_reminders(
    notifications_config: NotificationsConfig,
) -> int:
    """Check for offline servers that need reminder notifications.

    This function checks servers that are already offline and sends
    reminder notifications if the cooldown has expired.

    Args:
        notifications_config: Notification settings

    Returns:
        Number of reminders sent.
    """
    if not notifications_config.slack_webhook_url:
        return 0

    session_factory = get_session_factory()
    async with session_factory() as session:
        # Find servers that are offline (skip inactive servers - BG0011)
        result = await session.execute(
            select(Server)
            .where(Server.status == ServerStatus.OFFLINE.value)
            .where(Server.is_inactive.is_(False))
        )
        offline_servers = result.scalars().all()

        if not offline_servers:
            return 0

        alerting_service = AlertingService(session)
        notifier = get_notifier(notifications_config.slack_webhook_url)
        reminders_sent = 0

        for server in offline_servers:
            # Skip offline reminders for workstations (EP0009: US0089)
            if server.machine_type == "workstation":
                continue

            event = await alerting_service.trigger_offline_alert(
                server_id=server.id,
                server_name=server.display_name or server.hostname,
                cooldowns=notifications_config.cooldowns,
            )

            if event and event.is_reminder:
                await notifier.send_alert(event, notifications_config)
                reminders_sent += 1

        await session.commit()

    if reminders_sent > 0:
        logger.info("Sent %d offline reminder notification(s)", reminders_sent)

    return reminders_sent


async def prune_old_metrics() -> int:
    """Delete metrics older than retention period.

    Uses batch deletion to avoid long-running transactions that could
    block other database operations.

    Returns:
        Total number of metrics deleted.
    """
    retention_cutoff = datetime.now(UTC) - timedelta(days=RETENTION_DAYS)
    total_deleted = 0

    session_factory = get_session_factory()
    async with session_factory() as session:
        while True:
            # Find IDs to delete in this batch
            # SQLite doesn't support DELETE ... LIMIT, so we select IDs first
            result = await session.execute(
                select(Metrics.id)
                .where(Metrics.timestamp < retention_cutoff)
                .limit(PRUNE_BATCH_SIZE)
            )
            ids_to_delete = [row[0] for row in result.fetchall()]

            if not ids_to_delete:
                break

            # Delete the batch
            await session.execute(delete(Metrics).where(Metrics.id.in_(ids_to_delete)))
            await session.commit()

            batch_count = len(ids_to_delete)
            total_deleted += batch_count
            logger.info("Pruned batch of %d old metrics", batch_count)

            if batch_count < PRUNE_BATCH_SIZE:
                break

    if total_deleted > 0:
        logger.info(
            "Pruning complete: deleted %d metrics older than %d days",
            total_deleted,
            RETENTION_DAYS,
        )
    else:
        logger.debug("Pruning complete: no old metrics to delete")

    return total_deleted


# =============================================================================
# Tiered Data Retention Rollup Functions (US0046)
# =============================================================================


async def rollup_raw_to_hourly() -> tuple[int, int]:
    """Roll up raw metrics older than 7 days into hourly aggregates.

    Groups raw metrics by server_id and hour, calculating avg/min/max for
    CPU, memory, and disk percentages. Processed records are deleted after
    successful aggregation.

    Returns:
        Tuple of (aggregates_created, raw_records_deleted)
    """
    cutoff = datetime.now(UTC) - timedelta(days=RAW_RETENTION_DAYS)
    aggregates_created = 0
    records_deleted = 0

    session_factory = get_session_factory()
    async with session_factory() as session:
        # SQLite date truncation: strftime to get hour start
        # For production (PostgreSQL), use date_trunc('hour', timestamp)
        hour_expr = func.strftime("%Y-%m-%d %H:00:00", Metrics.timestamp)

        # Query to get aggregated data grouped by server and hour
        result = await session.execute(
            select(
                Metrics.server_id,
                hour_expr.label("hour_start"),
                func.avg(Metrics.cpu_percent).label("cpu_avg"),
                func.min(Metrics.cpu_percent).label("cpu_min"),
                func.max(Metrics.cpu_percent).label("cpu_max"),
                func.avg(Metrics.memory_percent).label("memory_avg"),
                func.min(Metrics.memory_percent).label("memory_min"),
                func.max(Metrics.memory_percent).label("memory_max"),
                func.avg(Metrics.disk_percent).label("disk_avg"),
                func.min(Metrics.disk_percent).label("disk_min"),
                func.max(Metrics.disk_percent).label("disk_max"),
                func.count().label("sample_count"),
            )
            .where(Metrics.timestamp < cutoff)
            .group_by(Metrics.server_id, hour_expr)
        )
        aggregates = result.fetchall()

        if not aggregates:
            logger.debug("No raw metrics to roll up to hourly")
            return 0, 0

        # Create hourly aggregate records
        for row in aggregates:
            hourly = MetricsHourly(
                server_id=row.server_id,
                timestamp=datetime.fromisoformat(row.hour_start).replace(tzinfo=UTC),
                cpu_avg=row.cpu_avg,
                cpu_min=row.cpu_min,
                cpu_max=row.cpu_max,
                memory_avg=row.memory_avg,
                memory_min=row.memory_min,
                memory_max=row.memory_max,
                disk_avg=row.disk_avg,
                disk_min=row.disk_min,
                disk_max=row.disk_max,
                sample_count=row.sample_count,
            )
            session.add(hourly)
            aggregates_created += 1

        # Delete processed raw records in batches
        while True:
            ids_result = await session.execute(
                select(Metrics.id).where(Metrics.timestamp < cutoff).limit(PRUNE_BATCH_SIZE)
            )
            ids_to_delete = [r[0] for r in ids_result.fetchall()]

            if not ids_to_delete:
                break

            await session.execute(delete(Metrics).where(Metrics.id.in_(ids_to_delete)))
            records_deleted += len(ids_to_delete)

            if len(ids_to_delete) < PRUNE_BATCH_SIZE:
                break

        await session.commit()

    logger.info(
        "Raw to hourly rollup: %d aggregates created, %d raw records deleted",
        aggregates_created,
        records_deleted,
    )
    return aggregates_created, records_deleted


async def rollup_hourly_to_daily() -> tuple[int, int]:
    """Roll up hourly metrics older than 90 days into daily aggregates.

    Groups hourly metrics by server_id and day, calculating avg/min/max from
    the hourly aggregates. Min/max values are preserved (min of mins, max of maxes).
    Sample counts are summed.

    Returns:
        Tuple of (aggregates_created, hourly_records_deleted)
    """
    cutoff = datetime.now(UTC) - timedelta(days=HOURLY_RETENTION_DAYS)
    aggregates_created = 0
    records_deleted = 0

    session_factory = get_session_factory()
    async with session_factory() as session:
        # SQLite date truncation: strftime to get day start
        day_expr = func.strftime("%Y-%m-%d 00:00:00", MetricsHourly.timestamp)

        # Query to get aggregated data grouped by server and day
        result = await session.execute(
            select(
                MetricsHourly.server_id,
                day_expr.label("day_start"),
                func.avg(MetricsHourly.cpu_avg).label("cpu_avg"),
                func.min(MetricsHourly.cpu_min).label("cpu_min"),
                func.max(MetricsHourly.cpu_max).label("cpu_max"),
                func.avg(MetricsHourly.memory_avg).label("memory_avg"),
                func.min(MetricsHourly.memory_min).label("memory_min"),
                func.max(MetricsHourly.memory_max).label("memory_max"),
                func.avg(MetricsHourly.disk_avg).label("disk_avg"),
                func.min(MetricsHourly.disk_min).label("disk_min"),
                func.max(MetricsHourly.disk_max).label("disk_max"),
                func.sum(MetricsHourly.sample_count).label("sample_count"),
            )
            .where(MetricsHourly.timestamp < cutoff)
            .group_by(MetricsHourly.server_id, day_expr)
        )
        aggregates = result.fetchall()

        if not aggregates:
            logger.debug("No hourly metrics to roll up to daily")
            return 0, 0

        # Create daily aggregate records
        for row in aggregates:
            daily = MetricsDaily(
                server_id=row.server_id,
                timestamp=datetime.fromisoformat(row.day_start).replace(tzinfo=UTC),
                cpu_avg=row.cpu_avg,
                cpu_min=row.cpu_min,
                cpu_max=row.cpu_max,
                memory_avg=row.memory_avg,
                memory_min=row.memory_min,
                memory_max=row.memory_max,
                disk_avg=row.disk_avg,
                disk_min=row.disk_min,
                disk_max=row.disk_max,
                sample_count=row.sample_count,
            )
            session.add(daily)
            aggregates_created += 1

        # Delete processed hourly records in batches
        while True:
            ids_result = await session.execute(
                select(MetricsHourly.id)
                .where(MetricsHourly.timestamp < cutoff)
                .limit(PRUNE_BATCH_SIZE)
            )
            ids_to_delete = [r[0] for r in ids_result.fetchall()]

            if not ids_to_delete:
                break

            await session.execute(delete(MetricsHourly).where(MetricsHourly.id.in_(ids_to_delete)))
            records_deleted += len(ids_to_delete)

            if len(ids_to_delete) < PRUNE_BATCH_SIZE:
                break

        await session.commit()

    logger.info(
        "Hourly to daily rollup: %d aggregates created, %d hourly records deleted",
        aggregates_created,
        records_deleted,
    )
    return aggregates_created, records_deleted


async def prune_old_daily_metrics() -> int:
    """Delete daily metrics older than 12 months.

    Uses batch deletion to avoid long-running transactions.

    Returns:
        Number of daily records deleted.
    """
    cutoff = datetime.now(UTC) - timedelta(days=DAILY_RETENTION_DAYS)
    total_deleted = 0

    session_factory = get_session_factory()
    async with session_factory() as session:
        while True:
            result = await session.execute(
                select(MetricsDaily.id)
                .where(MetricsDaily.timestamp < cutoff)
                .limit(PRUNE_BATCH_SIZE)
            )
            ids_to_delete = [r[0] for r in result.fetchall()]

            if not ids_to_delete:
                break

            await session.execute(delete(MetricsDaily).where(MetricsDaily.id.in_(ids_to_delete)))
            await session.commit()

            total_deleted += len(ids_to_delete)

            if len(ids_to_delete) < PRUNE_BATCH_SIZE:
                break

    if total_deleted > 0:
        logger.info("Daily metrics pruned: %d records older than 12 months deleted", total_deleted)
    else:
        logger.debug("No daily metrics to prune")

    return total_deleted


async def run_metrics_rollup() -> dict[str, int]:
    """Run all rollup operations in sequence.

    Scheduled to run at 01:00 UTC, after the midnight prune job.
    Executes:
    1. Raw -> Hourly (data older than 7 days)
    2. Hourly -> Daily (data older than 90 days)
    3. Prune daily (data older than 12 months)

    Returns:
        Dictionary with counts for each operation.
    """
    logger.info("Starting metrics rollup job")
    start_time = time.monotonic()

    results: dict[str, int] = {}

    # Step 1: Raw -> Hourly
    hourly_created, raw_deleted = await rollup_raw_to_hourly()
    results["hourly_created"] = hourly_created
    results["raw_deleted"] = raw_deleted

    # Step 2: Hourly -> Daily
    daily_created, hourly_deleted = await rollup_hourly_to_daily()
    results["daily_created"] = daily_created
    results["hourly_deleted"] = hourly_deleted

    # Step 3: Prune old daily metrics
    daily_deleted = await prune_old_daily_metrics()
    results["daily_deleted"] = daily_deleted

    elapsed = time.monotonic() - start_time
    logger.info(
        "Metrics rollup completed in %.2f seconds: "
        "hourly_created=%d, raw_deleted=%d, daily_created=%d, "
        "hourly_deleted=%d, daily_deleted=%d",
        elapsed,
        results["hourly_created"],
        results["raw_deleted"],
        results["daily_created"],
        results["hourly_deleted"],
        results["daily_deleted"],
    )

    return results
