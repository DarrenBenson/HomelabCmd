"""Tests for US0092: Workstation Cost Tracking.

TDD tests for workstation-specific cost calculations based on actual uptime.
"""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.server import Server
from homelab_cmd.db.models.uptime import ServerUptimeDaily
from homelab_cmd.services.power import calculate_workstation_cost
from homelab_cmd.services.uptime import (
    get_uptime_for_period,
    update_server_uptime,
)

# =============================================================================
# AC1: Uptime tracking from heartbeats
# =============================================================================


@pytest.mark.asyncio
async def test_uptime_tracked_from_heartbeat(db_session: AsyncSession) -> None:
    """AC1: Uptime is tracked when heartbeat is received."""
    # Create a workstation
    server = Server(
        id="test-workstation",
        hostname="test-workstation.local",
        machine_type="workstation",
        status="online",
    )
    db_session.add(server)
    await db_session.commit()

    # Update uptime from heartbeat (3600 seconds = 1 hour)
    current_time = datetime.now(UTC)
    await update_server_uptime(
        session=db_session,
        server_id="test-workstation",
        uptime_seconds=3600,
        current_time=current_time,
    )

    # Verify uptime record created
    result = await db_session.execute(
        select(ServerUptimeDaily).where(ServerUptimeDaily.server_id == "test-workstation")
    )
    record = result.scalar_one_or_none()
    assert record is not None
    assert record.uptime_hours == 1.0
    assert record.date == current_time.date()


@pytest.mark.asyncio
async def test_uptime_accumulates_on_same_day(db_session: AsyncSession) -> None:
    """AC1: Multiple heartbeats on same day update uptime."""
    server = Server(
        id="test-workstation",
        hostname="test-workstation.local",
        machine_type="workstation",
        status="online",
    )
    db_session.add(server)
    await db_session.commit()

    current_time = datetime.now(UTC)

    # First heartbeat: 1 hour uptime
    await update_server_uptime(
        session=db_session,
        server_id="test-workstation",
        uptime_seconds=3600,
        current_time=current_time,
    )

    # Second heartbeat: 2 hours uptime (system has been running longer)
    await update_server_uptime(
        session=db_session,
        server_id="test-workstation",
        uptime_seconds=7200,
        current_time=current_time + timedelta(hours=1),
    )

    result = await db_session.execute(
        select(ServerUptimeDaily).where(ServerUptimeDaily.server_id == "test-workstation")
    )
    record = result.scalar_one_or_none()
    assert record is not None
    # Should show the latest uptime value
    assert record.uptime_hours == 2.0


@pytest.mark.asyncio
async def test_uptime_capped_at_24_hours(db_session: AsyncSession) -> None:
    """Edge case: Uptime is capped at 24 hours per day."""
    server = Server(
        id="test-workstation",
        hostname="test-workstation.local",
        machine_type="workstation",
        status="online",
    )
    db_session.add(server)
    await db_session.commit()

    current_time = datetime.now(UTC)

    # Heartbeat with > 24 hours uptime (86400+ seconds)
    await update_server_uptime(
        session=db_session,
        server_id="test-workstation",
        uptime_seconds=100000,  # ~27.7 hours
        current_time=current_time,
    )

    result = await db_session.execute(
        select(ServerUptimeDaily).where(ServerUptimeDaily.server_id == "test-workstation")
    )
    record = result.scalar_one_or_none()
    assert record is not None
    assert record.uptime_hours == 24.0  # Capped at 24


# =============================================================================
# AC2: Actual hours in cost calculation
# =============================================================================


def test_workstation_cost_uses_actual_hours() -> None:
    """AC2: Workstation cost = (TDP × actual_hours × rate) / 1000."""
    # 100W TDP, 10 hours used, £0.24/kWh
    cost = calculate_workstation_cost(
        tdp_watts=100,
        hours_used=10.0,
        rate_per_kwh=0.24,
    )
    # Expected: (100 * 10 * 0.24) / 1000 = 0.24
    assert cost == 0.24


def test_workstation_cost_zero_hours() -> None:
    """Edge case: Zero uptime returns £0.00."""
    cost = calculate_workstation_cost(
        tdp_watts=150,
        hours_used=0.0,
        rate_per_kwh=0.24,
    )
    assert cost == 0.0


def test_workstation_cost_high_tdp() -> None:
    """Cost calculation works for high-power workstations."""
    # 350W gaming workstation, 8 hours, £0.30/kWh
    cost = calculate_workstation_cost(
        tdp_watts=350,
        hours_used=8.0,
        rate_per_kwh=0.30,
    )
    # Expected: (350 * 8 * 0.30) / 1000 = 0.84
    assert cost == 0.84


def test_workstation_cost_fractional_hours() -> None:
    """Cost calculation handles fractional hours."""
    # 100W, 1.5 hours, £0.24/kWh
    cost = calculate_workstation_cost(
        tdp_watts=100,
        hours_used=1.5,
        rate_per_kwh=0.24,
    )
    # Expected: (100 * 1.5 * 0.24) / 1000 = 0.036 → rounded to 0.04
    assert cost == 0.04


# =============================================================================
# AC4: Period-based reporting
# =============================================================================


@pytest.mark.asyncio
async def test_get_uptime_for_period(db_session: AsyncSession) -> None:
    """AC4: Get uptime for a specific date range."""
    server = Server(
        id="test-workstation",
        hostname="test-workstation.local",
        machine_type="workstation",
        status="online",
    )
    db_session.add(server)
    await db_session.commit()

    today = date.today()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    # Add uptime records for multiple days
    records = [
        ServerUptimeDaily(
            server_id="test-workstation",
            date=two_days_ago,
            uptime_hours=4.0,
            last_updated=datetime.now(UTC),
        ),
        ServerUptimeDaily(
            server_id="test-workstation",
            date=yesterday,
            uptime_hours=6.0,
            last_updated=datetime.now(UTC),
        ),
        ServerUptimeDaily(
            server_id="test-workstation",
            date=today,
            uptime_hours=2.0,
            last_updated=datetime.now(UTC),
        ),
    ]
    for record in records:
        db_session.add(record)
    await db_session.commit()

    # Get total uptime for last 3 days
    total = await get_uptime_for_period(
        session=db_session,
        server_id="test-workstation",
        start_date=two_days_ago,
        end_date=today,
    )
    assert total == 12.0  # 4 + 6 + 2


@pytest.mark.asyncio
async def test_get_uptime_for_single_day(db_session: AsyncSession) -> None:
    """AC4: Get uptime for a single day."""
    server = Server(
        id="test-workstation",
        hostname="test-workstation.local",
        machine_type="workstation",
        status="online",
    )
    db_session.add(server)
    await db_session.commit()

    today = date.today()

    record = ServerUptimeDaily(
        server_id="test-workstation",
        date=today,
        uptime_hours=5.5,
        last_updated=datetime.now(UTC),
    )
    db_session.add(record)
    await db_session.commit()

    total = await get_uptime_for_period(
        session=db_session,
        server_id="test-workstation",
        start_date=today,
        end_date=today,
    )
    assert total == 5.5


@pytest.mark.asyncio
async def test_get_uptime_no_records(db_session: AsyncSession) -> None:
    """Edge case: No heartbeats in period returns 0 hours."""
    server = Server(
        id="test-workstation",
        hostname="test-workstation.local",
        machine_type="workstation",
        status="online",
    )
    db_session.add(server)
    await db_session.commit()

    today = date.today()

    total = await get_uptime_for_period(
        session=db_session,
        server_id="test-workstation",
        start_date=today,
        end_date=today,
    )
    assert total == 0.0


# =============================================================================
# AC6: Workstation without TDP
# =============================================================================


def test_workstation_cost_none_tdp() -> None:
    """AC6: Workstation without TDP returns None cost."""
    # This is handled at the API level, but we test the helper returns 0
    # when TDP is 0 (edge case)
    cost = calculate_workstation_cost(
        tdp_watts=0,
        hours_used=10.0,
        rate_per_kwh=0.24,
    )
    assert cost == 0.0


# =============================================================================
# AC5: Combined cost summary API tests
# =============================================================================


def test_cost_summary_has_workstation_fields(
    client,
    auth_headers,
    create_server,
) -> None:
    """AC5: Cost summary includes server and workstation breakdown."""
    # Create a server with TDP
    create_server(client, auth_headers, "test-server-1", tdp_watts=100)

    response = client.get("/api/v1/costs/summary", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    # Verify new workstation breakdown fields exist
    assert "server_cost_total" in data
    assert "server_count" in data
    assert "workstation_cost_total" in data
    assert "workstation_count" in data


def test_cost_breakdown_separates_servers_and_workstations(
    client,
    auth_headers,
    create_server,
) -> None:
    """AC5: Cost breakdown separates server and workstation costs."""
    # Create a server
    create_server(client, auth_headers, "test-server-1", tdp_watts=100)

    # Create a workstation
    client.post(
        "/api/v1/servers",
        json={
            "id": "test-workstation-1",
            "hostname": "workstation.local",
            "machine_type": "workstation",
            "tdp_watts": 150,
        },
        headers=auth_headers,
    )

    response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    # Find server and workstation in breakdown
    servers = [s for s in data["servers"] if s["machine_type"] == "server"]
    workstations = [s for s in data["servers"] if s["machine_type"] == "workstation"]

    assert len(servers) >= 1
    assert len(workstations) >= 1

    # Verify workstation has hours_used field
    for ws in workstations:
        assert "hours_used" in ws
        assert "calculation_type" in ws
        assert ws["calculation_type"] == "actual_usage"

    # Verify server has 24x7 calculation type
    for srv in servers:
        assert "calculation_type" in srv
        assert srv["calculation_type"] == "24x7"


def test_cost_breakdown_workstation_without_tdp(
    client,
    auth_headers,
) -> None:
    """AC6: Workstation without TDP shows in breakdown with null cost."""
    # Create a workstation without TDP
    client.post(
        "/api/v1/servers",
        json={
            "id": "test-workstation-no-tdp",
            "hostname": "workstation.local",
            "machine_type": "workstation",
        },
        headers=auth_headers,
    )

    response = client.get("/api/v1/costs/breakdown", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    workstations = [s for s in data["servers"] if s["machine_type"] == "workstation"]

    # Workstation should be listed but with null cost
    assert len(workstations) >= 1
    ws = workstations[0]
    assert ws["daily_cost"] is None
    assert ws["monthly_cost"] is None
