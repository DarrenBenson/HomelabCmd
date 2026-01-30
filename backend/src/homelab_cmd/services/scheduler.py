"""Background scheduler for server status detection, data retention, and alerting.

This module provides scheduled jobs for:
- Detecting stale servers and marking them offline (US0008)
- Triggering offline alerts with cooldown-aware re-notifications (US0011, US0012)
- Pruning old metrics data beyond retention period (US0009)
- Tiered data retention with rollup (US0046)
- Configuration drift detection (US0122)
"""

import logging
import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select

from homelab_cmd.api.schemas.config import NotificationsConfig
from homelab_cmd.db.models.alert import Alert, AlertStatus
from homelab_cmd.db.models.config_check import ConfigCheck
from homelab_cmd.db.models.metrics import Metrics, MetricsDaily, MetricsHourly
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.session import get_session_factory
from homelab_cmd.services.alerting import AlertEvent, AlertingService
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


# =============================================================================
# Configuration Drift Detection (US0122)
# =============================================================================


async def check_config_drift(
    notifications_config: NotificationsConfig | None = None,
) -> dict[str, int]:
    """Check all eligible machines for configuration drift.

    Runs daily at 6am UTC. Queries servers with assigned packs and
    drift_detection_enabled=True, checks compliance for each pack,
    and creates/resolves alerts based on drift.

    Args:
        notifications_config: Optional notification settings for Slack alerts.

    Returns:
        Dictionary with counts: servers_checked, packs_checked, drift_detected, resolved.
    """
    logger.info("Starting configuration drift detection")
    start_time = time.monotonic()

    results = {
        "servers_checked": 0,
        "packs_checked": 0,
        "drift_detected": 0,
        "resolved": 0,
        "errors": 0,
    }

    session_factory = get_session_factory()
    async with session_factory() as session:
        # Query eligible servers: have assigned packs and drift detection enabled
        eligible_servers = await session.execute(
            select(Server)
            .where(Server.assigned_packs.isnot(None))
            .where(Server.drift_detection_enabled.is_(True))
            .where(Server.status == ServerStatus.ONLINE.value)
        )
        servers = list(eligible_servers.scalars().all())

        if not servers:
            logger.info("No eligible servers for drift detection")
            return results

        results["servers_checked"] = len(servers)

        # Get notifier if configured
        notifier = None
        if notifications_config and notifications_config.slack_webhook_url:
            notifier = get_notifier(notifications_config.slack_webhook_url)

        # Check each server
        for server in servers:
            packs = server.assigned_packs or []
            if not packs:
                continue

            for pack_name in packs:
                try:
                    drift_result = await _check_server_pack_drift(
                        session=session,
                        server=server,
                        pack_name=pack_name,
                        notifier=notifier,
                        notifications_config=notifications_config,
                    )

                    results["packs_checked"] += 1
                    if drift_result == "drift":
                        results["drift_detected"] += 1
                    elif drift_result == "resolved":
                        results["resolved"] += 1

                except Exception as e:
                    logger.error(
                        "Drift check failed for server %s pack %s: %s",
                        server.id,
                        pack_name,
                        e,
                    )
                    results["errors"] += 1

        await session.commit()

    elapsed = time.monotonic() - start_time
    logger.info(
        "Drift detection completed in %.2f seconds: "
        "servers=%d, packs=%d, drift=%d, resolved=%d, errors=%d",
        elapsed,
        results["servers_checked"],
        results["packs_checked"],
        results["drift_detected"],
        results["resolved"],
        results["errors"],
    )

    return results


async def _check_server_pack_drift(
    session,
    server: Server,
    pack_name: str,
    notifier,
    notifications_config: NotificationsConfig | None,
) -> str | None:
    """Check a single server/pack combination for drift.

    Compares current compliance state to previous check and creates/resolves
    alerts as needed.

    Args:
        session: Database session.
        server: Server to check.
        pack_name: Configuration pack name.
        notifier: Slack notifier (optional).
        notifications_config: Notification settings.

    Returns:
        "drift" if new drift detected, "resolved" if drift resolved, None otherwise.
    """
    # Get the two most recent checks for this server/pack
    result = await session.execute(
        select(ConfigCheck)
        .where(ConfigCheck.server_id == server.id)
        .where(ConfigCheck.pack_name == pack_name)
        .order_by(ConfigCheck.checked_at.desc())
        .limit(2)
    )
    recent_checks = list(result.scalars().all())

    if len(recent_checks) < 2:
        # Not enough history to detect drift (first check or only one check)
        logger.debug(
            "Server %s pack %s: insufficient history for drift detection",
            server.id,
            pack_name,
        )
        return None

    # Most recent check is first due to desc order
    current_check = recent_checks[0]
    previous_check = recent_checks[1]

    # Check for drift: was compliant, now isn't
    if previous_check.is_compliant and not current_check.is_compliant:
        await _create_drift_alert(
            session=session,
            server=server,
            pack_name=pack_name,
            mismatch_count=len(current_check.mismatches or []),
            notifier=notifier,
            notifications_config=notifications_config,
        )
        return "drift"

    # Check for resolution: was non-compliant, now is
    if not previous_check.is_compliant and current_check.is_compliant:
        resolved = await _resolve_drift_alert(
            session=session,
            server=server,
            pack_name=pack_name,
            notifier=notifier,
            notifications_config=notifications_config,
        )
        if resolved:
            return "resolved"

    return None


async def _create_drift_alert(
    session,
    server: Server,
    pack_name: str,
    mismatch_count: int,
    notifier,
    notifications_config: NotificationsConfig | None,
) -> Alert:
    """Create a config_drift alert and send Slack notification.

    Args:
        session: Database session.
        server: Server with drift.
        pack_name: Configuration pack name.
        mismatch_count: Number of mismatched items.
        notifier: Slack notifier (optional).
        notifications_config: Notification settings.

    Returns:
        The created or updated Alert record.
    """
    server_name = server.display_name or server.hostname

    # Check for existing open drift alert for this server/pack
    existing_result = await session.execute(
        select(Alert)
        .where(Alert.server_id == server.id)
        .where(Alert.alert_type == "config_drift")
        .where(Alert.status == AlertStatus.OPEN.value)
    )
    existing_alert = existing_result.scalar_one_or_none()

    if existing_alert:
        # Update existing alert
        existing_alert.message = (
            f"{mismatch_count} items no longer compliant with {pack_name}"
        )
        existing_alert.actual_value = mismatch_count
        logger.info(
            "Updated existing drift alert for server %s pack %s: %d mismatches",
            server.id,
            pack_name,
            mismatch_count,
        )
        return existing_alert

    # Create new alert
    alert = Alert(
        server_id=server.id,
        alert_type="config_drift",
        severity="warning",
        status=AlertStatus.OPEN.value,
        title=f"Configuration drift on {server_name}",
        message=f"{mismatch_count} items no longer compliant with {pack_name}",
        threshold_value=0,
        actual_value=mismatch_count,
    )
    session.add(alert)
    await session.flush()

    logger.info(
        "Created drift alert for server %s pack %s: %d mismatches",
        server.id,
        pack_name,
        mismatch_count,
    )

    # Send Slack notification
    if notifier and notifications_config:
        event = AlertEvent(
            server_id=server.id,
            server_name=server_name,
            metric_type="config_drift",
            severity="warning",
            current_value=mismatch_count,
            threshold_value=0,
            is_reminder=False,
            is_resolved=False,
        )
        await notifier.send_alert(event, notifications_config)

    return alert


async def _resolve_drift_alert(
    session,
    server: Server,
    pack_name: str,
    notifier,
    notifications_config: NotificationsConfig | None,
) -> bool:
    """Auto-resolve drift alert when machine returns to compliance.

    Args:
        session: Database session.
        server: Server that is now compliant.
        pack_name: Configuration pack name.
        notifier: Slack notifier (optional).
        notifications_config: Notification settings.

    Returns:
        True if an alert was resolved, False otherwise.
    """
    server_name = server.display_name or server.hostname

    # Find open drift alert for this server
    result = await session.execute(
        select(Alert)
        .where(Alert.server_id == server.id)
        .where(Alert.alert_type == "config_drift")
        .where(Alert.status == AlertStatus.OPEN.value)
    )
    alert = result.scalar_one_or_none()

    if not alert:
        return False

    # Resolve the alert
    alert.resolve(auto=True)
    await session.flush()

    logger.info(
        "Resolved drift alert for server %s pack %s",
        server.id,
        pack_name,
    )

    # Send Slack notification
    if notifier and notifications_config:
        event = AlertEvent(
            server_id=server.id,
            server_name=server_name,
            metric_type="config_drift",
            severity="resolved",
            current_value=0,
            threshold_value=0,
            is_reminder=False,
            is_resolved=True,
        )
        await notifier.send_alert(event, notifications_config)

    return True


# =============================================================================
# Historical Cost Tracking (US0183)
# =============================================================================


async def capture_daily_costs() -> int:
    """Capture daily cost snapshots for all servers.

    AC1: Daily cost snapshot captured at midnight UTC.

    Schedule: 0 0 * * * (midnight UTC)

    Returns:
        Number of snapshots captured.
    """
    from homelab_cmd.services.cost_history import CostHistoryService

    logger.info("Starting daily cost snapshot capture")
    start_time = time.monotonic()

    session_factory = get_session_factory()
    async with session_factory() as session:
        service = CostHistoryService(session)
        count = await service.capture_all_snapshots()

    elapsed = time.monotonic() - start_time
    logger.info(
        "Daily cost snapshot capture completed in %.2f seconds: %d snapshots",
        elapsed,
        count,
    )

    return count


async def rollup_cost_snapshots() -> dict[str, int]:
    """Roll up old daily cost data to monthly aggregates.

    AC6: Data retention - daily data older than 2 years rolled up.

    Schedule: 0 2 1 * * (1st of month, 2am UTC)

    Returns:
        Dictionary with counts: {'daily_deleted': N, 'monthly_created': N}
    """
    from homelab_cmd.services.cost_history import CostHistoryService

    logger.info("Starting cost snapshot rollup")
    start_time = time.monotonic()

    session_factory = get_session_factory()
    async with session_factory() as session:
        service = CostHistoryService(session)
        result = await service.rollup_old_data()

    elapsed = time.monotonic() - start_time
    logger.info(
        "Cost snapshot rollup completed in %.2f seconds: "
        "monthly_created=%d, daily_deleted=%d",
        elapsed,
        result["monthly_created"],
        result["daily_deleted"],
    )

    return result
