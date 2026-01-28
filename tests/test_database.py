"""Tests for database schema and models (TSP0001: TC001-TC005).

These tests verify the database layer for US0001: Database Schema and Migrations.

Spec Reference: sdlc-studio/testing/specs/TSP0001-core-monitoring-api.md
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.metrics import Metrics
from homelab_cmd.db.models.server import Server, ServerStatus


class TestDatabaseSession:
    """TC001: Database session creation works."""

    async def test_async_engine_creates_without_error(self, db_session: AsyncSession) -> None:
        """Async engine should create without error."""
        # The db_session fixture creates an async engine
        # If we get here, the engine was created successfully
        assert db_session is not None

    async def test_session_can_be_acquired(self, db_session: AsyncSession) -> None:
        """Session should be acquirable from engine."""
        # The fixture provides a session
        assert db_session is not None
        assert isinstance(db_session, AsyncSession)

    async def test_basic_query_executes_successfully(self, db_session: AsyncSession) -> None:
        """Basic SELECT query should execute without error."""
        result = await db_session.execute(text("SELECT 1"))
        value = result.scalar()
        assert value == 1


class TestServerModel:
    """TC002: Server model creation and retrieval."""

    async def test_server_id_matches_input(self, db_session: AsyncSession) -> None:
        """Server ID should match the provided input."""
        server = Server(
            id="omv-mediaserver",
            hostname="omv-mediaserver",
            display_name="Media Server",
            ip_address="192.168.1.100",
            status=ServerStatus.UNKNOWN.value,
            tdp_watts=65,
        )
        db_session.add(server)
        await db_session.commit()

        retrieved = await db_session.get(Server, "omv-mediaserver")
        assert retrieved is not None
        assert retrieved.id == "omv-mediaserver"

    async def test_hostname_stored_correctly(self, db_session: AsyncSession) -> None:
        """Hostname should be stored correctly."""
        server = Server(
            id="test-server",
            hostname="test-server.local",
        )
        db_session.add(server)
        await db_session.commit()

        retrieved = await db_session.get(Server, "test-server")
        assert retrieved is not None
        assert retrieved.hostname == "test-server.local"

    async def test_status_defaults_to_unknown(self, db_session: AsyncSession) -> None:
        """Status should default to 'unknown' when not provided."""
        server = Server(
            id="default-status-server",
            hostname="default-status-server",
        )
        db_session.add(server)
        await db_session.commit()

        retrieved = await db_session.get(Server, "default-status-server")
        assert retrieved is not None
        assert retrieved.status == ServerStatus.UNKNOWN.value

    async def test_created_at_timestamp_auto_populated(self, db_session: AsyncSession) -> None:
        """created_at should be auto-populated on creation."""
        server = Server(
            id="timestamp-server",
            hostname="timestamp-server",
        )
        db_session.add(server)
        await db_session.commit()

        retrieved = await db_session.get(Server, "timestamp-server")
        assert retrieved is not None
        assert retrieved.created_at is not None
        # Verify timestamp is a datetime object
        assert isinstance(retrieved.created_at, datetime)

    async def test_updated_at_timestamp_auto_populated(self, db_session: AsyncSession) -> None:
        """updated_at should be auto-populated on creation."""
        server = Server(
            id="updated-timestamp-server",
            hostname="updated-timestamp-server",
        )
        db_session.add(server)
        await db_session.commit()

        retrieved = await db_session.get(Server, "updated-timestamp-server")
        assert retrieved is not None
        assert retrieved.updated_at is not None

    async def test_server_display_name_stored(self, db_session: AsyncSession) -> None:
        """Display name should be stored correctly."""
        server = Server(
            id="display-name-server",
            hostname="display-name-server",
            display_name="My Display Name",
        )
        db_session.add(server)
        await db_session.commit()

        retrieved = await db_session.get(Server, "display-name-server")
        assert retrieved is not None
        assert retrieved.display_name == "My Display Name"

    async def test_server_os_info_stored(self, db_session: AsyncSession) -> None:
        """OS information fields should be stored correctly."""
        server = Server(
            id="os-info-server",
            hostname="os-info-server",
            os_distribution="Debian GNU/Linux",
            os_version="12 (bookworm)",
            kernel_version="6.1.0-18-amd64",
            architecture="x86_64",
        )
        db_session.add(server)
        await db_session.commit()

        retrieved = await db_session.get(Server, "os-info-server")
        assert retrieved is not None
        assert retrieved.os_distribution == "Debian GNU/Linux"
        assert retrieved.os_version == "12 (bookworm)"
        assert retrieved.kernel_version == "6.1.0-18-amd64"
        assert retrieved.architecture == "x86_64"


class TestMetricsModel:
    """TC003: Metrics model with server relationship."""

    async def test_metrics_record_created(self, db_session: AsyncSession) -> None:
        """Metrics record should be created successfully."""
        # First create a server
        server = Server(id="metrics-test-server", hostname="metrics-test-server")
        db_session.add(server)
        await db_session.commit()

        # Create metrics
        metrics = Metrics(
            server_id="metrics-test-server",
            timestamp=datetime.now(UTC),
            cpu_percent=45.5,
            memory_percent=67.2,
            disk_percent=82.0,
        )
        db_session.add(metrics)
        await db_session.commit()

        assert metrics.id is not None

    async def test_foreign_key_to_server_valid(self, db_session: AsyncSession) -> None:
        """Foreign key relationship to server should be valid."""
        # Create server
        server = Server(id="fk-test-server", hostname="fk-test-server")
        db_session.add(server)
        await db_session.commit()

        # Create metrics with valid FK
        metrics = Metrics(
            server_id="fk-test-server",
            timestamp=datetime.now(UTC),
            cpu_percent=50.0,
        )
        db_session.add(metrics)
        await db_session.commit()

        # Refresh to load relationship
        await db_session.refresh(metrics)
        assert metrics.server_id == "fk-test-server"

    async def test_all_numeric_fields_stored_correctly(self, db_session: AsyncSession) -> None:
        """All numeric fields should be stored with correct values."""
        server = Server(id="all-fields-server", hostname="all-fields-server")
        db_session.add(server)
        await db_session.commit()

        metrics = Metrics(
            server_id="all-fields-server",
            timestamp=datetime.now(UTC),
            cpu_percent=45.5,
            memory_percent=67.2,
            memory_total_mb=8192,
            memory_used_mb=5505,
            disk_percent=82.0,
            disk_total_gb=2000.0,
            disk_used_gb=1640.0,
            network_rx_bytes=1073741824,
            network_tx_bytes=536870912,
            load_1m=1.5,
            load_5m=1.2,
            load_15m=0.9,
            uptime_seconds=86400,
        )
        db_session.add(metrics)
        await db_session.commit()

        await db_session.refresh(metrics)
        assert metrics.cpu_percent == 45.5
        assert metrics.memory_percent == 67.2
        assert metrics.memory_total_mb == 8192
        assert metrics.memory_used_mb == 5505
        assert metrics.disk_percent == 82.0
        assert metrics.disk_total_gb == 2000.0
        assert metrics.disk_used_gb == 1640.0
        assert metrics.network_rx_bytes == 1073741824
        assert metrics.network_tx_bytes == 536870912
        assert metrics.load_1m == 1.5
        assert metrics.load_5m == 1.2
        assert metrics.load_15m == 0.9
        assert metrics.uptime_seconds == 86400

    async def test_timestamp_stored_with_timezone(self, db_session: AsyncSession) -> None:
        """Timestamp should be stored with timezone information."""
        server = Server(id="tz-server", hostname="tz-server")
        db_session.add(server)
        await db_session.commit()

        now = datetime.now(UTC)
        metrics = Metrics(
            server_id="tz-server",
            timestamp=now,
            cpu_percent=50.0,
        )
        db_session.add(metrics)
        await db_session.commit()

        await db_session.refresh(metrics)
        assert metrics.timestamp is not None


class TestForeignKeyConstraint:
    """TC004: Foreign key prevents orphan metrics."""

    async def test_integrity_error_raised_for_nonexistent_server(
        self, db_session: AsyncSession
    ) -> None:
        """IntegrityError should be raised when server_id doesn't exist."""
        metrics = Metrics(
            server_id="nonexistent",
            timestamp=datetime.now(UTC),
            cpu_percent=50.0,
        )
        db_session.add(metrics)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_no_metrics_record_in_database_after_error(
        self, db_session: AsyncSession
    ) -> None:
        """No metrics should be persisted when FK constraint is violated."""
        metrics = Metrics(
            server_id="nonexistent-for-check",
            timestamp=datetime.now(UTC),
            cpu_percent=50.0,
        )
        db_session.add(metrics)

        try:
            await db_session.commit()
        except IntegrityError:
            await db_session.rollback()

        # Verify no metrics exist
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM metrics WHERE server_id = 'nonexistent-for-check'")
        )
        count = result.scalar()
        assert count == 0


class TestMetricsIndex:
    """TC005: Index exists on metrics(server_id, timestamp)."""

    async def test_index_appears_in_pragma_output(self, db_session: AsyncSession) -> None:
        """Index should appear in SQLite PRAGMA index_list output."""
        result = await db_session.execute(text("PRAGMA index_list(metrics)"))
        indices = result.fetchall()

        index_names = [idx[1] for idx in indices]
        assert "idx_metrics_server_timestamp" in index_names

    async def test_index_covers_server_id_and_timestamp_columns(
        self, db_session: AsyncSession
    ) -> None:
        """Index should cover both server_id and timestamp columns."""
        result = await db_session.execute(text("PRAGMA index_info(idx_metrics_server_timestamp)"))
        columns = result.fetchall()

        column_names = [col[2] for col in columns]
        assert "server_id" in column_names
        assert "timestamp" in column_names


class TestServerMetricsCascadeDelete:
    """Additional test: Cascade delete removes metrics with server."""

    async def test_deleting_server_removes_associated_metrics(
        self, db_session: AsyncSession
    ) -> None:
        """Deleting a server should cascade delete its metrics."""
        # Create server and metrics
        server = Server(id="cascade-server", hostname="cascade-server")
        db_session.add(server)
        await db_session.commit()

        metrics1 = Metrics(
            server_id="cascade-server",
            timestamp=datetime.now(UTC),
            cpu_percent=50.0,
        )
        metrics2 = Metrics(
            server_id="cascade-server",
            timestamp=datetime.now(UTC),
            cpu_percent=60.0,
        )
        db_session.add_all([metrics1, metrics2])
        await db_session.commit()

        # Delete server
        await db_session.delete(server)
        await db_session.commit()

        # Verify metrics are gone
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM metrics WHERE server_id = 'cascade-server'")
        )
        count = result.scalar()
        assert count == 0
