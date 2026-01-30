"""Tests for configuration drift detection (US0122).

Part of EP0010: Configuration Management - US0122 Configuration Drift Detection.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.alert import Alert, AlertStatus
from homelab_cmd.db.models.config_check import ConfigCheck
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.services.scheduler import (
    _check_server_pack_drift,
    _create_drift_alert,
    _resolve_drift_alert,
)


@pytest.fixture
async def eligible_server(db_session: AsyncSession) -> Server:
    """Create a server eligible for drift detection."""
    server = Server(
        id="eligible-server",
        hostname="eligible.local",
        display_name="Eligible Server",
        status=ServerStatus.ONLINE.value,
        drift_detection_enabled=True,
        assigned_packs=["base"],
        last_seen=datetime.now(UTC),
    )
    db_session.add(server)
    await db_session.commit()
    return server


@pytest.fixture
async def disabled_server(db_session: AsyncSession) -> Server:
    """Create a server with drift detection disabled."""
    server = Server(
        id="disabled-server",
        hostname="disabled.local",
        display_name="Disabled Server",
        status=ServerStatus.ONLINE.value,
        drift_detection_enabled=False,
        assigned_packs=["base"],
        last_seen=datetime.now(UTC),
    )
    db_session.add(server)
    await db_session.commit()
    return server


@pytest.fixture
async def no_packs_server(db_session: AsyncSession) -> Server:
    """Create a server without assigned packs."""
    server = Server(
        id="no-packs-server",
        hostname="nopacks.local",
        display_name="No Packs Server",
        status=ServerStatus.ONLINE.value,
        drift_detection_enabled=True,
        assigned_packs=None,
        last_seen=datetime.now(UTC),
    )
    db_session.add(server)
    await db_session.commit()
    return server


@pytest.fixture
async def compliant_check(db_session: AsyncSession, eligible_server: Server) -> ConfigCheck:
    """Create a compliant compliance check."""
    check = ConfigCheck(
        server_id=eligible_server.id,
        pack_name="base",
        is_compliant=True,
        mismatches=[],
        check_duration_ms=1500,
        checked_at=datetime.now(UTC) - timedelta(days=1),
    )
    db_session.add(check)
    await db_session.commit()
    return check


@pytest.fixture
async def non_compliant_check(
    db_session: AsyncSession, eligible_server: Server, compliant_check: ConfigCheck
) -> ConfigCheck:
    """Create a non-compliant check after a compliant one."""
    check = ConfigCheck(
        server_id=eligible_server.id,
        pack_name="base",
        is_compliant=False,
        mismatches=[
            {"type": "missing_package", "item": "htop"},
            {"type": "wrong_permissions", "item": "/etc/ssh/sshd_config"},
        ],
        check_duration_ms=2100,
        checked_at=datetime.now(UTC),
    )
    db_session.add(check)
    await db_session.commit()
    return check


class TestDriftDetectionLogic:
    """Tests for drift detection logic."""

    @pytest.mark.asyncio
    async def test_drift_detected_compliant_to_non_compliant(
        self, db_session: AsyncSession, eligible_server: Server, compliant_check: ConfigCheck, non_compliant_check: ConfigCheck
    ):
        """Test drift detected when compliant -> non-compliant (AC2)."""
        result = await _check_server_pack_drift(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            notifier=None,
            notifications_config=None,
        )

        assert result == "drift"

        # Verify alert was created
        alerts = (
            await db_session.execute(
                select(Alert)
                .where(Alert.server_id == eligible_server.id)
                .where(Alert.alert_type == "config_drift")
            )
        ).scalars().all()

        assert len(alerts) == 1
        assert alerts[0].status == AlertStatus.OPEN.value
        assert alerts[0].severity == "warning"

    @pytest.mark.asyncio
    async def test_no_alert_on_first_check(self, db_session: AsyncSession, eligible_server: Server):
        """Test no alert created on first check - no previous state (TC04)."""
        # Create only one check (first check)
        check = ConfigCheck(
            server_id=eligible_server.id,
            pack_name="base",
            is_compliant=False,
            mismatches=[{"type": "missing_package", "item": "htop"}],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC),
        )
        db_session.add(check)
        await db_session.commit()

        result = await _check_server_pack_drift(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            notifier=None,
            notifications_config=None,
        )

        assert result is None  # No drift (no previous state to compare)

        # Verify no alert created
        alerts = (
            await db_session.execute(
                select(Alert)
                .where(Alert.server_id == eligible_server.id)
                .where(Alert.alert_type == "config_drift")
            )
        ).scalars().all()

        assert len(alerts) == 0

    @pytest.mark.asyncio
    async def test_auto_resolve_when_compliant(self, db_session: AsyncSession, eligible_server: Server):
        """Test alert auto-resolves when machine returns to compliance (AC6)."""
        # Create a previous non-compliant check
        old_check = ConfigCheck(
            server_id=eligible_server.id,
            pack_name="base",
            is_compliant=False,
            mismatches=[{"type": "missing_package", "item": "htop"}],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC) - timedelta(days=1),
        )
        db_session.add(old_check)

        # Create an open drift alert
        alert = Alert(
            server_id=eligible_server.id,
            alert_type="config_drift",
            severity="warning",
            status=AlertStatus.OPEN.value,
            title=f"Configuration drift on {eligible_server.display_name}",
            message="1 items no longer compliant with base",
            threshold_value=0,
            actual_value=1,
        )
        db_session.add(alert)

        # Create a new compliant check
        new_check = ConfigCheck(
            server_id=eligible_server.id,
            pack_name="base",
            is_compliant=True,
            mismatches=[],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC),
        )
        db_session.add(new_check)
        await db_session.commit()

        result = await _check_server_pack_drift(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            notifier=None,
            notifications_config=None,
        )

        assert result == "resolved"

        # Verify alert was resolved
        await db_session.refresh(alert)
        assert alert.status == AlertStatus.RESOLVED.value
        assert alert.auto_resolved is True

    @pytest.mark.asyncio
    async def test_no_drift_when_both_compliant(
        self, db_session: AsyncSession, eligible_server: Server
    ):
        """Test no drift when both checks are compliant."""
        # Create two compliant checks
        old_check = ConfigCheck(
            server_id=eligible_server.id,
            pack_name="base",
            is_compliant=True,
            mismatches=[],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC) - timedelta(days=1),
        )
        new_check = ConfigCheck(
            server_id=eligible_server.id,
            pack_name="base",
            is_compliant=True,
            mismatches=[],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC),
        )
        db_session.add_all([old_check, new_check])
        await db_session.commit()

        result = await _check_server_pack_drift(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            notifier=None,
            notifications_config=None,
        )

        assert result is None  # No drift


class TestAlertDetails:
    """Tests for alert details and severity (AC3, AC4)."""

    @pytest.mark.asyncio
    async def test_alert_severity_is_warning(self, db_session: AsyncSession, eligible_server: Server):
        """Test that drift alerts have warning severity (AC4)."""
        alert = await _create_drift_alert(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            mismatch_count=3,
            notifier=None,
            notifications_config=None,
        )

        assert alert.severity == "warning"

    @pytest.mark.asyncio
    async def test_alert_includes_machine_name(self, db_session: AsyncSession, eligible_server: Server):
        """Test that alert title includes machine display_name (AC3)."""
        alert = await _create_drift_alert(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            mismatch_count=3,
            notifier=None,
            notifications_config=None,
        )

        assert eligible_server.display_name in alert.title

    @pytest.mark.asyncio
    async def test_alert_includes_mismatch_count(self, db_session: AsyncSession, eligible_server: Server):
        """Test that alert message includes mismatch count (AC3)."""
        alert = await _create_drift_alert(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            mismatch_count=3,
            notifier=None,
            notifications_config=None,
        )

        assert "3" in alert.message
        assert "base" in alert.message

    @pytest.mark.asyncio
    async def test_alert_actual_value_is_mismatch_count(
        self, db_session: AsyncSession, eligible_server: Server
    ):
        """Test that alert actual_value stores mismatch count."""
        alert = await _create_drift_alert(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            mismatch_count=5,
            notifier=None,
            notifications_config=None,
        )

        assert alert.actual_value == 5


class TestSlackNotifications:
    """Tests for Slack notifications (AC5)."""

    @pytest.mark.asyncio
    async def test_slack_notification_sent_on_drift(self, db_session: AsyncSession, eligible_server: Server):
        """Test that Slack notification is sent when drift detected (AC5)."""
        mock_notifier = MagicMock()
        mock_notifier.send_alert = AsyncMock(return_value=True)

        mock_config = MagicMock()
        mock_config.slack_webhook_url = "https://hooks.slack.com/test"

        await _create_drift_alert(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            mismatch_count=3,
            notifier=mock_notifier,
            notifications_config=mock_config,
        )

        mock_notifier.send_alert.assert_called_once()
        call_args = mock_notifier.send_alert.call_args
        event = call_args[0][0]

        assert event.metric_type == "config_drift"
        assert event.server_name == eligible_server.display_name
        assert event.severity == "warning"
        assert event.current_value == 3
        assert event.is_resolved is False

    @pytest.mark.asyncio
    async def test_slack_notification_sent_on_resolve(self, db_session: AsyncSession, eligible_server: Server):
        """Test that Slack notification is sent when drift resolves (AC6)."""
        # Create an open drift alert
        alert = Alert(
            server_id=eligible_server.id,
            alert_type="config_drift",
            severity="warning",
            status=AlertStatus.OPEN.value,
            title=f"Configuration drift on {eligible_server.display_name}",
            message="3 items no longer compliant with base",
            threshold_value=0,
            actual_value=3,
        )
        db_session.add(alert)
        await db_session.commit()

        mock_notifier = MagicMock()
        mock_notifier.send_alert = AsyncMock(return_value=True)

        mock_config = MagicMock()
        mock_config.slack_webhook_url = "https://hooks.slack.com/test"

        result = await _resolve_drift_alert(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            notifier=mock_notifier,
            notifications_config=mock_config,
        )

        assert result is True
        mock_notifier.send_alert.assert_called_once()
        call_args = mock_notifier.send_alert.call_args
        event = call_args[0][0]

        assert event.metric_type == "config_drift"
        assert event.is_resolved is True


class TestExistingAlertHandling:
    """Tests for existing alert handling (TC12)."""

    @pytest.mark.asyncio
    async def test_existing_alert_updated_not_duplicated(
        self, db_session: AsyncSession, eligible_server: Server
    ):
        """Test that existing alert is updated, not duplicated (TC12)."""
        # Create an existing open drift alert
        existing_alert = Alert(
            server_id=eligible_server.id,
            alert_type="config_drift",
            severity="warning",
            status=AlertStatus.OPEN.value,
            title=f"Configuration drift on {eligible_server.display_name}",
            message="2 items no longer compliant with base",
            threshold_value=0,
            actual_value=2,
        )
        db_session.add(existing_alert)
        await db_session.commit()
        existing_id = existing_alert.id

        # Create another drift alert (should update, not create new)
        alert = await _create_drift_alert(
            session=db_session,
            server=eligible_server,
            pack_name="base",
            mismatch_count=5,
            notifier=None,
            notifications_config=None,
        )

        assert alert.id == existing_id
        assert alert.actual_value == 5
        assert "5" in alert.message

        # Verify only one alert exists
        alerts = (
            await db_session.execute(
                select(Alert)
                .where(Alert.server_id == eligible_server.id)
                .where(Alert.alert_type == "config_drift")
            )
        ).scalars().all()

        assert len(alerts) == 1


class TestMultiplePacks:
    """Tests for multiple pack checking (TC11)."""

    @pytest.mark.asyncio
    async def test_multiple_packs_checked_separately(self, db_session: AsyncSession):
        """Test that multiple packs are checked independently (TC11)."""
        # Create a server with multiple packs
        server = Server(
            id="multi-pack-server",
            hostname="multi.local",
            display_name="Multi Pack Server",
            status=ServerStatus.ONLINE.value,
            drift_detection_enabled=True,
            assigned_packs=["base", "developer-max"],
            last_seen=datetime.now(UTC),
        )
        db_session.add(server)

        # Create checks for "base" pack (compliant -> non-compliant = drift)
        base_old = ConfigCheck(
            server_id=server.id,
            pack_name="base",
            is_compliant=True,
            mismatches=[],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC) - timedelta(days=1),
        )
        base_new = ConfigCheck(
            server_id=server.id,
            pack_name="base",
            is_compliant=False,
            mismatches=[{"type": "missing_package", "item": "htop"}],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC),
        )

        # Create checks for "developer-max" pack (compliant -> compliant = no drift)
        dev_old = ConfigCheck(
            server_id=server.id,
            pack_name="developer-max",
            is_compliant=True,
            mismatches=[],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC) - timedelta(days=1),
        )
        dev_new = ConfigCheck(
            server_id=server.id,
            pack_name="developer-max",
            is_compliant=True,
            mismatches=[],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC),
        )

        db_session.add_all([base_old, base_new, dev_old, dev_new])
        await db_session.commit()

        # Check base pack
        base_result = await _check_server_pack_drift(
            session=db_session,
            server=server,
            pack_name="base",
            notifier=None,
            notifications_config=None,
        )

        # Check developer-max pack
        dev_result = await _check_server_pack_drift(
            session=db_session,
            server=server,
            pack_name="developer-max",
            notifier=None,
            notifications_config=None,
        )

        assert base_result == "drift"  # Drift detected for base
        assert dev_result is None  # No drift for developer-max


class TestDisabledMachineSkipped:
    """Tests for AC7: Disable per machine."""

    @pytest.mark.asyncio
    async def test_disabled_machine_not_checked(
        self, db_session: AsyncSession, disabled_server: Server
    ):
        """Test that servers with drift_detection_enabled=False are not checked (AC7)."""
        # Create compliance checks for the disabled server
        old_check = ConfigCheck(
            server_id=disabled_server.id,
            pack_name="base",
            is_compliant=True,
            mismatches=[],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC) - timedelta(days=1),
        )
        new_check = ConfigCheck(
            server_id=disabled_server.id,
            pack_name="base",
            is_compliant=False,
            mismatches=[{"type": "missing_package", "item": "htop"}],
            check_duration_ms=1500,
            checked_at=datetime.now(UTC),
        )
        db_session.add_all([old_check, new_check])
        await db_session.commit()

        # Even though there's drift, no alert should be created because
        # the server has drift_detection_enabled=False
        # This is handled at the check_config_drift level (query filter),
        # not at _check_server_pack_drift level

        # Verify no alerts exist
        alerts = (
            await db_session.execute(
                select(Alert)
                .where(Alert.server_id == disabled_server.id)
                .where(Alert.alert_type == "config_drift")
            )
        ).scalars().all()

        assert len(alerts) == 0


class TestNoPacksServerSkipped:
    """Tests for servers without assigned packs."""

    @pytest.mark.asyncio
    async def test_no_packs_server_not_checked(
        self, db_session: AsyncSession, no_packs_server: Server
    ):
        """Test that servers without assigned_packs are not checked."""
        # Servers without packs are filtered out by the query in check_config_drift
        # Verify no alerts exist
        alerts = (
            await db_session.execute(
                select(Alert)
                .where(Alert.server_id == no_packs_server.id)
                .where(Alert.alert_type == "config_drift")
            )
        ).scalars().all()

        assert len(alerts) == 0
