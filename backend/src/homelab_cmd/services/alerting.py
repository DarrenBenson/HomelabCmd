"""Alerting service for threshold evaluation and notification management.

This module implements the two-dimensional alerting model:
- Threshold level (high/critical) determines severity
- Time (duration/cooldown) determines when to alert and re-notify

Key features:
- Sustained breach tracking for transient metrics (CPU, Memory)
- Immediate alerting for persistent metrics (Disk)
- Notification cooldowns to prevent spam
- Auto-resolve when conditions clear
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.schemas.config import (
    CooldownConfig,
    MetricThreshold,
    NotificationsConfig,
    ThresholdsConfig,
)
from homelab_cmd.db.models.alert import Alert, AlertStatus
from homelab_cmd.db.models.alert_state import AlertSeverity, AlertState, MetricType

logger = logging.getLogger(__name__)


class AlertEvent(NamedTuple):
    """Represents an alert event to be notified."""

    server_id: str
    server_name: str
    metric_type: str
    severity: str
    current_value: float
    threshold_value: float
    is_reminder: bool = False
    is_resolved: bool = False
    duration_minutes: int | None = None


class AlertingService:
    """Service for evaluating metrics and managing alert state.

    This service:
    - Evaluates metrics against configured thresholds
    - Tracks consecutive breaches for sustained alerting
    - Manages notification cooldowns
    - Triggers auto-resolve when conditions clear
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialise the alerting service.

        Args:
            session: SQLAlchemy async session for database operations
        """
        self.session = session

    async def evaluate_heartbeat(
        self,
        server_id: str,
        server_name: str,
        cpu_percent: float | None,
        memory_percent: float | None,
        disk_percent: float | None,
        thresholds: ThresholdsConfig,
        notifications: NotificationsConfig,
    ) -> list[AlertEvent]:
        """Evaluate metrics from a heartbeat and return alert events.

        Args:
            server_id: Server identifier
            server_name: Server display name
            cpu_percent: Current CPU usage percentage
            memory_percent: Current memory usage percentage
            disk_percent: Current disk usage percentage
            thresholds: Configured threshold settings
            notifications: Notification configuration

        Returns:
            List of AlertEvent objects that should trigger notifications
        """
        events: list[AlertEvent] = []

        # Evaluate each metric type
        if cpu_percent is not None:
            event = await self._evaluate_metric(
                server_id=server_id,
                server_name=server_name,
                metric_type=MetricType.CPU,
                current_value=cpu_percent,
                threshold=thresholds.cpu,
                cooldowns=notifications.cooldowns,
            )
            if event:
                events.append(event)

        if memory_percent is not None:
            event = await self._evaluate_metric(
                server_id=server_id,
                server_name=server_name,
                metric_type=MetricType.MEMORY,
                current_value=memory_percent,
                threshold=thresholds.memory,
                cooldowns=notifications.cooldowns,
            )
            if event:
                events.append(event)

        if disk_percent is not None:
            event = await self._evaluate_metric(
                server_id=server_id,
                server_name=server_name,
                metric_type=MetricType.DISK,
                current_value=disk_percent,
                threshold=thresholds.disk,
                cooldowns=notifications.cooldowns,
            )
            if event:
                events.append(event)

        # Also check for auto-resolve conditions
        resolved_events = await self._check_auto_resolve(
            server_id=server_id,
            server_name=server_name,
            cpu_percent=cpu_percent,
            memory_percent=memory_percent,
            disk_percent=disk_percent,
            thresholds=thresholds,
        )
        events.extend(resolved_events)

        # Resolve offline alert if heartbeat received
        offline_event = await self._resolve_offline_alert(
            server_id=server_id,
            server_name=server_name,
        )
        if offline_event:
            events.append(offline_event)

        return events

    async def trigger_offline_alert(
        self,
        server_id: str,
        server_name: str,
        cooldowns: CooldownConfig,
    ) -> AlertEvent | None:
        """Create or re-notify for an offline server alert.

        Called by the scheduler when a server goes offline.

        Args:
            server_id: Server identifier
            server_name: Server display name
            cooldowns: Notification cooldown settings

        Returns:
            AlertEvent if notification should be sent, None otherwise
        """
        state = await self._get_or_create_state(server_id, MetricType.OFFLINE)
        now = datetime.now(UTC)

        if state.current_severity is None:
            # New offline alert
            state.current_severity = AlertSeverity.CRITICAL.value
            state.consecutive_breaches = 1
            state.first_breach_at = now
            state.last_notified_at = now
            state.resolved_at = None

            logger.info("Server %s marked offline, creating alert", server_id)

            # Create persistent Alert record
            await self._create_alert_record(
                server_id=server_id,
                server_name=server_name,
                metric_type=MetricType.OFFLINE.value,
                severity=AlertSeverity.CRITICAL.value,
                current_value=0,
                threshold_value=0,
            )

            return AlertEvent(
                server_id=server_id,
                server_name=server_name,
                metric_type=MetricType.OFFLINE.value,
                severity=AlertSeverity.CRITICAL.value,
                current_value=0,
                threshold_value=0,
                is_reminder=False,
            )

        # Check if cooldown expired for re-notification
        if self._should_notify(state, cooldowns):
            state.last_notified_at = now
            state.consecutive_breaches += 1

            return AlertEvent(
                server_id=server_id,
                server_name=server_name,
                metric_type=MetricType.OFFLINE.value,
                severity=AlertSeverity.CRITICAL.value,
                current_value=0,
                threshold_value=0,
                is_reminder=True,
            )

        return None

    async def evaluate_services(
        self,
        server_id: str,
        server_name: str,
        services: list,
        notifications: NotificationsConfig,
    ) -> list[AlertEvent]:
        """Evaluate service status and return alert events.

        Generates alerts when expected services are stopped or failed.
        Critical services generate HIGH severity alerts; non-critical
        services generate MEDIUM severity alerts.

        Args:
            server_id: Server identifier
            server_name: Server display name
            services: List of ServiceStatusPayload objects from heartbeat
            notifications: Notification configuration

        Returns:
            List of AlertEvent objects that should trigger notifications
        """
        from homelab_cmd.db.models.service import ExpectedService

        events: list[AlertEvent] = []

        # Get expected services for this server
        result = await self.session.execute(
            select(ExpectedService)
            .where(ExpectedService.server_id == server_id)
            .where(ExpectedService.enabled.is_(True))
        )
        expected_services = {svc.service_name: svc for svc in result.scalars().all()}

        if not expected_services:
            return events

        # Build a lookup of reported service statuses
        reported_status = {svc.name: svc.status for svc in services}

        # Evaluate each expected service
        for service_name, expected_svc in expected_services.items():
            status = reported_status.get(service_name)
            if status is None:
                # Service not reported in this heartbeat, skip
                continue

            event = await self._evaluate_single_service(
                server_id=server_id,
                server_name=server_name,
                service_name=service_name,
                status=status,
                is_critical=expected_svc.is_critical,
                cooldowns=notifications.cooldowns,
            )
            if event:
                events.append(event)

        return events

    async def _evaluate_single_service(
        self,
        server_id: str,
        server_name: str,
        service_name: str,
        status: str,
        is_critical: bool,
        cooldowns: CooldownConfig,
    ) -> AlertEvent | None:
        """Evaluate a single service and return alert event if needed.

        Args:
            server_id: Server identifier
            server_name: Server display name
            service_name: Name of the service
            status: Current service status (running/stopped/failed/unknown)
            is_critical: Whether this is a critical service
            cooldowns: Notification cooldown settings

        Returns:
            AlertEvent if notification should be sent, None otherwise
        """
        # Use service:{name} as metric_type for deduplication
        metric_type = f"service:{service_name}"
        now = datetime.now(UTC)

        # Get or create state for this service
        state = await self._get_or_create_service_state(server_id, metric_type)

        if status in ["stopped", "failed"]:
            # Determine severity based on criticality
            severity = AlertSeverity.HIGH if is_critical else AlertSeverity.MEDIUM

            # Check if we need to create a new alert:
            # 1. State shows no active alert (current_severity is None)
            # 2. OR state thinks there's an active alert but no OPEN alert exists
            #    (happens when alert was manually resolved/acknowledged via API)
            needs_new_alert = state.current_severity is None
            if not needs_new_alert:
                has_open = await self._has_open_service_alert(server_id, service_name)
                if not has_open:
                    needs_new_alert = True
                    logger.info(
                        "Service %s on %s: state shows active alert but no OPEN alert exists, creating new",
                        service_name,
                        server_id,
                    )

            if needs_new_alert:
                # New alert (or re-creating after manual resolution)
                state.current_severity = severity.value
                state.consecutive_breaches = 1
                state.first_breach_at = now
                state.last_notified_at = now
                state.resolved_at = None

                logger.info(
                    "Service %s on %s is %s, creating %s alert",
                    service_name,
                    server_id,
                    status,
                    severity.value,
                )

                # Create persistent Alert record
                await self._create_service_alert_record(
                    server_id=server_id,
                    server_name=server_name,
                    service_name=service_name,
                    status=status,
                    severity=severity.value,
                )

                return AlertEvent(
                    server_id=server_id,
                    server_name=server_name,
                    metric_type=metric_type,
                    severity=severity.value,
                    current_value=0,
                    threshold_value=0,
                    is_reminder=False,
                )

            # Check for re-notification (cooldown expired)
            if self._should_notify(state, cooldowns):
                state.last_notified_at = now
                state.consecutive_breaches += 1

                return AlertEvent(
                    server_id=server_id,
                    server_name=server_name,
                    metric_type=metric_type,
                    severity=state.current_severity,
                    current_value=0,
                    threshold_value=0,
                    is_reminder=True,
                )

        elif status == "running":
            # Check if there's an active alert to resolve
            if state.current_severity is not None:
                duration = state.duration_minutes

                state.current_severity = None
                state.consecutive_breaches = 0
                state.resolved_at = now

                logger.info(
                    "Service %s on %s is running, resolving alert (duration: %s min)",
                    service_name,
                    server_id,
                    duration,
                )

                # Resolve the persistent Alert record
                await self._resolve_service_alert_record(server_id, service_name)

                return AlertEvent(
                    server_id=server_id,
                    server_name=server_name,
                    metric_type=metric_type,
                    severity="resolved",
                    current_value=0,
                    threshold_value=0,
                    is_resolved=True,
                    duration_minutes=duration,
                )

        # status == "unknown" - ignore, don't create alerts
        return None

    async def _get_or_create_service_state(
        self,
        server_id: str,
        metric_type: str,
    ) -> AlertState:
        """Get existing alert state for a service or create a new one.

        Args:
            server_id: Server identifier
            metric_type: Metric type (service:{name})

        Returns:
            AlertState object (new or existing)
        """
        result = await self.session.execute(
            select(AlertState)
            .where(AlertState.server_id == server_id)
            .where(AlertState.metric_type == metric_type)
        )
        state = result.scalar_one_or_none()

        if state is None:
            state = AlertState(
                server_id=server_id,
                metric_type=metric_type,
            )
            self.session.add(state)
            await self.session.flush()

        return state

    async def _has_open_service_alert(
        self,
        server_id: str,
        service_name: str,
    ) -> bool:
        """Check if there's an open service alert for this server/service.

        Args:
            server_id: Server identifier
            service_name: Service name

        Returns:
            True if an open service alert exists, False otherwise
        """
        result = await self.session.execute(
            select(Alert)
            .where(Alert.server_id == server_id)
            .where(Alert.alert_type == "service")
            .where(Alert.status == AlertStatus.OPEN.value)
            .where(Alert.title.contains(service_name, autoescape=True))
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _create_service_alert_record(
        self,
        server_id: str,
        server_name: str,
        service_name: str,
        status: str,
        severity: str,
    ) -> Alert:
        """Create a persistent Alert record for a service alert.

        Args:
            server_id: Server identifier
            server_name: Server display name
            service_name: Name of the service
            status: Service status (stopped/failed)
            severity: Alert severity (high/medium)

        Returns:
            The created Alert record
        """
        title = f"Service {service_name} is {status} on {server_name}"
        message = f"Expected service {service_name} on {server_name} is {status}."

        alert = Alert(
            server_id=server_id,
            alert_type="service",
            severity=severity,
            status=AlertStatus.OPEN.value,
            title=title,
            message=message,
            threshold_value=0,
            actual_value=0,
        )
        self.session.add(alert)
        await self.session.flush()

        logger.info(
            "Created Alert record for service %s on server %s: %s",
            service_name,
            server_id,
            severity,
        )

        return alert

    async def _resolve_service_alert_record(
        self,
        server_id: str,
        service_name: str,
    ) -> Alert | None:
        """Resolve an open service Alert record.

        Finds the most recent open service alert for the server/service
        and marks it as resolved with auto_resolved=True.

        Args:
            server_id: Server identifier
            service_name: Service name

        Returns:
            The resolved Alert record, or None if no open alert found
        """
        # Find open service alerts that match this service name
        result = await self.session.execute(
            select(Alert)
            .where(Alert.server_id == server_id)
            .where(Alert.alert_type == "service")
            .where(Alert.status == AlertStatus.OPEN.value)
            .where(Alert.title.contains(service_name, autoescape=True))
            .order_by(Alert.created_at.desc())
            .limit(1)
        )
        alert = result.scalar_one_or_none()

        if alert is None:
            logger.debug(
                "No open service alert found to resolve for server %s service %s",
                server_id,
                service_name,
            )
            return None

        alert.resolve(auto=True)

        logger.info(
            "Resolved service Alert record for server %s: %s",
            server_id,
            service_name,
        )

        return alert

    async def _evaluate_metric(
        self,
        server_id: str,
        server_name: str,
        metric_type: MetricType,
        current_value: float,
        threshold: MetricThreshold,
        cooldowns: CooldownConfig,
    ) -> AlertEvent | None:
        """Evaluate a single metric against thresholds.

        Args:
            server_id: Server identifier
            server_name: Server display name
            metric_type: Type of metric being evaluated
            current_value: Current metric value
            threshold: Threshold configuration for this metric
            cooldowns: Notification cooldown settings

        Returns:
            AlertEvent if notification should be sent, None otherwise
        """
        state = await self._get_or_create_state(server_id, metric_type)
        now = datetime.now(UTC)

        # Determine target severity based on current value
        if current_value >= threshold.critical_percent:
            target_severity = AlertSeverity.CRITICAL
            threshold_value = threshold.critical_percent
        elif current_value >= threshold.high_percent:
            target_severity = AlertSeverity.HIGH
            threshold_value = threshold.high_percent
        else:
            # Below thresholds - reset breach timer only if no active alert
            # If there's an active alert, let _check_auto_resolve handle it
            # so it can capture duration_minutes before resetting first_breach_at
            if state.current_severity is None:
                if state.first_breach_at is not None or (state.consecutive_breaches or 0) > 0:
                    state.consecutive_breaches = 0
                    state.first_breach_at = None
                    state.current_value = current_value
                    logger.debug(
                        "Server %s metric %s dropped below threshold, resetting breach timer",
                        server_id,
                        metric_type.value,
                    )
            return None

        # Update state with current value
        state.current_value = current_value

        # Track consecutive breaches
        breaches = state.consecutive_breaches or 0
        if breaches == 0:
            # Starting a new breach sequence
            state.consecutive_breaches = 1
            state.first_breach_at = now
        else:
            state.consecutive_breaches = breaches + 1

        # Check if sustained threshold is met (time-based)
        # sustained_seconds = 0 means immediate (disk)
        # sustained_seconds = 180 means condition must persist for 3 minutes
        required_seconds = threshold.sustained_seconds
        if required_seconds == 0:
            # Immediate firing - no duration requirement
            pass
        elif state.first_breach_at is not None:
            # Handle timezone-naive datetimes from SQLite
            first_breach = state.first_breach_at
            if first_breach.tzinfo is None:
                first_breach = first_breach.replace(tzinfo=UTC)
            elapsed_seconds = (now - first_breach).total_seconds()
            if elapsed_seconds < required_seconds:
                # Not yet sustained, don't alert
                logger.debug(
                    "Server %s metric %s: breach for %.0fs/%ds, not yet sustained",
                    server_id,
                    metric_type.value,
                    elapsed_seconds,
                    required_seconds,
                )
                return None

        # Sustained threshold met - check if we should alert/escalate/re-notify
        if state.current_severity is None:
            # New alert
            state.current_severity = target_severity.value
            state.last_notified_at = now

            logger.info(
                "Server %s metric %s: new %s alert at %.1f%%",
                server_id,
                metric_type.value,
                target_severity.value,
                current_value,
            )

            # Create persistent Alert record
            await self._create_alert_record(
                server_id=server_id,
                server_name=server_name,
                metric_type=metric_type.value,
                severity=target_severity.value,
                current_value=current_value,
                threshold_value=threshold_value,
            )

            return AlertEvent(
                server_id=server_id,
                server_name=server_name,
                metric_type=metric_type.value,
                severity=target_severity.value,
                current_value=current_value,
                threshold_value=threshold_value,
                is_reminder=False,
            )

        # Existing alert - check for escalation
        if (
            target_severity == AlertSeverity.CRITICAL
            and state.current_severity == AlertSeverity.HIGH.value
        ):
            # Escalate from HIGH to CRITICAL
            state.current_severity = AlertSeverity.CRITICAL.value
            state.last_notified_at = now

            logger.info(
                "Server %s metric %s: escalating to CRITICAL at %.1f%%",
                server_id,
                metric_type.value,
                current_value,
            )

            # Escalate the persistent Alert record
            await self._escalate_alert_record(
                server_id=server_id,
                metric_type=metric_type.value,
                new_severity=AlertSeverity.CRITICAL.value,
                current_value=current_value,
                threshold_value=threshold_value,
            )

            return AlertEvent(
                server_id=server_id,
                server_name=server_name,
                metric_type=metric_type.value,
                severity=AlertSeverity.CRITICAL.value,
                current_value=current_value,
                threshold_value=threshold_value,
                is_reminder=False,
            )

        # Check for re-notification (cooldown expired)
        if self._should_notify(state, cooldowns):
            state.last_notified_at = now

            logger.info(
                "Server %s metric %s: re-notifying (cooldown expired) at %.1f%%",
                server_id,
                metric_type.value,
                current_value,
            )

            return AlertEvent(
                server_id=server_id,
                server_name=server_name,
                metric_type=metric_type.value,
                severity=state.current_severity,
                current_value=current_value,
                threshold_value=threshold_value,
                is_reminder=True,
            )

        return None

    async def _check_auto_resolve(
        self,
        server_id: str,
        server_name: str,
        cpu_percent: float | None,
        memory_percent: float | None,
        disk_percent: float | None,
        thresholds: ThresholdsConfig,
    ) -> list[AlertEvent]:
        """Check if any active alerts should be auto-resolved.

        Args:
            server_id: Server identifier
            server_name: Server display name
            cpu_percent: Current CPU usage (None if not available)
            memory_percent: Current memory usage (None if not available)
            disk_percent: Current disk usage (None if not available)
            thresholds: Threshold configuration

        Returns:
            List of resolved AlertEvents
        """
        events: list[AlertEvent] = []
        now = datetime.now(UTC)

        # Get all active states for this server
        result = await self.session.execute(
            select(AlertState)
            .where(AlertState.server_id == server_id)
            .where(AlertState.current_severity.isnot(None))
        )
        active_states = list(result.scalars().all())

        for state in active_states:
            should_resolve = False
            current_value = None

            if state.metric_type == MetricType.CPU.value and cpu_percent is not None:
                if cpu_percent < thresholds.cpu.high_percent:
                    should_resolve = True
                    current_value = cpu_percent

            elif state.metric_type == MetricType.MEMORY.value and memory_percent is not None:
                if memory_percent < thresholds.memory.high_percent:
                    should_resolve = True
                    current_value = memory_percent

            elif state.metric_type == MetricType.DISK.value and disk_percent is not None:
                if disk_percent < thresholds.disk.high_percent:
                    should_resolve = True
                    current_value = disk_percent

            # Note: OFFLINE is resolved separately in _resolve_offline_alert

            if should_resolve:
                duration = state.duration_minutes

                state.current_severity = None
                state.consecutive_breaches = 0
                state.first_breach_at = None  # Reset after capturing duration
                state.resolved_at = now
                state.current_value = current_value

                logger.info(
                    "Server %s metric %s: auto-resolved at %.1f%% (duration: %s min)",
                    server_id,
                    state.metric_type,
                    current_value,
                    duration,
                )

                # Resolve the persistent Alert record
                await self._resolve_alert_record(
                    server_id=server_id,
                    metric_type=state.metric_type,
                )

                events.append(
                    AlertEvent(
                        server_id=server_id,
                        server_name=server_name,
                        metric_type=state.metric_type,
                        severity="resolved",
                        current_value=current_value,
                        threshold_value=0,
                        is_resolved=True,
                        duration_minutes=duration,
                    )
                )

        return events

    async def _resolve_offline_alert(
        self,
        server_id: str,
        server_name: str,
    ) -> AlertEvent | None:
        """Resolve offline alert when a heartbeat is received.

        Args:
            server_id: Server identifier
            server_name: Server display name

        Returns:
            AlertEvent if offline alert was resolved, None otherwise
        """
        result = await self.session.execute(
            select(AlertState)
            .where(AlertState.server_id == server_id)
            .where(AlertState.metric_type == MetricType.OFFLINE.value)
            .where(AlertState.current_severity.isnot(None))
        )
        state = result.scalar_one_or_none()

        if state is None:
            return None

        duration = state.duration_minutes
        now = datetime.now(UTC)

        state.current_severity = None
        state.consecutive_breaches = 0
        state.resolved_at = now

        logger.info(
            "Server %s offline alert resolved (was offline for %s min)",
            server_id,
            duration,
        )

        # Resolve the persistent Alert record
        await self._resolve_alert_record(
            server_id=server_id,
            metric_type=MetricType.OFFLINE.value,
        )

        return AlertEvent(
            server_id=server_id,
            server_name=server_name,
            metric_type=MetricType.OFFLINE.value,
            severity="resolved",
            current_value=0,
            threshold_value=0,
            is_resolved=True,
            duration_minutes=duration,
        )

    async def _get_or_create_state(
        self,
        server_id: str,
        metric_type: MetricType,
    ) -> AlertState:
        """Get existing alert state or create a new one.

        Args:
            server_id: Server identifier
            metric_type: Type of metric

        Returns:
            AlertState object (new or existing)
        """
        result = await self.session.execute(
            select(AlertState)
            .where(AlertState.server_id == server_id)
            .where(AlertState.metric_type == metric_type.value)
        )
        state = result.scalar_one_or_none()

        if state is None:
            state = AlertState(
                server_id=server_id,
                metric_type=metric_type.value,
            )
            self.session.add(state)
            await self.session.flush()  # Ensure state is visible in subsequent queries

        return state

    def _should_notify(self, state: AlertState, cooldowns: CooldownConfig) -> bool:
        """Check if cooldown has expired and re-notification is needed.

        Args:
            state: Current alert state
            cooldowns: Cooldown configuration

        Returns:
            True if notification should be sent
        """
        if state.last_notified_at is None:
            return True

        if state.current_severity == AlertSeverity.CRITICAL.value:
            cooldown_minutes = cooldowns.critical_minutes
        else:
            cooldown_minutes = cooldowns.high_minutes

        # Handle timezone-aware vs naive datetime comparison
        last_notified = state.last_notified_at
        if last_notified.tzinfo is None:
            last_notified = last_notified.replace(tzinfo=UTC)

        elapsed = datetime.now(UTC) - last_notified
        return elapsed >= timedelta(minutes=cooldown_minutes)

    async def _create_alert_record(
        self,
        server_id: str,
        server_name: str,
        metric_type: str,
        severity: str,
        current_value: float,
        threshold_value: float,
    ) -> Alert:
        """Create a persistent Alert record for history tracking.

        Args:
            server_id: Server identifier
            server_name: Server display name
            metric_type: Type of metric (cpu, memory, disk, offline)
            severity: Alert severity (critical, high)
            current_value: The value that triggered the alert
            threshold_value: The threshold that was breached

        Returns:
            The created Alert record
        """
        # Generate descriptive title
        if metric_type == MetricType.OFFLINE.value:
            title = f"Server offline: {server_name}"
            message = f"Server {server_name} is not responding to heartbeats."
        else:
            metric_label = metric_type.upper()
            title = f"{severity.capitalize()} {metric_label} usage on {server_name} ({current_value:.0f}%)"
            message = (
                f"{metric_label} usage on {server_name} reached {current_value:.1f}%, "
                f"exceeding the {severity} threshold of {threshold_value:.0f}%."
            )

        alert = Alert(
            server_id=server_id,
            alert_type=metric_type,
            severity=severity,
            status=AlertStatus.OPEN.value,
            title=title,
            message=message,
            threshold_value=threshold_value,
            actual_value=current_value,
        )
        self.session.add(alert)
        await self.session.flush()

        logger.info(
            "Created Alert record for server %s: %s (%s)",
            server_id,
            metric_type,
            severity,
        )

        return alert

    async def _resolve_alert_record(
        self,
        server_id: str,
        metric_type: str,
    ) -> Alert | None:
        """Resolve an open Alert record for a server/metric.

        Finds the most recent open alert for the server/metric combination
        and marks it as resolved with auto_resolved=True.

        Args:
            server_id: Server identifier
            metric_type: Type of metric (cpu, memory, disk, offline)

        Returns:
            The resolved Alert record, or None if no open alert found
        """
        # Find the most recent open alert for this server/metric
        result = await self.session.execute(
            select(Alert)
            .where(Alert.server_id == server_id)
            .where(Alert.alert_type == metric_type)
            .where(Alert.status == AlertStatus.OPEN.value)
            .order_by(Alert.created_at.desc())
            .limit(1)
        )
        alert = result.scalar_one_or_none()

        if alert is None:
            logger.debug(
                "No open alert found to resolve for server %s metric %s",
                server_id,
                metric_type,
            )
            return None

        alert.resolve(auto=True)

        logger.info(
            "Resolved Alert record for server %s: %s",
            server_id,
            metric_type,
        )

        return alert

    async def _escalate_alert_record(
        self,
        server_id: str,
        metric_type: str,
        new_severity: str,
        current_value: float,
        threshold_value: float,
    ) -> Alert | None:
        """Escalate an existing alert to a higher severity.

        Finds the most recent open alert and updates its severity.

        Args:
            server_id: Server identifier
            metric_type: Type of metric
            new_severity: The new severity level (should be 'critical')
            current_value: The current value at escalation
            threshold_value: The new threshold that was breached

        Returns:
            The escalated Alert record, or None if no open alert found
        """
        result = await self.session.execute(
            select(Alert)
            .where(Alert.server_id == server_id)
            .where(Alert.alert_type == metric_type)
            .where(Alert.status == AlertStatus.OPEN.value)
            .order_by(Alert.created_at.desc())
            .limit(1)
        )
        alert = result.scalar_one_or_none()

        if alert is None:
            logger.warning(
                "No open alert found to escalate for server %s metric %s",
                server_id,
                metric_type,
            )
            return None

        alert.severity = new_severity
        alert.threshold_value = threshold_value
        alert.actual_value = current_value
        # Update message to reflect escalation
        metric_label = metric_type.upper()
        alert.message = (
            f"{metric_label} usage escalated to {new_severity} at {current_value:.1f}%, "
            f"exceeding the {new_severity} threshold of {threshold_value:.0f}%."
        )

        logger.info(
            "Escalated Alert record for server %s: %s -> %s",
            server_id,
            metric_type,
            new_severity,
        )

        return alert


async def get_active_alerts_count(session: AsyncSession, server_id: str) -> int:
    """Get count of active alerts for a server.

    Args:
        session: Database session
        server_id: Server identifier

    Returns:
        Number of active alerts
    """
    result = await session.execute(
        select(AlertState)
        .where(AlertState.server_id == server_id)
        .where(AlertState.current_severity.isnot(None))
    )
    return len(list(result.scalars().all()))


async def get_all_active_alerts(session: AsyncSession) -> list[AlertState]:
    """Get all active alerts across all servers.

    Args:
        session: Database session

    Returns:
        List of active AlertState objects
    """
    result = await session.execute(
        select(AlertState).where(AlertState.current_severity.isnot(None))
    )
    return list(result.scalars().all())
