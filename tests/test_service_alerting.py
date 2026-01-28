"""Tests for Service Alert Evaluation (US0021: Service-Down Alert Generation).

These tests verify the service alerting logic including:
- Critical service stopped creates HIGH severity alert
- Non-critical service stopped creates MEDIUM severity alert
- Unconfigured services are ignored
- Disabled services are ignored
- Alert auto-resolves when service starts
- No duplicate alerts for same service
- Slack notification format includes service name

Spec References:
- sdlc-studio/stories/US0021-service-alerts.md
- sdlc-studio/plans/PL0025-service-alerts.md
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.schemas.config import (
    CooldownConfig,
    MetricThreshold,
    NotificationsConfig,
    ThresholdsConfig,
)
from homelab_cmd.api.schemas.heartbeat import ServiceStatusPayload
from homelab_cmd.db.models.alert import Alert, AlertStatus
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.db.models.service import ExpectedService
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


@pytest.fixture
async def critical_service(db_session: AsyncSession, test_server: Server) -> ExpectedService:
    """Create a critical expected service (plex)."""
    service = ExpectedService(
        server_id=test_server.id,
        service_name="plex",
        display_name="Plex Media Server",
        is_critical=True,
        enabled=True,
    )
    db_session.add(service)
    await db_session.commit()
    return service


@pytest.fixture
async def non_critical_service(db_session: AsyncSession, test_server: Server) -> ExpectedService:
    """Create a non-critical expected service (sonarr)."""
    service = ExpectedService(
        server_id=test_server.id,
        service_name="sonarr",
        display_name="Sonarr",
        is_critical=False,
        enabled=True,
    )
    db_session.add(service)
    await db_session.commit()
    return service


@pytest.fixture
async def disabled_service(db_session: AsyncSession, test_server: Server) -> ExpectedService:
    """Create a disabled expected service."""
    service = ExpectedService(
        server_id=test_server.id,
        service_name="radarr",
        display_name="Radarr",
        is_critical=False,
        enabled=False,
    )
    db_session.add(service)
    await db_session.commit()
    return service


class TestCriticalServiceAlert:
    """Test alerts for critical services (AC1)."""

    @pytest.mark.asyncio
    async def test_critical_service_stopped_creates_high_alert(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Critical service stopped should create HIGH severity alert (AC1)."""
        service = AlertingService(db_session)

        services = [
            ServiceStatusPayload(name="plex", status="stopped"),
        ]

        events = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )

        # Should have one service alert
        service_events = [
            e for e in events if e.metric_type.startswith("service:") and not e.is_resolved
        ]
        assert len(service_events) == 1
        assert service_events[0].severity == "high"
        assert "plex" in service_events[0].metric_type

    @pytest.mark.asyncio
    async def test_critical_service_failed_creates_high_alert(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Critical service failed should create HIGH severity alert."""
        service = AlertingService(db_session)

        services = [
            ServiceStatusPayload(name="plex", status="failed"),
        ]

        events = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )

        service_events = [
            e for e in events if e.metric_type.startswith("service:") and not e.is_resolved
        ]
        assert len(service_events) == 1
        assert service_events[0].severity == "high"


class TestNonCriticalServiceAlert:
    """Test alerts for non-critical services (AC2)."""

    @pytest.mark.asyncio
    async def test_non_critical_service_stopped_creates_medium_alert(
        self,
        db_session: AsyncSession,
        test_server: Server,
        non_critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Non-critical service stopped should create MEDIUM severity alert (AC2)."""
        service = AlertingService(db_session)

        services = [
            ServiceStatusPayload(name="sonarr", status="stopped"),
        ]

        events = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )

        service_events = [
            e for e in events if e.metric_type.startswith("service:") and not e.is_resolved
        ]
        assert len(service_events) == 1
        assert service_events[0].severity == "medium"
        assert "sonarr" in service_events[0].metric_type


class TestUnconfiguredServiceIgnored:
    """Test that unconfigured services are ignored (AC3)."""

    @pytest.mark.asyncio
    async def test_unconfigured_service_creates_no_alert(
        self,
        db_session: AsyncSession,
        test_server: Server,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Service not in expected_services should not create alert (AC3)."""
        service = AlertingService(db_session)

        services = [
            ServiceStatusPayload(name="unknown-service", status="stopped"),
        ]

        events = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )

        # Should have no alerts
        assert len(events) == 0


class TestDisabledServiceIgnored:
    """Test that disabled services are ignored (AC4)."""

    @pytest.mark.asyncio
    async def test_disabled_service_creates_no_alert(
        self,
        db_session: AsyncSession,
        test_server: Server,
        disabled_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Disabled service should not create alert (AC4)."""
        service = AlertingService(db_session)

        services = [
            ServiceStatusPayload(name="radarr", status="stopped"),
        ]

        events = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )

        # Should have no alerts
        assert len(events) == 0


class TestAlertIncludesServiceName:
    """Test that alerts include service name (AC5)."""

    @pytest.mark.asyncio
    async def test_alert_title_includes_service_name(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Alert title should contain the service name (AC5)."""
        service = AlertingService(db_session)

        services = [
            ServiceStatusPayload(name="plex", status="stopped"),
        ]

        await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Check Alert record
        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alerts = list(result.scalars().all())

        assert len(alerts) == 1
        assert "plex" in alerts[0].title.lower()
        assert alerts[0].alert_type == "service"


class TestServiceAlertAutoResolve:
    """Test service alert auto-resolve behaviour."""

    @pytest.mark.asyncio
    async def test_alert_auto_resolves_when_service_starts(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Alert should auto-resolve when service status is 'running'."""
        service = AlertingService(db_session)

        # Create alert - service stopped
        services_stopped = [
            ServiceStatusPayload(name="plex", status="stopped"),
        ]
        await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services_stopped,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Verify alert exists
        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alert = result.scalar_one()
        assert alert.status == AlertStatus.OPEN.value

        # Service starts - should resolve
        services_running = [
            ServiceStatusPayload(name="plex", status="running", pid=12345),
        ]
        events = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services_running,
            notifications=default_notifications,
        )
        await db_session.commit()

        # Should have resolved event
        resolved_events = [e for e in events if e.is_resolved]
        assert len(resolved_events) == 1
        assert "plex" in resolved_events[0].metric_type

        # Alert record should be resolved
        await db_session.refresh(alert)
        assert alert.status == AlertStatus.RESOLVED.value
        assert alert.auto_resolved is True


class TestServiceAlertDeduplication:
    """Test service alert deduplication."""

    @pytest.mark.asyncio
    async def test_no_duplicate_alerts_for_same_service(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Same service stopped should not create duplicate alerts."""
        service = AlertingService(db_session)

        services = [
            ServiceStatusPayload(name="plex", status="stopped"),
        ]

        # First heartbeat - creates alert
        events1 = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )
        await db_session.commit()

        service_events1 = [
            e for e in events1 if e.metric_type.startswith("service:") and not e.is_resolved
        ]
        assert len(service_events1) == 1

        # Second heartbeat - no new alert
        events2 = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )

        service_events2 = [
            e for e in events2 if e.metric_type.startswith("service:") and not e.is_resolved
        ]
        assert len(service_events2) == 0  # No new alert

    @pytest.mark.asyncio
    async def test_new_alert_after_resolution(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """New alert should be created after previous was resolved."""
        service = AlertingService(db_session)

        # Create alert
        await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=[ServiceStatusPayload(name="plex", status="stopped")],
            notifications=default_notifications,
        )
        await db_session.commit()

        # Resolve alert
        await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=[ServiceStatusPayload(name="plex", status="running", pid=123)],
            notifications=default_notifications,
        )
        await db_session.commit()

        # New breach should create new alert
        events = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=[ServiceStatusPayload(name="plex", status="stopped")],
            notifications=default_notifications,
        )

        service_events = [
            e for e in events if e.metric_type.startswith("service:") and not e.is_resolved
        ]
        assert len(service_events) == 1


class TestMultipleServices:
    """Test handling multiple services in single evaluation."""

    @pytest.mark.asyncio
    async def test_multiple_services_down_creates_multiple_alerts(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        non_critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Multiple services down should create one alert per service."""
        service = AlertingService(db_session)

        services = [
            ServiceStatusPayload(name="plex", status="stopped"),
            ServiceStatusPayload(name="sonarr", status="stopped"),
        ]

        events = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )

        service_events = [
            e for e in events if e.metric_type.startswith("service:") and not e.is_resolved
        ]
        assert len(service_events) == 2

        # Check severities match criticality
        plex_event = next(e for e in service_events if "plex" in e.metric_type)
        sonarr_event = next(e for e in service_events if "sonarr" in e.metric_type)
        assert plex_event.severity == "high"  # Critical service
        assert sonarr_event.severity == "medium"  # Non-critical service


class TestUnknownServiceStatus:
    """Test 'unknown' service status is ignored."""

    @pytest.mark.asyncio
    async def test_unknown_status_creates_no_alert(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Service with 'unknown' status should not create alert."""
        service = AlertingService(db_session)

        services = [
            ServiceStatusPayload(
                name="plex",
                status="unknown",
                status_reason="systemd not available (container)",
            ),
        ]

        events = await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=services,
            notifications=default_notifications,
        )

        # Should have no alerts for unknown status
        assert len(events) == 0


class TestServiceAlertRecordCreation:
    """Test persistent Alert record creation for service alerts."""

    @pytest.mark.asyncio
    async def test_service_alert_creates_record(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Service alert should create persistent Alert record."""
        service = AlertingService(db_session)

        await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=[ServiceStatusPayload(name="plex", status="stopped")],
            notifications=default_notifications,
        )
        await db_session.commit()

        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alerts = list(result.scalars().all())

        assert len(alerts) == 1
        alert = alerts[0]
        assert alert.alert_type == "service"
        assert alert.severity == "high"
        assert alert.status == AlertStatus.OPEN.value
        assert "plex" in alert.title.lower()
        assert "stopped" in alert.title.lower() or "stopped" in alert.message.lower()

    @pytest.mark.asyncio
    async def test_service_alert_record_resolved(
        self,
        db_session: AsyncSession,
        test_server: Server,
        critical_service: ExpectedService,
        default_notifications: NotificationsConfig,
    ) -> None:
        """Service Alert record should be resolved when service starts."""
        service = AlertingService(db_session)

        # Create alert
        await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=[ServiceStatusPayload(name="plex", status="stopped")],
            notifications=default_notifications,
        )
        await db_session.commit()

        # Resolve
        await service.evaluate_services(
            server_id=test_server.id,
            server_name=test_server.display_name,
            services=[ServiceStatusPayload(name="plex", status="running", pid=123)],
            notifications=default_notifications,
        )
        await db_session.commit()

        result = await db_session.execute(select(Alert).where(Alert.server_id == test_server.id))
        alert = result.scalar_one()

        assert alert.status == AlertStatus.RESOLVED.value
        assert alert.auto_resolved is True
        assert alert.resolved_at is not None
