"""Tests for Background Scheduler Service.

Coverage targets: Lines 77-84, 108-142 (alerting integration, offline reminders)
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.schemas.config import CooldownConfig, NotificationsConfig
from homelab_cmd.db.models.server import Server, ServerStatus

# =============================================================================
# Test check_stale_servers() with alerting - Lines 63-84
# =============================================================================


class TestCheckStaleServersWithAlerting:
    """Tests for check_stale_servers with notifications enabled."""

    @pytest.mark.asyncio
    async def test_triggers_alert_when_server_goes_offline(self, db_session: AsyncSession) -> None:
        """Triggers offline alert when server marked offline with notifications config."""
        # Create an online server that's stale
        stale_time = datetime.now(UTC) - timedelta(seconds=300)
        server = Server(
            id="stale-server",
            hostname="stale.local",
            display_name="Stale Server",
            status=ServerStatus.ONLINE.value,
            last_seen=stale_time,
        )
        db_session.add(server)
        await db_session.commit()

        notifications_config = NotificationsConfig(
            slack_webhook_url="https://hooks.slack.com/test",
            cooldowns=CooldownConfig(),
        )

        # Mock the alerting service and notifier
        mock_event = MagicMock()
        mock_event.is_reminder = False

        with (
            patch("homelab_cmd.services.scheduler.AlertingService") as mock_alerting_class,
            patch("homelab_cmd.services.scheduler.get_notifier") as mock_get_notifier,
            patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory,
        ):
            # Setup mocks
            mock_alerting = AsyncMock()
            mock_alerting.trigger_offline_alert.return_value = mock_event
            mock_alerting_class.return_value = mock_alerting

            mock_notifier = AsyncMock()
            mock_get_notifier.return_value = mock_notifier

            # Create mock session context manager
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import check_stale_servers

            count = await check_stale_servers(notifications_config)

            assert count == 1
            mock_alerting.trigger_offline_alert.assert_called_once()
            mock_notifier.send_alert.assert_called_once_with(mock_event, notifications_config)

    @pytest.mark.asyncio
    async def test_no_alert_when_no_notifications_config(self, db_session: AsyncSession) -> None:
        """Does not trigger alerts when notifications_config is None."""
        stale_time = datetime.now(UTC) - timedelta(seconds=300)
        server = Server(
            id="stale-server-2",
            hostname="stale2.local",
            status=ServerStatus.ONLINE.value,
            last_seen=stale_time,
        )
        db_session.add(server)
        await db_session.commit()

        with (
            patch("homelab_cmd.services.scheduler.AlertingService") as mock_alerting_class,
            patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory,
        ):
            mock_alerting = AsyncMock()
            mock_alerting_class.return_value = mock_alerting

            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import check_stale_servers

            count = await check_stale_servers(notifications_config=None)

            assert count == 1
            # Alerting service still created but no notifier
            mock_alerting.trigger_offline_alert.assert_not_called()


# =============================================================================
# Test check_offline_reminders() - Lines 108-142
# =============================================================================


class TestCheckOfflineReminders:
    """Tests for check_offline_reminders function."""

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_webhook(self) -> None:
        """Returns 0 when no Slack webhook configured."""
        notifications_config = NotificationsConfig(
            slack_webhook_url="",  # Empty string means no webhook
            cooldowns=CooldownConfig(),
        )

        from homelab_cmd.services.scheduler import check_offline_reminders

        count = await check_offline_reminders(notifications_config)

        assert count == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_offline_servers(self, db_session: AsyncSession) -> None:
        """Returns 0 when no servers are offline."""
        # Create only online servers
        server = Server(
            id="online-server",
            hostname="online.local",
            status=ServerStatus.ONLINE.value,
            last_seen=datetime.now(UTC),
        )
        db_session.add(server)
        await db_session.commit()

        notifications_config = NotificationsConfig(
            slack_webhook_url="https://hooks.slack.com/test",
            cooldowns=CooldownConfig(),
        )

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import check_offline_reminders

            count = await check_offline_reminders(notifications_config)

            assert count == 0

    @pytest.mark.asyncio
    async def test_sends_reminder_for_offline_server(self, db_session: AsyncSession) -> None:
        """Sends reminder notification for offline servers (Lines 126-135)."""
        server = Server(
            id="offline-server",
            hostname="offline.local",
            display_name="Offline Server",
            status=ServerStatus.OFFLINE.value,
            last_seen=datetime.now(UTC) - timedelta(hours=1),
        )
        db_session.add(server)
        await db_session.commit()

        notifications_config = NotificationsConfig(
            slack_webhook_url="https://hooks.slack.com/test",
            cooldowns=CooldownConfig(),
        )

        mock_event = MagicMock()
        mock_event.is_reminder = True

        with (
            patch("homelab_cmd.services.scheduler.AlertingService") as mock_alerting_class,
            patch("homelab_cmd.services.scheduler.get_notifier") as mock_get_notifier,
            patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory,
        ):
            mock_alerting = AsyncMock()
            mock_alerting.trigger_offline_alert.return_value = mock_event
            mock_alerting_class.return_value = mock_alerting

            mock_notifier = AsyncMock()
            mock_get_notifier.return_value = mock_notifier

            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import check_offline_reminders

            count = await check_offline_reminders(notifications_config)

            assert count == 1
            mock_alerting.trigger_offline_alert.assert_called_once()
            mock_notifier.send_alert.assert_called_once()

    @pytest.mark.asyncio
    async def test_no_reminder_when_not_due(self, db_session: AsyncSession) -> None:
        """Does not send reminder when cooldown not expired (event is None)."""
        server = Server(
            id="offline-server-2",
            hostname="offline2.local",
            status=ServerStatus.OFFLINE.value,
            last_seen=datetime.now(UTC) - timedelta(minutes=5),
        )
        db_session.add(server)
        await db_session.commit()

        notifications_config = NotificationsConfig(
            slack_webhook_url="https://hooks.slack.com/test",
            cooldowns=CooldownConfig(),
        )

        with (
            patch("homelab_cmd.services.scheduler.AlertingService") as mock_alerting_class,
            patch("homelab_cmd.services.scheduler.get_notifier") as mock_get_notifier,
            patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory,
        ):
            mock_alerting = AsyncMock()
            # Return None to indicate no reminder needed
            mock_alerting.trigger_offline_alert.return_value = None
            mock_alerting_class.return_value = mock_alerting

            mock_notifier = AsyncMock()
            mock_get_notifier.return_value = mock_notifier

            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import check_offline_reminders

            count = await check_offline_reminders(notifications_config)

            assert count == 0
            mock_notifier.send_alert.assert_not_called()

    @pytest.mark.asyncio
    async def test_no_reminder_when_event_not_reminder(self, db_session: AsyncSession) -> None:
        """Does not count as reminder when is_reminder is False."""
        server = Server(
            id="offline-server-3",
            hostname="offline3.local",
            status=ServerStatus.OFFLINE.value,
            last_seen=datetime.now(UTC) - timedelta(hours=1),
        )
        db_session.add(server)
        await db_session.commit()

        notifications_config = NotificationsConfig(
            slack_webhook_url="https://hooks.slack.com/test",
            cooldowns=CooldownConfig(),
        )

        mock_event = MagicMock()
        mock_event.is_reminder = False  # Not a reminder

        with (
            patch("homelab_cmd.services.scheduler.AlertingService") as mock_alerting_class,
            patch("homelab_cmd.services.scheduler.get_notifier") as mock_get_notifier,
            patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory,
        ):
            mock_alerting = AsyncMock()
            mock_alerting.trigger_offline_alert.return_value = mock_event
            mock_alerting_class.return_value = mock_alerting

            mock_notifier = AsyncMock()
            mock_get_notifier.return_value = mock_notifier

            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import check_offline_reminders

            count = await check_offline_reminders(notifications_config)

            # Event returned but not a reminder, so count is 0
            assert count == 0


# =============================================================================
# Test prune_old_metrics() - Line 180 (batch size break)
# =============================================================================


class TestPruneOldMetrics:
    """Tests for prune_old_metrics function."""

    @pytest.mark.asyncio
    async def test_breaks_loop_when_batch_smaller_than_limit(
        self, db_session: AsyncSession
    ) -> None:
        """Breaks loop when batch count is less than PRUNE_BATCH_SIZE (Line 180)."""
        from homelab_cmd.db.models.metrics import Metrics
        from homelab_cmd.db.models.server import Server

        # Create a server first
        server = Server(
            id="prune-test-server",
            hostname="prune.local",
            status=ServerStatus.ONLINE.value,
        )
        db_session.add(server)
        await db_session.commit()

        # Create some old metrics (older than 30 days)
        old_time = datetime.now(UTC) - timedelta(days=35)
        for _ in range(5):
            metric = Metrics(
                server_id="prune-test-server",
                timestamp=old_time,
                cpu_percent=50.0,
                memory_percent=60.0,
            )
            db_session.add(metric)
        await db_session.commit()

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import prune_old_metrics

            deleted = await prune_old_metrics()

            # Should have deleted 5 metrics and broken out of loop
            assert deleted == 5
