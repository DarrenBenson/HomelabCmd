"""Tests for Tiered Data Retention and Rollup (US0046).

Test specification: sdlc-studio/test-specs/TS0046-tiered-data-retention.md
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.metrics import Metrics, MetricsDaily, MetricsHourly
from homelab_cmd.db.models.server import Server, ServerStatus

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def create_raw_metrics():
    """Factory fixture to create raw metrics in the database."""

    async def _create(
        session: AsyncSession,
        server_id: str,
        timestamp: datetime,
        cpu_percent: float = 50.0,
        memory_percent: float = 60.0,
        disk_percent: float = 70.0,
    ) -> Metrics:
        """Create a raw metric record."""
        metric = Metrics(
            server_id=server_id,
            timestamp=timestamp,
            cpu_percent=cpu_percent,
            memory_percent=memory_percent,
            memory_total_mb=16000,
            memory_used_mb=int(16000 * memory_percent / 100),
            disk_percent=disk_percent,
            disk_total_gb=500.0,
            disk_used_gb=500.0 * disk_percent / 100,
        )
        session.add(metric)
        await session.flush()
        return metric

    return _create


@pytest.fixture
def create_hourly_metrics():
    """Factory fixture to create hourly aggregated metrics."""

    async def _create(
        session: AsyncSession,
        server_id: str,
        timestamp: datetime,
        cpu_avg: float = 50.0,
        cpu_min: float = 45.0,
        cpu_max: float = 55.0,
        memory_avg: float = 60.0,
        memory_min: float = 55.0,
        memory_max: float = 65.0,
        disk_avg: float = 70.0,
        disk_min: float = 65.0,
        disk_max: float = 75.0,
        sample_count: int = 60,
    ) -> MetricsHourly:
        """Create an hourly aggregate metric record."""
        metric = MetricsHourly(
            server_id=server_id,
            timestamp=timestamp,
            cpu_avg=cpu_avg,
            cpu_min=cpu_min,
            cpu_max=cpu_max,
            memory_avg=memory_avg,
            memory_min=memory_min,
            memory_max=memory_max,
            disk_avg=disk_avg,
            disk_min=disk_min,
            disk_max=disk_max,
            sample_count=sample_count,
        )
        session.add(metric)
        await session.flush()
        return metric

    return _create


@pytest.fixture
def create_daily_metrics():
    """Factory fixture to create daily aggregated metrics."""

    async def _create(
        session: AsyncSession,
        server_id: str,
        timestamp: datetime,
        cpu_avg: float = 50.0,
        cpu_min: float = 40.0,
        cpu_max: float = 60.0,
        memory_avg: float = 60.0,
        memory_min: float = 50.0,
        memory_max: float = 70.0,
        disk_avg: float = 70.0,
        disk_min: float = 60.0,
        disk_max: float = 80.0,
        sample_count: int = 1440,
    ) -> MetricsDaily:
        """Create a daily aggregate metric record."""
        metric = MetricsDaily(
            server_id=server_id,
            timestamp=timestamp,
            cpu_avg=cpu_avg,
            cpu_min=cpu_min,
            cpu_max=cpu_max,
            memory_avg=memory_avg,
            memory_min=memory_min,
            memory_max=memory_max,
            disk_avg=disk_avg,
            disk_min=disk_min,
            disk_max=disk_max,
            sample_count=sample_count,
        )
        session.add(metric)
        await session.flush()
        return metric

    return _create


async def create_test_server(session: AsyncSession, server_id: str) -> Server:
    """Create a test server."""
    server = Server(
        id=server_id,
        hostname=f"{server_id}.local",
        display_name=f"Test Server {server_id}",
        status=ServerStatus.ONLINE.value,
    )
    session.add(server)
    await session.commit()
    return server


# =============================================================================
# TC01: Hourly rollup aggregates raw metrics older than 7 days
# =============================================================================


class TestRollupRawToHourly:
    """Tests for rollup_raw_to_hourly() function."""

    @pytest.mark.asyncio
    async def test_aggregates_raw_metrics_older_than_7_days(
        self, db_session: AsyncSession, create_raw_metrics
    ) -> None:
        """TC01: Raw metrics older than 7 days are aggregated into hourly table."""
        # Given: raw metrics exist with timestamps older than 7 days
        await create_test_server(db_session, "server-001")

        # Create metrics in the same hour (11 days ago)
        base_time = datetime.now(UTC) - timedelta(days=11)
        hour_start = base_time.replace(minute=0, second=0, microsecond=0)

        await create_raw_metrics(
            db_session, "server-001", hour_start, cpu_percent=50.0, memory_percent=60.0
        )
        await create_raw_metrics(
            db_session,
            "server-001",
            hour_start + timedelta(minutes=1),
            cpu_percent=55.0,
            memory_percent=62.0,
        )
        await create_raw_metrics(
            db_session,
            "server-001",
            hour_start + timedelta(minutes=2),
            cpu_percent=45.0,
            memory_percent=58.0,
        )
        await db_session.commit()

        # Mock session factory
        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            # When: rollup_raw_to_hourly() is called
            from homelab_cmd.services.scheduler import rollup_raw_to_hourly

            aggregates_created, records_deleted = await rollup_raw_to_hourly()

        # Then: aggregated records appear in metrics_hourly
        result = await db_session.execute(
            select(MetricsHourly).where(MetricsHourly.server_id == "server-001")
        )
        hourly_records = result.scalars().all()

        assert len(hourly_records) == 1, "Should create one hourly aggregate"
        hourly = hourly_records[0]

        # Verify aggregation values
        assert hourly.cpu_avg == pytest.approx(50.0, rel=0.01)  # avg(50, 55, 45)
        assert hourly.cpu_min == 45.0
        assert hourly.cpu_max == 55.0
        assert hourly.memory_avg == pytest.approx(60.0, rel=0.01)  # avg(60, 62, 58)
        assert hourly.memory_min == 58.0
        assert hourly.memory_max == 62.0
        assert hourly.sample_count == 3

        # And: original raw records are deleted
        raw_result = await db_session.execute(
            select(Metrics).where(Metrics.server_id == "server-001")
        )
        raw_records = raw_result.scalars().all()
        assert len(raw_records) == 0, "Raw records should be deleted after rollup"

        assert aggregates_created == 1
        assert records_deleted == 3

    @pytest.mark.asyncio
    async def test_preserves_recent_raw_metrics(
        self, db_session: AsyncSession, create_raw_metrics
    ) -> None:
        """Raw metrics newer than 7 days are NOT rolled up."""
        await create_test_server(db_session, "server-002")

        # Create recent metrics (2 days ago - should NOT be rolled up)
        recent_time = datetime.now(UTC) - timedelta(days=2)
        await create_raw_metrics(db_session, "server-002", recent_time)
        await db_session.commit()

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import rollup_raw_to_hourly

            aggregates_created, records_deleted = await rollup_raw_to_hourly()

        # Recent metrics should remain
        raw_result = await db_session.execute(
            select(Metrics).where(Metrics.server_id == "server-002")
        )
        raw_records = raw_result.scalars().all()
        assert len(raw_records) == 1, "Recent raw metrics should be preserved"

        assert aggregates_created == 0
        assert records_deleted == 0


# =============================================================================
# TC02: Hourly rollup handles multiple servers
# =============================================================================


class TestRollupMultipleServers:
    """Tests for rollup handling multiple servers independently."""

    @pytest.mark.asyncio
    async def test_aggregates_each_server_separately(
        self, db_session: AsyncSession, create_raw_metrics
    ) -> None:
        """TC02: Each server gets its own hourly aggregates."""
        await create_test_server(db_session, "server-a")
        await create_test_server(db_session, "server-b")

        old_time = datetime.now(UTC) - timedelta(days=10)
        hour_start = old_time.replace(minute=0, second=0, microsecond=0)

        # Server A: high CPU
        await create_raw_metrics(
            db_session, "server-a", hour_start, cpu_percent=80.0, memory_percent=40.0
        )
        await create_raw_metrics(
            db_session,
            "server-a",
            hour_start + timedelta(minutes=1),
            cpu_percent=90.0,
            memory_percent=45.0,
        )

        # Server B: low CPU
        await create_raw_metrics(
            db_session, "server-b", hour_start, cpu_percent=20.0, memory_percent=70.0
        )
        await create_raw_metrics(
            db_session,
            "server-b",
            hour_start + timedelta(minutes=1),
            cpu_percent=25.0,
            memory_percent=75.0,
        )
        await db_session.commit()

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import rollup_raw_to_hourly

            await rollup_raw_to_hourly()

        # Verify Server A aggregate
        result_a = await db_session.execute(
            select(MetricsHourly).where(MetricsHourly.server_id == "server-a")
        )
        hourly_a = result_a.scalars().first()
        assert hourly_a is not None
        assert hourly_a.cpu_avg == pytest.approx(85.0, rel=0.01)  # avg(80, 90)
        assert hourly_a.cpu_min == 80.0
        assert hourly_a.cpu_max == 90.0

        # Verify Server B aggregate (independent)
        result_b = await db_session.execute(
            select(MetricsHourly).where(MetricsHourly.server_id == "server-b")
        )
        hourly_b = result_b.scalars().first()
        assert hourly_b is not None
        assert hourly_b.cpu_avg == pytest.approx(22.5, rel=0.01)  # avg(20, 25)
        assert hourly_b.cpu_min == 20.0
        assert hourly_b.cpu_max == 25.0


# =============================================================================
# TC03: Hourly rollup with no data to process
# =============================================================================


class TestRollupNoData:
    """Tests for rollup with empty data sets."""

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_old_data(self, db_session: AsyncSession) -> None:
        """TC03: Returns (0, 0) when no data older than 7 days exists."""
        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import rollup_raw_to_hourly

            aggregates_created, records_deleted = await rollup_raw_to_hourly()

        assert aggregates_created == 0
        assert records_deleted == 0


# =============================================================================
# TC04: Daily rollup aggregates hourly metrics older than 90 days
# =============================================================================


class TestRollupHourlyToDaily:
    """Tests for rollup_hourly_to_daily() function."""

    @pytest.mark.asyncio
    async def test_aggregates_hourly_metrics_older_than_90_days(
        self, db_session: AsyncSession, create_hourly_metrics
    ) -> None:
        """TC04: Hourly metrics older than 90 days are aggregated into daily table."""
        await create_test_server(db_session, "server-001")

        # Create hourly metrics (93 days ago - same day, different hours)
        old_time = datetime.now(UTC) - timedelta(days=93)
        day_start = old_time.replace(hour=0, minute=0, second=0, microsecond=0)

        await create_hourly_metrics(
            db_session,
            "server-001",
            day_start.replace(hour=8),
            cpu_avg=40.0,
            cpu_min=35.0,
            cpu_max=45.0,
            sample_count=60,
        )
        await create_hourly_metrics(
            db_session,
            "server-001",
            day_start.replace(hour=9),
            cpu_avg=50.0,
            cpu_min=45.0,
            cpu_max=55.0,
            sample_count=60,
        )
        await db_session.commit()

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import rollup_hourly_to_daily

            aggregates_created, records_deleted = await rollup_hourly_to_daily()

        # Verify daily aggregate
        result = await db_session.execute(
            select(MetricsDaily).where(MetricsDaily.server_id == "server-001")
        )
        daily_records = result.scalars().all()

        assert len(daily_records) == 1, "Should create one daily aggregate"
        daily = daily_records[0]

        assert daily.cpu_avg == pytest.approx(45.0, rel=0.01)  # avg(40, 50)
        assert daily.cpu_min == 35.0  # min of all hourly mins
        assert daily.cpu_max == 55.0  # max of all hourly maxes
        assert daily.sample_count == 120  # sum of sample counts

        # Hourly records should be deleted
        hourly_result = await db_session.execute(
            select(MetricsHourly).where(MetricsHourly.server_id == "server-001")
        )
        hourly_records = hourly_result.scalars().all()
        assert len(hourly_records) == 0, "Hourly records should be deleted"

        assert aggregates_created == 1
        assert records_deleted == 2


# =============================================================================
# TC05: Daily rollup preserves data gaps
# =============================================================================


class TestRollupPreservesGaps:
    """Tests for rollup preserving data gaps."""

    @pytest.mark.asyncio
    async def test_gaps_reflected_in_sample_count(
        self, db_session: AsyncSession, create_hourly_metrics
    ) -> None:
        """TC05: Days with gaps have lower sample_count."""
        await create_test_server(db_session, "server-001")

        # Day 1: Full data (24 hourly records worth)
        old_time = datetime.now(UTC) - timedelta(days=95)
        day1 = old_time.replace(hour=0, minute=0, second=0, microsecond=0)

        # Only create 2 hourly records (simulating server offline most of the day)
        await create_hourly_metrics(
            db_session, "server-001", day1.replace(hour=10), sample_count=60
        )
        await create_hourly_metrics(
            db_session, "server-001", day1.replace(hour=11), sample_count=45
        )
        await db_session.commit()

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import rollup_hourly_to_daily

            await rollup_hourly_to_daily()

        result = await db_session.execute(
            select(MetricsDaily).where(MetricsDaily.server_id == "server-001")
        )
        daily = result.scalars().first()

        # Sample count reflects only the data we had (not 1440 for full day)
        assert daily.sample_count == 105  # 60 + 45


# =============================================================================
# TC06: Daily metrics older than 12 months are deleted
# =============================================================================


class TestPruneDailyMetrics:
    """Tests for prune_old_daily_metrics() function."""

    @pytest.mark.asyncio
    async def test_deletes_daily_older_than_12_months(
        self, db_session: AsyncSession, create_daily_metrics
    ) -> None:
        """TC06: Daily metrics older than 365 days are permanently deleted."""
        await create_test_server(db_session, "server-001")

        # Create old daily metric (385 days ago - should be deleted)
        old_time = datetime.now(UTC) - timedelta(days=385)
        await create_daily_metrics(db_session, "server-001", old_time)

        # Create recent daily metric (51 days ago - should be kept)
        recent_time = datetime.now(UTC) - timedelta(days=51)
        await create_daily_metrics(db_session, "server-001", recent_time)
        await db_session.commit()

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import prune_old_daily_metrics

            deleted_count = await prune_old_daily_metrics()

        result = await db_session.execute(
            select(MetricsDaily).where(MetricsDaily.server_id == "server-001")
        )
        remaining = result.scalars().all()

        assert deleted_count == 1
        assert len(remaining) == 1
        # The remaining record should be the recent one (within 365 days)
        remaining_ts = remaining[0].timestamp
        if remaining_ts.tzinfo is None:
            remaining_ts = remaining_ts.replace(tzinfo=UTC)
        assert (datetime.now(UTC) - remaining_ts).days < 365


# =============================================================================
# TC07: Aggregate records contain all required fields
# =============================================================================


class TestAggregateFields:
    """Tests for aggregate record completeness."""

    @pytest.mark.asyncio
    async def test_hourly_aggregate_has_all_fields(
        self, db_session: AsyncSession, create_raw_metrics
    ) -> None:
        """TC07: Hourly aggregate contains avg, min, max for all metrics."""
        await create_test_server(db_session, "server-001")

        old_time = datetime.now(UTC) - timedelta(days=10)
        hour_start = old_time.replace(minute=0, second=0, microsecond=0)

        await create_raw_metrics(
            db_session,
            "server-001",
            hour_start,
            cpu_percent=50.0,
            memory_percent=60.0,
            disk_percent=70.0,
        )
        await create_raw_metrics(
            db_session,
            "server-001",
            hour_start + timedelta(minutes=1),
            cpu_percent=60.0,
            memory_percent=70.0,
            disk_percent=80.0,
        )
        await db_session.commit()

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import rollup_raw_to_hourly

            await rollup_raw_to_hourly()

        result = await db_session.execute(
            select(MetricsHourly).where(MetricsHourly.server_id == "server-001")
        )
        hourly = result.scalars().first()

        # All CPU fields
        assert hourly.cpu_avg is not None
        assert hourly.cpu_min is not None
        assert hourly.cpu_max is not None

        # All memory fields
        assert hourly.memory_avg is not None
        assert hourly.memory_min is not None
        assert hourly.memory_max is not None

        # All disk fields
        assert hourly.disk_avg is not None
        assert hourly.disk_min is not None
        assert hourly.disk_max is not None

        # Sample count
        assert hourly.sample_count == 2


# =============================================================================
# TC08: Aggregation handles null values
# =============================================================================


class TestAggregationNullHandling:
    """Tests for null value handling in aggregation."""

    @pytest.mark.asyncio
    async def test_excludes_null_values_from_calculation(self, db_session: AsyncSession) -> None:
        """TC08: Null values are excluded from AVG/MIN/MAX calculations."""
        await create_test_server(db_session, "server-001")

        old_time = datetime.now(UTC) - timedelta(days=10)
        hour_start = old_time.replace(minute=0, second=0, microsecond=0)

        # Metric with CPU value
        metric1 = Metrics(
            server_id="server-001",
            timestamp=hour_start,
            cpu_percent=50.0,
            memory_percent=60.0,
        )
        db_session.add(metric1)

        # Metric with null CPU (only memory)
        metric2 = Metrics(
            server_id="server-001",
            timestamp=hour_start + timedelta(minutes=1),
            cpu_percent=None,  # Null
            memory_percent=70.0,
        )
        db_session.add(metric2)
        await db_session.commit()

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import rollup_raw_to_hourly

            await rollup_raw_to_hourly()

        result = await db_session.execute(
            select(MetricsHourly).where(MetricsHourly.server_id == "server-001")
        )
        hourly = result.scalars().first()

        # CPU should only use the non-null value
        assert hourly.cpu_avg == 50.0
        assert hourly.cpu_min == 50.0
        assert hourly.cpu_max == 50.0

        # Memory should use both values
        assert hourly.memory_avg == pytest.approx(65.0, rel=0.01)


# =============================================================================
# TC09: Rollup job runs at scheduled time
# =============================================================================


class TestRollupScheduling:
    """Tests for rollup job scheduling."""

    def test_rollup_job_configured_correctly(self) -> None:
        """TC09: Rollup job is registered with correct schedule."""
        # This test verifies the scheduler configuration
        # The actual scheduling is tested via integration tests

        from homelab_cmd.services.scheduler import (
            DAILY_RETENTION_DAYS,
            HOURLY_RETENTION_DAYS,
            RAW_RETENTION_DAYS,
        )

        # Verify retention constants
        assert RAW_RETENTION_DAYS == 7
        assert HOURLY_RETENTION_DAYS == 90
        assert DAILY_RETENTION_DAYS == 365


# =============================================================================
# TC10-13: API tier selection tests
# =============================================================================


class TestMetricsAPITierSelection:
    """Tests for API returning data from appropriate tier."""

    def test_24h_returns_raw_metrics(self, client, auth_headers, create_server) -> None:
        """TC10: 24h range queries raw metrics table."""
        create_server(client, auth_headers, "api-test-server")

        # Send heartbeat with metrics to populate raw data
        client.post(
            "/api/v1/agents/heartbeat",
            json={
                "server_id": "api-test-server",
                "hostname": "api-test-server.local",
                "timestamp": datetime.now(UTC).isoformat(),
                "metrics": {
                    "cpu_percent": 50.0,
                    "memory_percent": 60.0,
                    "disk_percent": 70.0,
                },
            },
            headers=auth_headers,
        )

        response = client.get(
            "/api/v1/servers/api-test-server/metrics?range=24h",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["range"] == "24h"
        assert data["resolution"] == "1m"

    def test_30d_returns_hourly_metrics(self, client, auth_headers, create_server) -> None:
        """TC11: 30d range queries metrics_hourly table."""
        create_server(client, auth_headers, "api-test-server-30d")

        response = client.get(
            "/api/v1/servers/api-test-server-30d/metrics?range=30d",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["range"] == "30d"
        assert data["resolution"] == "1h"

    def test_12m_returns_daily_metrics(self, client, auth_headers, create_server) -> None:
        """TC12: 12m range queries metrics_daily table."""
        create_server(client, auth_headers, "api-test-server-12m")

        response = client.get(
            "/api/v1/servers/api-test-server-12m/metrics?range=12m",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["range"] == "12m"
        assert data["resolution"] == "1d"

    def test_empty_tier_returns_empty_data(self, client, auth_headers, create_server) -> None:
        """TC13: Missing tier data returns empty data_points without error."""
        create_server(client, auth_headers, "empty-server")

        response = client.get(
            "/api/v1/servers/empty-server/metrics?range=12m",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data_points"] == []
        assert data["total_points"] == 0


# =============================================================================
# TC14: Rollup transaction rollback on failure
# =============================================================================


class TestRollupTransactionSafety:
    """Tests for transaction safety during rollup."""

    @pytest.mark.asyncio
    async def test_rollback_on_failure_preserves_data(
        self, db_session: AsyncSession, create_raw_metrics
    ) -> None:
        """TC14: Transaction rollback on failure preserves original data."""
        await create_test_server(db_session, "server-001")

        old_time = datetime.now(UTC) - timedelta(days=10)
        await create_raw_metrics(db_session, "server-001", old_time)
        await db_session.commit()

        # Count raw records before
        result_before = await db_session.execute(
            select(Metrics).where(Metrics.server_id == "server-001")
        )
        count_before = len(result_before.scalars().all())
        assert count_before == 1

        # Simulate failure during rollup by raising exception in session
        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.side_effect = Exception("Simulated DB failure")
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import rollup_raw_to_hourly

            with pytest.raises(Exception, match="Simulated DB failure"):
                await rollup_raw_to_hourly()

        # Verify original data is preserved (using our real session)
        result_after = await db_session.execute(
            select(Metrics).where(Metrics.server_id == "server-001")
        )
        count_after = len(result_after.scalars().all())
        assert count_after == count_before, "Original data should be preserved"

        # Verify no partial aggregates
        hourly_result = await db_session.execute(
            select(MetricsHourly).where(MetricsHourly.server_id == "server-001")
        )
        hourly_count = len(hourly_result.scalars().all())
        assert hourly_count == 0, "No partial aggregates should exist"


# =============================================================================
# Full Rollup Job Integration Test
# =============================================================================


class TestRunMetricsRollup:
    """Integration tests for the full rollup job."""

    @pytest.mark.asyncio
    async def test_full_rollup_sequence(
        self, db_session: AsyncSession, create_raw_metrics, create_hourly_metrics
    ) -> None:
        """Full rollup job executes all three phases in sequence."""
        await create_test_server(db_session, "server-001")

        # Phase 1 data: Raw metrics older than 7 days
        raw_time = datetime.now(UTC) - timedelta(days=10)
        await create_raw_metrics(db_session, "server-001", raw_time)

        # Phase 2 data: Hourly metrics older than 90 days
        hourly_time = datetime.now(UTC) - timedelta(days=95)
        await create_hourly_metrics(db_session, "server-001", hourly_time)

        await db_session.commit()

        with patch("homelab_cmd.services.scheduler.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = db_session
            mock_session.__aexit__.return_value = None
            mock_factory.return_value = lambda: mock_session

            from homelab_cmd.services.scheduler import run_metrics_rollup

            results = await run_metrics_rollup()

        # Verify all phases executed
        assert "hourly_created" in results
        assert "raw_deleted" in results
        assert "daily_created" in results
        assert "hourly_deleted" in results
        assert "daily_deleted" in results

        assert results["hourly_created"] >= 1
        assert results["raw_deleted"] >= 1
        assert results["daily_created"] >= 1
        assert results["hourly_deleted"] >= 1
