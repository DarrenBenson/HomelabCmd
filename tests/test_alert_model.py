"""Tests for Alert model (US0010: Alert Entity and Database Schema).

These tests verify the alerts table and model functionality.

Story Reference: sdlc-studio/stories/US0010-alert-schema.md
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.alert import Alert, AlertStatus, AlertType
from homelab_cmd.db.models.alert_state import AlertSeverity
from homelab_cmd.db.models.server import Server


class TestAlertTableExists:
    """AC1: Alert table exists with all required columns."""

    async def test_alerts_table_exists(self, db_session: AsyncSession) -> None:
        """Alerts table should exist in database schema."""
        result = await db_session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='alerts'")
        )
        table = result.scalar()
        assert table == "alerts"

    async def test_alerts_table_has_required_columns(self, db_session: AsyncSession) -> None:
        """Alerts table should have all required columns."""
        result = await db_session.execute(text("PRAGMA table_info(alerts)"))
        columns = result.fetchall()
        column_names = [col[1] for col in columns]

        required_columns = [
            "id",
            "server_id",
            "alert_type",
            "severity",
            "status",
            "title",
            "message",
            "threshold_value",
            "actual_value",
            "created_at",
            "updated_at",
            "acknowledged_at",
            "resolved_at",
            "auto_resolved",
        ]

        for col in required_columns:
            assert col in column_names, f"Column {col} not found in alerts table"


class TestAlertSeverityLevels:
    """AC2: Alert severity levels supported."""

    async def test_critical_severity_accepted(self, db_session: AsyncSession) -> None:
        """Critical severity should be accepted."""
        server = Server(id="sev-critical-server", hostname="test-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="sev-critical-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.CRITICAL.value,
            title="Critical disk alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.severity == "critical"

    async def test_high_severity_accepted(self, db_session: AsyncSession) -> None:
        """High severity should be accepted."""
        server = Server(id="sev-high-server", hostname="test-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="sev-high-server",
            alert_type=AlertType.MEMORY.value,
            severity=AlertSeverity.HIGH.value,
            title="High memory alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.severity == "high"

    async def test_medium_severity_accepted(self, db_session: AsyncSession) -> None:
        """Medium severity should be accepted."""
        server = Server(id="sev-medium-server", hostname="test-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="sev-medium-server",
            alert_type=AlertType.CPU.value,
            severity=AlertSeverity.MEDIUM.value,
            title="Medium CPU alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.severity == "medium"

    async def test_low_severity_accepted(self, db_session: AsyncSession) -> None:
        """Low severity should be accepted."""
        server = Server(id="sev-low-server", hostname="test-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="sev-low-server",
            alert_type=AlertType.OFFLINE.value,
            severity=AlertSeverity.LOW.value,
            title="Low severity alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.severity == "low"


class TestAlertStatusLifecycle:
    """AC3: Alert status lifecycle supported."""

    async def test_open_status_default(self, db_session: AsyncSession) -> None:
        """Status should default to 'open' when not specified."""
        server = Server(id="status-default-server", hostname="test-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="status-default-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            title="Default status alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.status == "open"

    async def test_acknowledged_status_accepted(self, db_session: AsyncSession) -> None:
        """Acknowledged status should be accepted."""
        server = Server(id="status-ack-server", hostname="test-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="status-ack-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            status=AlertStatus.ACKNOWLEDGED.value,
            title="Acknowledged alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.status == "acknowledged"

    async def test_resolved_status_accepted(self, db_session: AsyncSession) -> None:
        """Resolved status should be accepted."""
        server = Server(id="status-resolved-server", hostname="test-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="status-resolved-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            status=AlertStatus.RESOLVED.value,
            title="Resolved alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.status == "resolved"

    async def test_status_can_transition_open_to_acknowledged(
        self, db_session: AsyncSession
    ) -> None:
        """Status should transition from open to acknowledged."""
        server = Server(id="transition-ack-server", hostname="test-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="transition-ack-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            title="Transition alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.status == "open"

        alert.acknowledge()
        await db_session.commit()

        assert alert.status == "acknowledged"
        assert alert.acknowledged_at is not None

    async def test_status_can_transition_acknowledged_to_resolved(
        self, db_session: AsyncSession
    ) -> None:
        """Status should transition from acknowledged to resolved."""
        server = Server(id="transition-resolve-server", hostname="test-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="transition-resolve-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            status=AlertStatus.ACKNOWLEDGED.value,
            title="Transition to resolved alert",
        )
        db_session.add(alert)
        await db_session.commit()

        alert.resolve()
        await db_session.commit()

        assert alert.status == "resolved"
        assert alert.resolved_at is not None


class TestAlertServerRelationship:
    """AC4: Alerts link to servers."""

    async def test_alert_links_to_server(self, db_session: AsyncSession) -> None:
        """Alert should link to server via foreign key."""
        server = Server(
            id="link-test-server",
            hostname="link-test-server",
            display_name="Link Test Server",
        )
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="link-test-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            title="Linked alert",
        )
        db_session.add(alert)
        await db_session.commit()

        # Refresh to load relationship
        await db_session.refresh(alert)
        assert alert.server_id == "link-test-server"
        assert alert.server is not None
        assert alert.server.display_name == "Link Test Server"

    async def test_server_has_alerts_relationship(self, db_session: AsyncSession) -> None:
        """Server should have alerts relationship accessible."""
        server = Server(id="alerts-rel-server", hostname="alerts-rel-server")
        db_session.add(server)
        await db_session.commit()

        alert1 = Alert(
            server_id="alerts-rel-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            title="First alert",
        )
        alert2 = Alert(
            server_id="alerts-rel-server",
            alert_type=AlertType.MEMORY.value,
            severity=AlertSeverity.CRITICAL.value,
            title="Second alert",
        )
        db_session.add_all([alert1, alert2])
        await db_session.commit()

        # Query alerts count directly via SQL
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM alerts WHERE server_id = 'alerts-rel-server'")
        )
        alerts_count = result.scalar()
        assert alerts_count == 2


class TestAlertForeignKeyConstraint:
    """Foreign key constraint validation."""

    async def test_integrity_error_for_nonexistent_server(self, db_session: AsyncSession) -> None:
        """IntegrityError should be raised when server_id doesn't exist."""
        alert = Alert(
            server_id="nonexistent-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            title="Orphan alert",
        )
        db_session.add(alert)

        with pytest.raises(IntegrityError):
            await db_session.commit()


class TestAlertCascadeDelete:
    """Cascade delete removes alerts when server is deleted."""

    async def test_deleting_server_removes_associated_alerts(
        self, db_session: AsyncSession
    ) -> None:
        """Deleting a server should cascade delete its alerts."""
        server = Server(id="cascade-alert-server", hostname="cascade-alert-server")
        db_session.add(server)
        await db_session.commit()

        alert1 = Alert(
            server_id="cascade-alert-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            title="Cascade alert 1",
        )
        alert2 = Alert(
            server_id="cascade-alert-server",
            alert_type=AlertType.MEMORY.value,
            severity=AlertSeverity.CRITICAL.value,
            title="Cascade alert 2",
        )
        db_session.add_all([alert1, alert2])
        await db_session.commit()

        # Verify alerts exist
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM alerts WHERE server_id = 'cascade-alert-server'")
        )
        count = result.scalar()
        assert count == 2

        # Delete server
        await db_session.delete(server)
        await db_session.commit()

        # Verify alerts are gone
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM alerts WHERE server_id = 'cascade-alert-server'")
        )
        count = result.scalar()
        assert count == 0


class TestAlertIndices:
    """Alert indices for common queries."""

    async def test_server_status_index_exists(self, db_session: AsyncSession) -> None:
        """Index on (server_id, status) should exist."""
        result = await db_session.execute(text("PRAGMA index_list(alerts)"))
        indices = result.fetchall()
        index_names = [idx[1] for idx in indices]

        assert "idx_alerts_server_status" in index_names

    async def test_severity_status_index_exists(self, db_session: AsyncSession) -> None:
        """Index on (severity, status) should exist."""
        result = await db_session.execute(text("PRAGMA index_list(alerts)"))
        indices = result.fetchall()
        index_names = [idx[1] for idx in indices]

        assert "idx_alerts_severity_status" in index_names

    async def test_created_at_index_exists(self, db_session: AsyncSession) -> None:
        """Index on created_at should exist."""
        result = await db_session.execute(text("PRAGMA index_list(alerts)"))
        indices = result.fetchall()
        index_names = [idx[1] for idx in indices]

        assert "idx_alerts_created_at" in index_names


class TestAlertModel:
    """Additional Alert model functionality tests."""

    async def test_alert_with_metric_values(self, db_session: AsyncSession) -> None:
        """Alert should store threshold and actual values."""
        server = Server(id="metric-values-server", hostname="metric-values-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="metric-values-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            title="Disk usage high",
            message="Disk usage has exceeded 80% threshold",
            threshold_value=80.0,
            actual_value=85.5,
        )
        db_session.add(alert)
        await db_session.commit()

        await db_session.refresh(alert)
        assert alert.threshold_value == 80.0
        assert alert.actual_value == 85.5
        assert alert.message == "Disk usage has exceeded 80% threshold"

    async def test_auto_resolved_flag(self, db_session: AsyncSession) -> None:
        """Alert should track auto-resolved status."""
        server = Server(id="auto-resolve-server", hostname="auto-resolve-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="auto-resolve-server",
            alert_type=AlertType.MEMORY.value,
            severity=AlertSeverity.HIGH.value,
            title="Memory alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.auto_resolved is False

        alert.resolve(auto=True)
        await db_session.commit()

        assert alert.auto_resolved is True
        assert alert.status == "resolved"

    async def test_timestamps_auto_populated(self, db_session: AsyncSession) -> None:
        """created_at and updated_at should be auto-populated."""
        server = Server(id="timestamp-alert-server", hostname="timestamp-alert-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="timestamp-alert-server",
            alert_type=AlertType.CPU.value,
            severity=AlertSeverity.HIGH.value,
            title="Timestamp test alert",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.created_at is not None
        assert alert.updated_at is not None
        assert isinstance(alert.created_at, datetime)
        assert isinstance(alert.updated_at, datetime)

    async def test_is_open_property(self, db_session: AsyncSession) -> None:
        """is_open property should return correct value."""
        server = Server(id="is-open-server", hostname="is-open-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="is-open-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.HIGH.value,
            title="Open property test",
        )
        db_session.add(alert)
        await db_session.commit()

        assert alert.is_open is True
        assert alert.is_resolved is False

        alert.resolve()
        await db_session.commit()

        assert alert.is_open is False
        assert alert.is_resolved is True

    async def test_alert_type_values(self, db_session: AsyncSession) -> None:
        """All AlertType values should be accepted."""
        server = Server(id="alert-types-server", hostname="alert-types-server")
        db_session.add(server)
        await db_session.commit()

        for alert_type in AlertType:
            alert = Alert(
                server_id="alert-types-server",
                alert_type=alert_type.value,
                severity=AlertSeverity.HIGH.value,
                title=f"Alert type {alert_type.value}",
            )
            db_session.add(alert)
            await db_session.commit()

            assert alert.alert_type == alert_type.value

    async def test_alert_repr(self, db_session: AsyncSession) -> None:
        """Alert __repr__ should return readable string."""
        server = Server(id="repr-server", hostname="repr-server")
        db_session.add(server)
        await db_session.commit()

        alert = Alert(
            server_id="repr-server",
            alert_type=AlertType.DISK.value,
            severity=AlertSeverity.CRITICAL.value,
            title="Repr test",
        )
        db_session.add(alert)
        await db_session.commit()

        repr_str = repr(alert)
        assert "repr-server" in repr_str
        assert "disk" in repr_str
        assert "critical" in repr_str
        assert "open" in repr_str
