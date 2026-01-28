"""Tests for service models (US0017: Service Entity and Expected Services Schema).

These tests verify the database layer for EP0003: Service Monitoring.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.server import Server
from homelab_cmd.db.models.service import (
    ExpectedService,
    ServiceStatus,
    ServiceStatusValue,
)


class TestExpectedServiceModel:
    """AC1: ExpectedService table exists with required columns."""

    async def test_expected_service_created_with_all_fields(self, db_session: AsyncSession) -> None:
        """ExpectedService should be created with all required fields."""
        # Create server first
        server = Server(id="service-test-server", hostname="service-test-server")
        db_session.add(server)
        await db_session.commit()

        # Create expected service
        service = ExpectedService(
            server_id="service-test-server",
            service_name="docker.service",
            display_name="Docker",
            is_critical=True,
            enabled=True,
        )
        db_session.add(service)
        await db_session.commit()

        assert service.id is not None
        assert service.server_id == "service-test-server"
        assert service.service_name == "docker.service"
        assert service.display_name == "Docker"
        assert service.is_critical is True
        assert service.enabled is True

    async def test_is_critical_defaults_to_false(self, db_session: AsyncSession) -> None:
        """is_critical should default to False when not provided."""
        server = Server(id="critical-default-server", hostname="critical-default-server")
        db_session.add(server)
        await db_session.commit()

        service = ExpectedService(
            server_id="critical-default-server",
            service_name="nginx.service",
        )
        db_session.add(service)
        await db_session.commit()

        await db_session.refresh(service)
        assert service.is_critical is False

    async def test_enabled_defaults_to_true(self, db_session: AsyncSession) -> None:
        """enabled should default to True when not provided."""
        server = Server(id="enabled-default-server", hostname="enabled-default-server")
        db_session.add(server)
        await db_session.commit()

        service = ExpectedService(
            server_id="enabled-default-server",
            service_name="nginx.service",
        )
        db_session.add(service)
        await db_session.commit()

        await db_session.refresh(service)
        assert service.enabled is True

    async def test_created_at_auto_populated(self, db_session: AsyncSession) -> None:
        """created_at should be auto-populated on creation."""
        server = Server(id="timestamp-service-server", hostname="timestamp-service-server")
        db_session.add(server)
        await db_session.commit()

        service = ExpectedService(
            server_id="timestamp-service-server",
            service_name="sshd.service",
        )
        db_session.add(service)
        await db_session.commit()

        await db_session.refresh(service)
        assert service.created_at is not None
        assert isinstance(service.created_at, datetime)

    async def test_display_name_nullable(self, db_session: AsyncSession) -> None:
        """display_name should accept None."""
        server = Server(id="display-null-server", hostname="display-null-server")
        db_session.add(server)
        await db_session.commit()

        service = ExpectedService(
            server_id="display-null-server",
            service_name="cron.service",
            display_name=None,
        )
        db_session.add(service)
        await db_session.commit()

        await db_session.refresh(service)
        assert service.display_name is None


class TestServiceStatusModel:
    """AC2: ServiceStatus table exists for historical tracking."""

    async def test_service_status_created_with_all_fields(self, db_session: AsyncSession) -> None:
        """ServiceStatus should be created with all fields."""
        server = Server(id="status-test-server", hostname="status-test-server")
        db_session.add(server)
        await db_session.commit()

        now = datetime.now(UTC)
        status = ServiceStatus(
            server_id="status-test-server",
            service_name="docker.service",
            status=ServiceStatusValue.RUNNING.value,
            pid=1234,
            memory_mb=256.5,
            cpu_percent=2.3,
            timestamp=now,
        )
        db_session.add(status)
        await db_session.commit()

        assert status.id is not None
        assert status.server_id == "status-test-server"
        assert status.service_name == "docker.service"
        assert status.status == "running"
        assert status.pid == 1234
        assert status.memory_mb == 256.5
        assert status.cpu_percent == 2.3

    async def test_status_values_stored_correctly(self, db_session: AsyncSession) -> None:
        """All status values should be stored correctly."""
        server = Server(id="status-values-server", hostname="status-values-server")
        db_session.add(server)
        await db_session.commit()

        now = datetime.now(UTC)
        for status_value in ServiceStatusValue:
            status = ServiceStatus(
                server_id="status-values-server",
                service_name=f"test-{status_value.value}.service",
                status=status_value.value,
                timestamp=now,
            )
            db_session.add(status)

        await db_session.commit()

        result = await db_session.execute(
            text("SELECT status FROM service_status WHERE server_id = 'status-values-server'")
        )
        statuses = {row[0] for row in result.fetchall()}
        assert statuses == {"running", "stopped", "failed", "unknown"}

    async def test_nullable_fields_accept_none(self, db_session: AsyncSession) -> None:
        """pid, memory_mb, cpu_percent should accept None."""
        server = Server(id="nullable-status-server", hostname="nullable-status-server")
        db_session.add(server)
        await db_session.commit()

        status = ServiceStatus(
            server_id="nullable-status-server",
            service_name="stopped.service",
            status=ServiceStatusValue.STOPPED.value,
            pid=None,
            memory_mb=None,
            cpu_percent=None,
            timestamp=datetime.now(UTC),
        )
        db_session.add(status)
        await db_session.commit()

        await db_session.refresh(status)
        assert status.pid is None
        assert status.memory_mb is None
        assert status.cpu_percent is None


class TestServiceServerRelationship:
    """AC3: Services link to servers."""

    async def test_expected_service_server_relationship(self, db_session: AsyncSession) -> None:
        """ExpectedService should have accessible server relationship."""
        server = Server(id="rel-test-server", hostname="rel-test-server")
        db_session.add(server)
        await db_session.commit()

        service = ExpectedService(
            server_id="rel-test-server",
            service_name="docker.service",
        )
        db_session.add(service)
        await db_session.commit()

        await db_session.refresh(service)
        assert service.server is not None
        assert service.server.id == "rel-test-server"
        assert service.server.hostname == "rel-test-server"

    async def test_server_expected_services_relationship(self, db_session: AsyncSession) -> None:
        """Server should have accessible expected_services relationship."""
        server = Server(id="back-rel-server", hostname="back-rel-server")
        db_session.add(server)
        await db_session.commit()

        service1 = ExpectedService(
            server_id="back-rel-server",
            service_name="docker.service",
        )
        service2 = ExpectedService(
            server_id="back-rel-server",
            service_name="nginx.service",
        )
        db_session.add_all([service1, service2])
        await db_session.commit()

        # Refresh with eager load of relationship
        await db_session.refresh(server, ["expected_services"])
        assert len(server.expected_services) == 2
        service_names = {s.service_name for s in server.expected_services}
        assert service_names == {"docker.service", "nginx.service"}


class TestCriticalFlag:
    """AC4: Critical flag supported."""

    async def test_is_critical_true_stored_correctly(self, db_session: AsyncSession) -> None:
        """is_critical=True should be stored and retrieved correctly."""
        server = Server(id="critical-true-server", hostname="critical-true-server")
        db_session.add(server)
        await db_session.commit()

        service = ExpectedService(
            server_id="critical-true-server",
            service_name="plex.service",
            is_critical=True,
        )
        db_session.add(service)
        await db_session.commit()

        await db_session.refresh(service)
        assert service.is_critical is True

    async def test_is_critical_false_stored_correctly(self, db_session: AsyncSession) -> None:
        """is_critical=False should be stored and retrieved correctly."""
        server = Server(id="critical-false-server", hostname="critical-false-server")
        db_session.add(server)
        await db_session.commit()

        service = ExpectedService(
            server_id="critical-false-server",
            service_name="cron.service",
            is_critical=False,
        )
        db_session.add(service)
        await db_session.commit()

        await db_session.refresh(service)
        assert service.is_critical is False


class TestServiceForeignKeyConstraint:
    """Foreign key prevents orphan records."""

    async def test_expected_service_fk_prevents_orphan(self, db_session: AsyncSession) -> None:
        """IntegrityError should be raised for non-existent server_id."""
        service = ExpectedService(
            server_id="nonexistent-server",
            service_name="docker.service",
        )
        db_session.add(service)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_service_status_fk_prevents_orphan(self, db_session: AsyncSession) -> None:
        """IntegrityError should be raised for non-existent server_id."""
        status = ServiceStatus(
            server_id="nonexistent-server",
            service_name="docker.service",
            status="running",
            timestamp=datetime.now(UTC),
        )
        db_session.add(status)

        with pytest.raises(IntegrityError):
            await db_session.commit()


class TestUniqueConstraint:
    """Unique constraint on (server_id, service_name)."""

    async def test_duplicate_service_name_raises_error(self, db_session: AsyncSession) -> None:
        """IntegrityError should be raised for duplicate (server_id, service_name)."""
        server = Server(id="unique-test-server", hostname="unique-test-server")
        db_session.add(server)
        await db_session.commit()

        service1 = ExpectedService(
            server_id="unique-test-server",
            service_name="docker.service",
        )
        db_session.add(service1)
        await db_session.commit()

        service2 = ExpectedService(
            server_id="unique-test-server",
            service_name="docker.service",  # Duplicate
        )
        db_session.add(service2)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_same_service_different_servers_allowed(self, db_session: AsyncSession) -> None:
        """Same service name on different servers should be allowed."""
        server1 = Server(id="unique-server-1", hostname="unique-server-1")
        server2 = Server(id="unique-server-2", hostname="unique-server-2")
        db_session.add_all([server1, server2])
        await db_session.commit()

        service1 = ExpectedService(
            server_id="unique-server-1",
            service_name="docker.service",
        )
        service2 = ExpectedService(
            server_id="unique-server-2",
            service_name="docker.service",  # Same name, different server
        )
        db_session.add_all([service1, service2])
        await db_session.commit()

        # Should succeed without error
        assert service1.id is not None
        assert service2.id is not None


class TestCascadeDelete:
    """Cascade delete removes services when server deleted."""

    async def test_expected_service_cascade_delete(self, db_session: AsyncSession) -> None:
        """Deleting a server should cascade delete its expected services."""
        server = Server(id="cascade-service-server", hostname="cascade-service-server")
        db_session.add(server)
        await db_session.commit()

        service1 = ExpectedService(
            server_id="cascade-service-server",
            service_name="docker.service",
        )
        service2 = ExpectedService(
            server_id="cascade-service-server",
            service_name="nginx.service",
        )
        db_session.add_all([service1, service2])
        await db_session.commit()

        # Delete server
        await db_session.delete(server)
        await db_session.commit()

        # Verify services are gone
        result = await db_session.execute(
            text(
                "SELECT COUNT(*) FROM expected_services WHERE server_id = 'cascade-service-server'"
            )
        )
        count = result.scalar()
        assert count == 0

    async def test_service_status_cascade_delete(self, db_session: AsyncSession) -> None:
        """Deleting a server should cascade delete its service status records."""
        server = Server(id="cascade-status-server", hostname="cascade-status-server")
        db_session.add(server)
        await db_session.commit()

        now = datetime.now(UTC)
        status1 = ServiceStatus(
            server_id="cascade-status-server",
            service_name="docker.service",
            status="running",
            timestamp=now,
        )
        status2 = ServiceStatus(
            server_id="cascade-status-server",
            service_name="nginx.service",
            status="stopped",
            timestamp=now,
        )
        db_session.add_all([status1, status2])
        await db_session.commit()

        # Delete server
        await db_session.delete(server)
        await db_session.commit()

        # Verify status records are gone
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM service_status WHERE server_id = 'cascade-status-server'")
        )
        count = result.scalar()
        assert count == 0


class TestServiceIndices:
    """Indices exist for common queries."""

    async def test_expected_services_server_index_exists(self, db_session: AsyncSession) -> None:
        """idx_expected_services_server index should exist."""
        result = await db_session.execute(text("PRAGMA index_list(expected_services)"))
        indices = result.fetchall()
        index_names = [idx[1] for idx in indices]
        assert "idx_expected_services_server" in index_names

    async def test_service_status_server_time_index_exists(self, db_session: AsyncSession) -> None:
        """idx_service_status_server_time index should exist."""
        result = await db_session.execute(text("PRAGMA index_list(service_status)"))
        indices = result.fetchall()
        index_names = [idx[1] for idx in indices]
        assert "idx_service_status_server_time" in index_names

    async def test_service_status_service_index_exists(self, db_session: AsyncSession) -> None:
        """idx_service_status_service index should exist."""
        result = await db_session.execute(text("PRAGMA index_list(service_status)"))
        indices = result.fetchall()
        index_names = [idx[1] for idx in indices]
        assert "idx_service_status_service" in index_names

    async def test_server_time_index_covers_columns(self, db_session: AsyncSession) -> None:
        """idx_service_status_server_time should cover server_id and timestamp."""
        result = await db_session.execute(text("PRAGMA index_info(idx_service_status_server_time)"))
        columns = result.fetchall()
        column_names = [col[2] for col in columns]
        assert "server_id" in column_names
        assert "timestamp" in column_names

    async def test_service_index_covers_columns(self, db_session: AsyncSession) -> None:
        """idx_service_status_service should cover server_id, service_name, timestamp."""
        result = await db_session.execute(text("PRAGMA index_info(idx_service_status_service)"))
        columns = result.fetchall()
        column_names = [col[2] for col in columns]
        assert "server_id" in column_names
        assert "service_name" in column_names
        assert "timestamp" in column_names
