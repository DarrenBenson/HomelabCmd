"""Tests for Alerting Service (US0011, US0012: Threshold Evaluation and Cooldowns).

These tests verify the alerting logic including:
- Sustained threshold tracking for transient metrics (CPU, Memory)
- Immediate alerting for persistent metrics (Disk)
- Notification cooldowns
- Auto-resolve behaviour
- Severity escalation

Spec References:
- sdlc-studio/stories/US0011-threshold-evaluation.md
- sdlc-studio/stories/US0012-alert-deduplication.md
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.schemas.config import (
    CooldownConfig,
    MetricThreshold,
    NotificationsConfig,
    ThresholdsConfig,
)
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.services.alerting import AlertingService


@pytest.fixture
def default_thresholds() -> ThresholdsConfig:
    """Create default threshold configuration for tests."""
    return ThresholdsConfig(
        cpu=MetricThreshold(high_percent=85, critical_percent=95, sustained_heartbeats=3),
        memory=MetricThreshold(high_percent=85, critical_percent=95, sustained_heartbeats=3),
        disk=MetricThreshold(high_percent=80, critical_percent=95, sustained_heartbeats=0),
        server_offline_seconds=180,
    )


@pytest.fixture
def default_notifications() -> NotificationsConfig:
    """Create default notifications configuration for tests."""
    return NotificationsConfig(
        slack_webhook_url="https://hooks.slack.com/test",
        cooldowns=CooldownConfig(critical_minutes=30, high_minutes=240),
        notify_on_critical=True,
        notify_on_high=True,
        notify_on_remediation=True,
    )


@pytest.fixture
async def test_server(db_session: AsyncSession) -> Server:
    """Create a test server in the database."""
    server = Server(
        id="test-server",
        hostname="test-server.local",
        display_name="Test Server",
        status=ServerStatus.ONLINE.value,
    )
    db_session.add(server)
    await db_session.commit()
    return server


class TestDiskAlertImmediate:
    """Test disk alerts fire immediately (no sustained requirement)."""

    @pytest.mark.asyncio
    async def test_disk_high_creates_alert_immediately(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Disk at 82% should create HIGH alert immediately (AC1)."""
        service = AlertingService(db_session)

        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=82.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        # Should have one disk alert
        disk_events = [e for e in events if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events) == 1
        assert disk_events[0].severity == "high"
        assert disk_events[0].current_value == 82.0

    @pytest.mark.asyncio
    async def test_disk_critical_creates_alert_immediately(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Disk at 96% should create CRITICAL alert immediately (AC2)."""
        service = AlertingService(db_session)

        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=96.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        disk_events = [e for e in events if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events) == 1
        assert disk_events[0].severity == "critical"
        assert disk_events[0].current_value == 96.0


class TestSustainedThresholds:
    """Test CPU and Memory require sustained breaches."""

    @pytest.mark.asyncio
    async def test_cpu_single_breach_no_alert(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """CPU at 90% for 1 heartbeat should NOT create alert (AC6)."""
        service = AlertingService(db_session)

        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=90.0,
            memory_percent=50.0,
            disk_percent=50.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        cpu_events = [e for e in events if e.metric_type == "cpu" and not e.is_resolved]
        assert len(cpu_events) == 0

    @pytest.mark.asyncio
    async def test_cpu_sustained_breach_creates_alert(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """CPU at 90% for 3 heartbeats should create HIGH alert (AC4)."""
        service = AlertingService(db_session)

        # First two heartbeats - no alert
        for _ in range(2):
            events = await service.evaluate_heartbeat(
                server_id=test_server.id,
                server_name=test_server.display_name,
                cpu_percent=90.0,
                memory_percent=50.0,
                disk_percent=50.0,
                thresholds=default_thresholds,
                notifications=default_notifications,
            )
            await db_session.commit()
            cpu_events = [e for e in events if e.metric_type == "cpu" and not e.is_resolved]
            assert len(cpu_events) == 0

        # Third heartbeat - alert created
        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=90.0,
            memory_percent=50.0,
            disk_percent=50.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        cpu_events = [e for e in events if e.metric_type == "cpu" and not e.is_resolved]
        assert len(cpu_events) == 1
        assert cpu_events[0].severity == "high"

    @pytest.mark.asyncio
    async def test_cpu_spike_then_drop_resets_count(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """CPU spike followed by drop should reset breach count (AC6)."""
        service = AlertingService(db_session)

        # Two heartbeats above threshold
        for _ in range(2):
            await service.evaluate_heartbeat(
                server_id=test_server.id,
                server_name=test_server.display_name,
                cpu_percent=90.0,
                memory_percent=50.0,
                disk_percent=50.0,
                thresholds=default_thresholds,
                notifications=default_notifications,
            )
            await db_session.commit()

        # Drop below threshold
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=50.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Two more heartbeats above threshold - should NOT alert (count reset)
        for _ in range(2):
            events = await service.evaluate_heartbeat(
                server_id=test_server.id,
                server_name=test_server.display_name,
                cpu_percent=90.0,
                memory_percent=50.0,
                disk_percent=50.0,
                thresholds=default_thresholds,
                notifications=default_notifications,
            )
            await db_session.commit()
            cpu_events = [e for e in events if e.metric_type == "cpu" and not e.is_resolved]
            assert len(cpu_events) == 0

    @pytest.mark.asyncio
    async def test_memory_sustained_creates_alert(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Memory at 87% for 3 heartbeats should create HIGH alert (AC3)."""
        service = AlertingService(db_session)

        # First two heartbeats
        for _ in range(2):
            await service.evaluate_heartbeat(
                server_id=test_server.id,
                server_name=test_server.display_name,
                cpu_percent=50.0,
                memory_percent=87.0,
                disk_percent=50.0,
                thresholds=default_thresholds,
                notifications=default_notifications,
            )
            await db_session.commit()

        # Third heartbeat
        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=87.0,
            disk_percent=50.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        memory_events = [e for e in events if e.metric_type == "memory" and not e.is_resolved]
        assert len(memory_events) == 1
        assert memory_events[0].severity == "high"


class TestSeverityEscalation:
    """Test alert severity escalation."""

    @pytest.mark.asyncio
    async def test_disk_escalates_to_critical(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Disk alert should escalate from HIGH to CRITICAL (AC8)."""
        service = AlertingService(db_session)

        # Create HIGH alert at 82%
        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=82.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        disk_events = [e for e in events if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events) == 1
        assert disk_events[0].severity == "high"

        # Escalate to CRITICAL at 96%
        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=96.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        disk_events = [e for e in events if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events) == 1
        assert disk_events[0].severity == "critical"


class TestAutoResolve:
    """Test auto-resolve behaviour."""

    @pytest.mark.asyncio
    async def test_disk_auto_resolves_below_threshold(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Disk alert should auto-resolve when below threshold (AC2)."""
        service = AlertingService(db_session)

        # Create alert at 85%
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=85.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Drop to 75% - should resolve
        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=75.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        resolved_events = [e for e in events if e.is_resolved and e.metric_type == "disk"]
        assert len(resolved_events) == 1
        assert resolved_events[0].current_value == 75.0

    @pytest.mark.asyncio
    async def test_resolved_event_includes_duration(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Resolved event should include duration in minutes."""
        service = AlertingService(db_session)

        # Create alert
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=85.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Resolve
        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=75.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        resolved_events = [e for e in events if e.is_resolved]
        assert len(resolved_events) == 1
        # Duration should be set (may be 0 since we're in the same second)
        assert resolved_events[0].duration_minutes is not None


class TestDeduplication:
    """Test alert deduplication."""

    @pytest.mark.asyncio
    async def test_no_duplicate_alerts(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Same threshold breach should not create duplicate alerts (AC1)."""
        service = AlertingService(db_session)

        # Create first alert
        events1 = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=85.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        disk_events1 = [e for e in events1 if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events1) == 1

        # Second heartbeat - no new alert (within cooldown)
        events2 = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=85.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        disk_events2 = [e for e in events2 if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events2) == 0  # No new alert

    @pytest.mark.asyncio
    async def test_new_alert_after_resolution(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """New alert should be created after previous was resolved (AC4)."""
        service = AlertingService(db_session)

        # Create and resolve alert
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=85.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=75.0,  # Resolve
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        # New breach should create new alert
        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=85.0,  # Breach again
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        disk_events = [e for e in events if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events) == 1


class TestCooldowns:
    """Test notification cooldown behaviour."""

    @pytest.mark.asyncio
    async def test_no_renotify_within_cooldown(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Should not re-notify within cooldown period (AC8)."""
        service = AlertingService(db_session)

        # Create alert
        events1 = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=96.0,  # Critical
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        assert len([e for e in events1 if e.metric_type == "disk" and not e.is_resolved]) == 1

        # Immediate subsequent heartbeat - no re-notification
        events2 = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=96.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        disk_events = [e for e in events2 if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events) == 0  # No re-notification


class TestOfflineAlerts:
    """Test offline alert behaviour."""

    @pytest.mark.asyncio
    async def test_offline_alert_created(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Offline alert should be created for offline server (AC7)."""
        service = AlertingService(db_session)

        event = await service.trigger_offline_alert(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cooldowns=default_notifications.cooldowns,
        )

        assert event is not None
        assert event.metric_type == "offline"
        assert event.severity == "critical"
        assert event.is_reminder is False

    @pytest.mark.asyncio
    async def test_offline_alert_resolves_on_heartbeat(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Offline alert should resolve when heartbeat received (AC5)."""
        service = AlertingService(db_session)

        # Create offline alert
        await service.trigger_offline_alert(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cooldowns=default_notifications.cooldowns,
        )
        await db_session.commit()

        # Heartbeat received - should resolve
        events = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=50.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        offline_resolved = [e for e in events if e.metric_type == "offline" and e.is_resolved]
        assert len(offline_resolved) == 1


class TestConfigSchemaValidation:
    """Test configuration schema validation."""

    def test_metric_threshold_critical_must_exceed_high(self) -> None:
        """Critical percent must be greater than high percent."""
        with pytest.raises(ValueError, match="critical_percent must be greater"):
            MetricThreshold(high_percent=90, critical_percent=85, sustained_heartbeats=0)

    def test_metric_threshold_equal_values_invalid(self) -> None:
        """Critical percent cannot equal high percent."""
        with pytest.raises(ValueError, match="critical_percent must be greater"):
            MetricThreshold(high_percent=90, critical_percent=90, sustained_heartbeats=0)

    def test_metric_threshold_valid_config(self) -> None:
        """Valid threshold configuration should succeed."""
        threshold = MetricThreshold(high_percent=85, critical_percent=95, sustained_heartbeats=3)
        assert threshold.high_percent == 85
        assert threshold.critical_percent == 95
        assert threshold.sustained_heartbeats == 3


class TestAlertRecordCreation:
    """Test persistent Alert record creation (US0011).

    These tests verify that Alert records are created in the database
    when threshold breaches occur, complementing the AlertState tracking.
    """

    @pytest.mark.asyncio
    async def test_disk_alert_creates_record(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Disk breach should create persistent Alert record (AC1)."""
        from sqlalchemy import select

        from homelab_cmd.db.models.alert import Alert, AlertStatus

        service = AlertingService(db_session)

        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=82.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Verify Alert record created
        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alerts = list(result.scalars().all())

        assert len(alerts) == 1
        alert = alerts[0]
        assert alert.alert_type == "disk"
        assert alert.severity == "high"
        assert alert.status == AlertStatus.OPEN.value
        assert alert.actual_value == 82.0
        assert alert.threshold_value == 80.0  # High threshold
        assert "82%" in alert.title
        assert test_server.display_name in alert.title

    @pytest.mark.asyncio
    async def test_cpu_sustained_creates_record(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """CPU breach sustained for 3 heartbeats creates Alert record (AC4)."""
        from sqlalchemy import select

        from homelab_cmd.db.models.alert import Alert

        service = AlertingService(db_session)

        # First two heartbeats - no Alert yet
        for _ in range(2):
            await service.evaluate_heartbeat(
                server_id=test_server.id,
                server_name=test_server.display_name,
                cpu_percent=90.0,
                memory_percent=50.0,
                disk_percent=50.0,
                thresholds=default_thresholds,
                notifications=default_notifications,
            )
            await db_session.commit()

        # Verify no Alert record yet
        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alerts = list(result.scalars().all())
        assert len(alerts) == 0

        # Third heartbeat - Alert created
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=90.0,
            memory_percent=50.0,
            disk_percent=50.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alerts = list(result.scalars().all())
        assert len(alerts) == 1
        assert alerts[0].alert_type == "cpu"
        assert alerts[0].severity == "high"

    @pytest.mark.asyncio
    async def test_alert_record_resolved_on_auto_resolve(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Alert record should be resolved when metric drops below threshold."""
        from sqlalchemy import select

        from homelab_cmd.db.models.alert import Alert, AlertStatus

        service = AlertingService(db_session)

        # Create alert
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=85.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Verify open
        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alert = result.scalar_one()
        assert alert.status == AlertStatus.OPEN.value

        # Drop below threshold - should resolve
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=70.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Refresh and verify resolved
        await db_session.refresh(alert)
        assert alert.status == AlertStatus.RESOLVED.value
        assert alert.auto_resolved is True
        assert alert.resolved_at is not None

    @pytest.mark.asyncio
    async def test_alert_record_escalated(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Alert record severity should escalate from HIGH to CRITICAL (AC8)."""
        from sqlalchemy import select

        from homelab_cmd.db.models.alert import Alert

        service = AlertingService(db_session)

        # Create HIGH alert at 82%
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=82.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alert = result.scalar_one()
        assert alert.severity == "high"

        # Escalate to CRITICAL at 96%
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=96.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Refresh and verify escalated
        await db_session.refresh(alert)
        assert alert.severity == "critical"
        assert alert.actual_value == 96.0
        assert alert.threshold_value == 95.0  # Critical threshold

    @pytest.mark.asyncio
    async def test_offline_alert_creates_record(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Offline server should create Alert record (AC7)."""
        from sqlalchemy import select

        from homelab_cmd.db.models.alert import Alert, AlertStatus

        service = AlertingService(db_session)

        await service.trigger_offline_alert(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cooldowns=default_notifications.cooldowns,
        )
        await db_session.commit()

        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alerts = list(result.scalars().all())

        assert len(alerts) == 1
        alert = alerts[0]
        assert alert.alert_type == "offline"
        assert alert.severity == "critical"
        assert alert.status == AlertStatus.OPEN.value
        assert "offline" in alert.title.lower()

    @pytest.mark.asyncio
    async def test_offline_alert_resolved_on_heartbeat(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Offline Alert record should resolve when heartbeat received."""
        from sqlalchemy import select

        from homelab_cmd.db.models.alert import Alert, AlertStatus

        service = AlertingService(db_session)

        # Create offline alert
        await service.trigger_offline_alert(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cooldowns=default_notifications.cooldowns,
        )
        await db_session.commit()

        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alert = result.scalar_one()
        assert alert.status == AlertStatus.OPEN.value

        # Heartbeat received - should resolve
        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=50.0,
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        await db_session.refresh(alert)
        assert alert.status == AlertStatus.RESOLVED.value
        assert alert.auto_resolved is True

    @pytest.mark.asyncio
    async def test_alert_record_contains_threshold_values(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Alert record should contain both threshold and actual values."""
        from sqlalchemy import select

        from homelab_cmd.db.models.alert import Alert

        service = AlertingService(db_session)

        await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=96.0,  # Critical
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alert = result.scalar_one()

        assert alert.actual_value == 96.0
        assert alert.threshold_value == 95.0  # Critical threshold
        assert alert.message is not None
        assert "96" in alert.message
        assert "95" in alert.message


# =============================================================================
# Cooldown Expiry Re-notification Tests
# =============================================================================


class TestCooldownExpiryRenotification:
    """Test re-notification when cooldown period expires."""

    @pytest.mark.asyncio
    async def test_offline_alert_renotifies_after_cooldown_expires(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Offline alert should re-notify when cooldown expires (reminder)."""
        from datetime import UTC, datetime, timedelta

        from homelab_cmd.db.models.alert_state import AlertState

        service = AlertingService(db_session)

        # Create initial offline alert
        event1 = await service.trigger_offline_alert(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cooldowns=default_notifications.cooldowns,
        )
        await db_session.commit()

        assert event1 is not None
        assert event1.is_reminder is False

        # Manually set last_notified_at to be older than cooldown (30 min for critical)
        from sqlalchemy import select

        result = await db_session.execute(
            select(AlertState).where(
                AlertState.server_id == test_server.id,
                AlertState.metric_type == "offline",
            )
        )
        state = result.scalar_one()
        state.last_notified_at = datetime.now(UTC) - timedelta(minutes=35)
        await db_session.commit()

        # Trigger another offline check - should re-notify
        event2 = await service.trigger_offline_alert(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cooldowns=default_notifications.cooldowns,
        )

        assert event2 is not None
        assert event2.is_reminder is True
        assert event2.metric_type == "offline"
        assert event2.severity == "critical"

    @pytest.mark.asyncio
    async def test_metric_alert_renotifies_after_cooldown_expires(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_thresholds: ThresholdsConfig,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Metric alert should re-notify when cooldown expires (reminder)."""
        from datetime import UTC, datetime, timedelta

        from homelab_cmd.db.models.alert_state import AlertState

        service = AlertingService(db_session)

        # Create initial disk alert
        events1 = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=96.0,  # Critical
            thresholds=default_thresholds,
            notifications=default_notifications,
        )
        await db_session.commit()

        disk_events = [e for e in events1 if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events) == 1
        assert disk_events[0].is_reminder is False

        # Manually set last_notified_at to be older than cooldown (30 min for critical)
        from sqlalchemy import select

        result = await db_session.execute(
            select(AlertState).where(
                AlertState.server_id == test_server.id,
                AlertState.metric_type == "disk",
            )
        )
        state = result.scalar_one()
        state.last_notified_at = datetime.now(UTC) - timedelta(minutes=35)
        await db_session.commit()

        # Send another heartbeat with same critical value - should re-notify
        events2 = await service.evaluate_heartbeat(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cpu_percent=50.0,
            memory_percent=50.0,
            disk_percent=96.0,  # Still critical
            thresholds=default_thresholds,
            notifications=default_notifications,
        )

        disk_events2 = [e for e in events2 if e.metric_type == "disk" and not e.is_resolved]
        assert len(disk_events2) == 1
        assert disk_events2[0].is_reminder is True
        assert disk_events2[0].severity == "critical"

    @pytest.mark.asyncio
    async def test_no_renotify_within_cooldown_period(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Should not re-notify if still within cooldown period."""
        from datetime import UTC, datetime, timedelta

        from homelab_cmd.db.models.alert_state import AlertState

        service = AlertingService(db_session)

        # Create initial offline alert
        event1 = await service.trigger_offline_alert(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cooldowns=default_notifications.cooldowns,
        )
        await db_session.commit()

        assert event1 is not None

        # Set last_notified_at to 10 minutes ago (within 30 min cooldown)
        from sqlalchemy import select

        result = await db_session.execute(
            select(AlertState).where(
                AlertState.server_id == test_server.id,
                AlertState.metric_type == "offline",
            )
        )
        state = result.scalar_one()
        state.last_notified_at = datetime.now(UTC) - timedelta(minutes=10)
        await db_session.commit()

        # Trigger another offline check - should NOT re-notify
        event2 = await service.trigger_offline_alert(
            server_id=test_server.id,
            server_name=test_server.display_name,
            cooldowns=default_notifications.cooldowns,
        )

        assert event2 is None  # No notification within cooldown


# =============================================================================
# BG0022: SQL LIKE Pattern Wildcard Escape Tests
# =============================================================================


class TestSQLLikePatternEscape:
    """Test SQL LIKE wildcard escaping in service name searches (BG0022).

    These tests verify that SQL LIKE wildcards (% and _) in service names
    are properly escaped and do not match unintended alerts.

    Spec Reference: sdlc-studio/bugs/BG0022-sql-like-pattern-vulnerability.md
    """

    @pytest.mark.asyncio
    async def test_percent_in_service_name_does_not_match_wildcards(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Service name with % should not match as SQL wildcard (TC-BG0022-01).

        If a service is named "%admin%", it should only match alerts
        with literal "%admin%" in the title, not all alerts containing "admin".
        """
        service = AlertingService(db_session)

        # Create a service alert for "nginx" (does NOT contain "%admin%")
        await service._create_service_alert_record(
            server_id=test_server.id,
            server_name=test_server.display_name,
            service_name="nginx",
            status="stopped",
            severity="high",
        )
        await db_session.commit()

        # Create a service alert for a service that literally contains "%admin%"
        await service._create_service_alert_record(
            server_id=test_server.id,
            server_name=test_server.display_name,
            service_name="%admin%",
            status="stopped",
            severity="high",
        )
        await db_session.commit()

        # Query using _has_open_service_alert with "%admin%" as service name
        # If escaping works, it should ONLY match the literal "%admin%" alert
        # and NOT the "nginx" alert (which would match unescaped LIKE '%admin%')
        has_admin_alert = await service._has_open_service_alert(
            server_id=test_server.id,
            service_name="%admin%",
        )

        # Should find the literal "%admin%" service alert
        assert has_admin_alert is True

        # Verify that searching for a non-existent service with % doesn't
        # accidentally match other services
        has_fake_alert = await service._has_open_service_alert(
            server_id=test_server.id,
            service_name="%nginx%",  # Would match "nginx" if not escaped
        )

        # Should NOT find any alert (no service literally named "%nginx%")
        assert has_fake_alert is False

    @pytest.mark.asyncio
    async def test_underscore_in_service_name_does_not_match_wildcards(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Service name with _ should not match as SQL wildcard (TC-BG0022-02).

        If a service is named "my_service", the underscore should be literal,
        not match any single character like SQL LIKE would interpret it.
        """
        from sqlalchemy import select

        from homelab_cmd.db.models.alert import Alert, AlertStatus

        service = AlertingService(db_session)

        # Create alert for "myXservice" (X is any character)
        await service._create_service_alert_record(
            server_id=test_server.id,
            server_name=test_server.display_name,
            service_name="myXservice",
            status="stopped",
            severity="high",
        )
        await db_session.commit()

        # Create alert for literal "my_service"
        await service._create_service_alert_record(
            server_id=test_server.id,
            server_name=test_server.display_name,
            service_name="my_service",
            status="stopped",
            severity="high",
        )
        await db_session.commit()

        # Search for "my_service" - should only match literal underscore
        # Without escaping, _ would match any character including X
        has_underscore_alert = await service._has_open_service_alert(
            server_id=test_server.id,
            service_name="my_service",
        )
        assert has_underscore_alert is True

        # Verify count of open alerts
        result = await db_session.execute(
            select(Alert)
            .where(Alert.server_id == test_server.id)
            .where(Alert.status == AlertStatus.OPEN.value)
        )
        alerts = list(result.scalars().all())

        # Should have exactly 2 alerts (myXservice and my_service)
        assert len(alerts) == 2

    @pytest.mark.asyncio
    async def test_resolve_service_alert_with_wildcards_in_name(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Resolving service alert with wildcards should only resolve exact match.

        The _resolve_service_alert_record method uses .contains() which must
        escape wildcards to avoid resolving the wrong alert.
        """
        from sqlalchemy import select

        from homelab_cmd.db.models.alert import Alert, AlertStatus

        service = AlertingService(db_session)

        # Create two service alerts with similar names
        await service._create_service_alert_record(
            server_id=test_server.id,
            server_name=test_server.display_name,
            service_name="db_backup",
            status="stopped",
            severity="high",
        )
        await db_session.commit()

        await service._create_service_alert_record(
            server_id=test_server.id,
            server_name=test_server.display_name,
            service_name="db%backup",  # Contains % wildcard
            status="stopped",
            severity="high",
        )
        await db_session.commit()

        # Resolve only the "db%backup" service
        resolved = await service._resolve_service_alert_record(
            server_id=test_server.id,
            service_name="db%backup",
        )
        await db_session.commit()

        assert resolved is not None

        # Verify db_backup is still open (not accidentally resolved)
        result = await db_session.execute(
            select(Alert)
            .where(Alert.server_id == test_server.id)
            .where(Alert.status == AlertStatus.OPEN.value)
        )
        open_alerts = list(result.scalars().all())

        # Should have exactly 1 open alert (db_backup)
        assert len(open_alerts) == 1
        assert "db_backup" in open_alerts[0].title
        assert "db%backup" not in open_alerts[0].title
