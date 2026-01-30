"""
Tests for CostHistoryService (US0183 Historical Cost Tracking).

Tests AC1 (daily snapshots), AC2 (historical API), AC4 (per-server history),
AC5 (monthly summary), and AC6 (data retention).
"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from homelab_cmd.db.models.cost_snapshot import CostSnapshot, CostSnapshotMonthly
from homelab_cmd.db.models.server import Server, ServerStatus
from homelab_cmd.services.cost_history import CostHistoryService


@pytest.fixture
def mock_session():
    """Create a mock async database session."""
    session = AsyncMock()
    return session


@pytest.fixture
def sample_server():
    """Create a sample server for testing."""
    server = MagicMock(spec=Server)
    server.id = "test-server-1"
    server.hostname = "test-server"
    server.status = ServerStatus.ONLINE.value
    server.machine_type = "server"
    server.machine_category = "rack_server"
    server.machine_category_source = "auto"
    server.tdp_watts = 65
    server.idle_watts = 20
    return server


@pytest.fixture
def sample_snapshots():
    """Create sample cost snapshots for testing."""
    server_id = "test-server-1"
    today = date.today()
    snapshots = []

    for i in range(7):
        snapshot_date = today - timedelta(days=i)
        snapshot = MagicMock(spec=CostSnapshot)
        snapshot.server_id = server_id
        snapshot.date = snapshot_date
        snapshot.estimated_kwh = 1.2 + (i * 0.1)
        snapshot.estimated_cost = 0.29 + (i * 0.02)
        snapshot.electricity_rate = 0.24
        snapshots.append(snapshot)

    return snapshots


class TestCostHistoryService:
    """Tests for CostHistoryService."""

    @pytest.mark.asyncio
    async def test_capture_daily_snapshot_success(self, mock_session, sample_server):
        """AC1: Test capturing a daily cost snapshot for a server."""
        service = CostHistoryService(mock_session)

        # Mock server lookup
        mock_server_result = MagicMock()
        mock_server_result.scalar_one_or_none.return_value = sample_server

        # Mock config lookup (for electricity rate)
        mock_config_result = MagicMock()
        mock_config_result.scalar_one_or_none.return_value = MagicMock(value={"electricity_rate": 0.24})

        # Mock the avg CPU query
        mock_cpu_result = MagicMock()
        mock_cpu_result.scalar_one_or_none.return_value = 45.0

        # Mock upsert and final fetch
        mock_upsert_result = MagicMock()
        mock_snapshot_result = MagicMock()
        mock_snapshot_result.scalar_one_or_none.return_value = MagicMock(estimated_cost=0.26)

        # Set up execute to return different results for each call
        mock_session.execute = AsyncMock(side_effect=[
            mock_server_result,    # Server lookup
            mock_config_result,    # Config lookup
            mock_cpu_result,       # Avg CPU query
            mock_upsert_result,    # Upsert
            mock_snapshot_result,  # Final fetch
        ])
        mock_session.commit = AsyncMock()

        with patch('homelab_cmd.services.cost_history.get_power_config') as mock_power_config, \
             patch('homelab_cmd.services.cost_history.calculate_power_watts') as mock_watts, \
             patch('homelab_cmd.services.cost_history.calculate_daily_kwh') as mock_kwh:

            mock_power_config.return_value = MagicMock(idle_watts=20, max_watts=65)
            mock_watts.return_value = 45.0
            mock_kwh.return_value = 1.08

            await service.capture_daily_snapshot(server_id=sample_server.id)

            # Verify execute was called
            assert mock_session.execute.called

    @pytest.mark.asyncio
    async def test_capture_daily_snapshot_server_not_found(self, mock_session):
        """Test that capture_daily_snapshot returns None for unknown server."""
        service = CostHistoryService(mock_session)

        # Mock server lookup returning None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await service.capture_daily_snapshot(server_id="unknown-server")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_history_daily_aggregation(self, mock_session, sample_snapshots):
        """AC2: Test getting historical cost data with daily aggregation."""
        service = CostHistoryService(mock_session)

        # Mock query result
        mock_result = MagicMock()
        mock_rows = [
            MagicMock(date=s.date, total_kwh=s.estimated_kwh, total_cost=s.estimated_cost, avg_rate=s.electricity_rate)
            for s in sample_snapshots
        ]
        mock_result.fetchall.return_value = mock_rows
        mock_session.execute = AsyncMock(return_value=mock_result)

        today = date.today()
        start_date = today - timedelta(days=7)

        result = await service.get_history(
            start_date=start_date,
            end_date=today,
            aggregation="daily",
        )

        assert mock_session.execute.called
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_history_with_server_filter(self, mock_session, sample_snapshots):
        """AC2: Test getting historical cost data filtered by server."""
        service = CostHistoryService(mock_session)
        server_id = sample_snapshots[0].server_id

        # Mock query result
        mock_result = MagicMock()
        mock_rows = [
            MagicMock(date=s.date, total_kwh=s.estimated_kwh, total_cost=s.estimated_cost, avg_rate=s.electricity_rate)
            for s in sample_snapshots
        ]
        mock_result.fetchall.return_value = mock_rows
        mock_session.execute = AsyncMock(return_value=mock_result)

        today = date.today()
        start_date = today - timedelta(days=7)

        await service.get_history(
            start_date=start_date,
            end_date=today,
            server_id=server_id,
            aggregation="daily",
        )

        assert mock_session.execute.called

    @pytest.mark.asyncio
    async def test_get_history_weekly_aggregation(self, mock_session):
        """AC2: Test getting historical cost data with weekly aggregation."""
        service = CostHistoryService(mock_session)

        # Mock query result
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(week="2026-W01", total_kwh=8.4, total_cost=2.02, avg_rate=0.24),
            MagicMock(week="2026-W02", total_kwh=8.2, total_cost=1.97, avg_rate=0.24),
        ]
        mock_session.execute = AsyncMock(return_value=mock_result)

        today = date.today()
        start_date = today - timedelta(days=90)

        result = await service.get_history(
            start_date=start_date,
            end_date=today,
            aggregation="weekly",
        )

        assert mock_session.execute.called
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_history_monthly_aggregation(self, mock_session):
        """AC2: Test getting historical cost data with monthly aggregation."""
        service = CostHistoryService(mock_session)

        # Mock query result
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(month="2026-01", total_kwh=36.0, total_cost=8.64, avg_rate=0.24),
            MagicMock(month="2025-12", total_kwh=37.2, total_cost=8.93, avg_rate=0.24),
        ]
        mock_session.execute = AsyncMock(return_value=mock_result)

        today = date.today()
        start_date = today - timedelta(days=365)

        result = await service.get_history(
            start_date=start_date,
            end_date=today,
            aggregation="monthly",
        )

        assert mock_session.execute.called
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_server_history(self, mock_session, sample_server, sample_snapshots):
        """AC4: Test getting cost history for a specific server."""
        service = CostHistoryService(mock_session)
        server_id = sample_server.id

        # First execute: server lookup
        mock_server_result = MagicMock()
        mock_server_result.scalar_one_or_none.return_value = sample_server

        # Second execute: snapshot query
        mock_snapshot_result = MagicMock()
        mock_snapshot_result.scalars.return_value.all.return_value = sample_snapshots

        mock_session.execute = AsyncMock(side_effect=[mock_server_result, mock_snapshot_result])

        result = await service.get_server_history(
            server_id=server_id,
            period="30d",
        )

        assert mock_session.execute.called
        assert result is not None
        assert result.server_id == server_id

    @pytest.mark.asyncio
    async def test_get_server_history_not_found(self, mock_session):
        """AC4: Test get_server_history returns None for unknown server."""
        service = CostHistoryService(mock_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await service.get_server_history(
            server_id="unknown-server",
            period="30d",
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_get_monthly_summary(self, mock_session):
        """AC5: Test getting monthly cost summary with YTD and change percentage."""
        service = CostHistoryService(mock_session)

        # Mock query result for monthly summary
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            MagicMock(month="2026-01", total_kwh=35.5, total_cost=8.52),
            MagicMock(month="2026-02", total_kwh=36.2, total_cost=8.69),
            MagicMock(month="2026-03", total_kwh=34.8, total_cost=8.35),
        ]
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await service.get_monthly_summary(year=2026)

        assert mock_session.execute.called
        assert result.year == 2026
        assert len(result.months) == 3

    @pytest.mark.asyncio
    async def test_rollup_old_data(self, mock_session):
        """AC6: Test rolling up daily data older than 2 years to monthly aggregates."""
        service = CostHistoryService(mock_session)

        # Mock the aggregate query
        mock_agg_result = MagicMock()
        mock_agg_result.fetchall.return_value = []  # No old data
        mock_session.execute = AsyncMock(return_value=mock_agg_result)

        result = await service.rollup_old_data()

        assert mock_session.execute.called
        assert result == {"daily_deleted": 0, "monthly_created": 0}

    @pytest.mark.asyncio
    async def test_capture_all_snapshots(self, mock_session, sample_server):
        """Test capturing snapshots for all servers."""
        service = CostHistoryService(mock_session)

        # Mock server query
        mock_server_result = MagicMock()
        mock_server_result.fetchall.return_value = [(sample_server.id,)]
        mock_session.execute = AsyncMock(return_value=mock_server_result)

        with patch.object(service, 'capture_daily_snapshot', new_callable=AsyncMock) as mock_capture:
            mock_capture.return_value = MagicMock()

            await service.capture_all_snapshots()

            assert mock_session.execute.called
            mock_capture.assert_called_once_with(sample_server.id)


class TestCostSnapshotModel:
    """Tests for CostSnapshot database model."""

    def test_cost_snapshot_fields(self):
        """Test that CostSnapshot model has required fields."""
        assert hasattr(CostSnapshot, 'id')
        assert hasattr(CostSnapshot, 'server_id')
        assert hasattr(CostSnapshot, 'date')
        assert hasattr(CostSnapshot, 'estimated_kwh')
        assert hasattr(CostSnapshot, 'estimated_cost')
        assert hasattr(CostSnapshot, 'electricity_rate')
        assert hasattr(CostSnapshot, 'tdp_watts')
        assert hasattr(CostSnapshot, 'idle_watts')
        assert hasattr(CostSnapshot, 'avg_cpu_percent')
        assert hasattr(CostSnapshot, 'machine_type')
        assert hasattr(CostSnapshot, 'hours_used')

    def test_cost_snapshot_monthly_fields(self):
        """Test that CostSnapshotMonthly model has required fields."""
        assert hasattr(CostSnapshotMonthly, 'id')
        assert hasattr(CostSnapshotMonthly, 'server_id')
        assert hasattr(CostSnapshotMonthly, 'year_month')
        assert hasattr(CostSnapshotMonthly, 'total_kwh')
        assert hasattr(CostSnapshotMonthly, 'total_cost')
        assert hasattr(CostSnapshotMonthly, 'avg_electricity_rate')
        assert hasattr(CostSnapshotMonthly, 'snapshot_count')
