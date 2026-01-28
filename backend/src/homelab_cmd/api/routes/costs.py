"""Cost tracking API endpoints.

Provides endpoints for retrieving electricity cost estimates based on
server power profiles and actual CPU usage. Supports separate calculation
for servers (24/7) and workstations (actual usage).
"""

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.routes.config import DEFAULT_COST, get_config_value
from homelab_cmd.api.schemas.config import CostConfig
from homelab_cmd.api.schemas.costs import (
    CostBreakdownResponse,
    CostSettings,
    CostSummaryResponse,
    CostTotals,
    ServerCostItem,
)
from homelab_cmd.db.models.metrics import Metrics
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.power import (
    POWER_PROFILES,
    MachineCategory,
    calculate_power_watts,
    calculate_workstation_cost,
    get_power_config,
)
from homelab_cmd.services.power import (
    calculate_daily_cost as calc_daily_cost,
)
from homelab_cmd.services.uptime import get_all_uptime_for_period

router = APIRouter(prefix="/costs", tags=["Costs"])

# Default CPU percentage when no metrics available (AC6)
DEFAULT_CPU_PERCENT = 50.0


async def get_avg_cpu_24h(session: AsyncSession, server_id: str) -> float | None:
    """Get average CPU usage for a server over the last 24 hours.

    Args:
        session: Database session
        server_id: Server identifier

    Returns:
        Average CPU percentage or None if no data available.
    """
    since = datetime.now(UTC) - timedelta(hours=24)

    result = await session.execute(
        select(func.avg(Metrics.cpu_percent))
        .where(Metrics.server_id == server_id)
        .where(Metrics.timestamp >= since)
        .where(Metrics.cpu_percent.isnot(None))
    )
    avg = result.scalar_one_or_none()
    return round(avg, 1) if avg is not None else None


def get_category_label(category: str | None) -> str | None:
    """Get human-readable label for a machine category.

    Args:
        category: Machine category value (e.g., 'mini_pc')

    Returns:
        Human-readable label or None if category is invalid.
    """
    if not category:
        return None
    try:
        cat = MachineCategory(category)
        profile = POWER_PROFILES.get(cat)
        return profile.label if profile else None
    except ValueError:
        return None


@router.get(
    "/summary",
    response_model=CostSummaryResponse,
    operation_id="get_cost_summary",
    summary="Get estimated electricity cost summary",
    responses={**AUTH_RESPONSES},
)
async def get_cost_summary(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CostSummaryResponse:
    """Get estimated electricity cost summary.

    Calculates daily and monthly electricity costs based on server power profiles
    and actual CPU usage. Uses usage-based calculation for servers with power
    configuration, falling back to TDP-only for legacy configuration.

    US0092: Separates server (24/7) and workstation (actual usage) costs.

    Returns:
        Cost summary including daily/monthly costs, server counts, and rate info
    """
    # Get all servers
    result = await session.execute(select(Server))
    servers = result.scalars().all()

    # Get cost configuration
    cost_data = await get_config_value(session, "cost")
    if cost_data:
        cost_config = CostConfig(**cost_data)
    else:
        cost_config = DEFAULT_COST

    rate = cost_config.electricity_rate

    # US0092: Get uptime data for workstations (last 30 days)
    today = date.today()
    start_date = today - timedelta(days=30)
    uptime_data = await get_all_uptime_for_period(session, start_date, today)

    # Track servers by configuration status
    servers_configured = 0
    servers_unconfigured = 0
    total_estimated_watts = 0.0
    total_tdp_watts = 0

    # US0092: Track server vs workstation costs separately (AC5)
    server_cost_total = 0.0
    server_daily_total = 0.0
    server_count = 0
    workstation_cost_total = 0.0
    workstation_daily_total = 0.0
    workstation_count = 0

    for server in servers:
        is_workstation = server.machine_type == "workstation"

        # Try to get power configuration (category-based)
        power_config = get_power_config(
            server.machine_category,
            server.machine_category_source,
            server.idle_watts,
            server.tdp_watts,
        )

        if power_config:
            # Server has power configuration - use usage-based calculation
            servers_configured += 1

            # Get average CPU or use default (AC6)
            avg_cpu = await get_avg_cpu_24h(session, server.id)
            cpu_percent = avg_cpu if avg_cpu is not None else DEFAULT_CPU_PERCENT

            # Calculate estimated power (AC1)
            estimated_watts = calculate_power_watts(
                power_config.idle_watts,
                power_config.max_watts,
                cpu_percent,
            )
            total_estimated_watts += estimated_watts

            # Track TDP for backwards compatibility
            if server.tdp_watts:
                total_tdp_watts += server.tdp_watts

            # US0092: Calculate cost based on machine type
            if is_workstation:
                workstation_count += 1
                hours_used = uptime_data.get(server.id, 0.0)
                monthly = calculate_workstation_cost(power_config.max_watts, hours_used, rate)
                daily = round(monthly / 30, 2) if monthly > 0 else 0.0
                workstation_cost_total += monthly
                workstation_daily_total += daily
            else:
                server_count += 1
                daily = calc_daily_cost(estimated_watts, rate)
                monthly = round(daily * 30, 2)
                server_cost_total += monthly
                server_daily_total += daily

        elif server.tdp_watts is not None:
            # Fallback: TDP-only mode (AC5)
            servers_configured += 1
            total_tdp_watts += server.tdp_watts
            # In TDP-only mode, assume TDP as estimated power
            total_estimated_watts += server.tdp_watts

            # US0092: Calculate cost based on machine type
            if is_workstation:
                workstation_count += 1
                hours_used = uptime_data.get(server.id, 0.0)
                monthly = calculate_workstation_cost(server.tdp_watts, hours_used, rate)
                daily = round(monthly / 30, 2) if monthly > 0 else 0.0
                workstation_cost_total += monthly
                workstation_daily_total += daily
            else:
                server_count += 1
                daily = calc_daily_cost(server.tdp_watts, rate)
                monthly = round(daily * 30, 2)
                server_cost_total += monthly
                server_daily_total += daily

        else:
            # No configuration
            servers_unconfigured += 1

    # Calculate totals by summing individual costs (ensures consistency with breakdown)
    daily_cost = round(server_daily_total + workstation_daily_total, 2)
    monthly_cost = round(server_cost_total + workstation_cost_total, 2)

    return CostSummaryResponse(
        daily_cost=daily_cost,
        monthly_cost=monthly_cost,
        currency_symbol=cost_config.currency_symbol,
        servers_included=servers_configured,
        servers_missing_config=servers_unconfigured,
        total_estimated_watts=round(total_estimated_watts, 1),
        electricity_rate=rate,
        # US0092: Server vs workstation breakdown (AC5)
        server_cost_total=round(server_cost_total, 2),
        server_count=server_count,
        workstation_cost_total=round(workstation_cost_total, 2),
        workstation_count=workstation_count,
        # Deprecated fields for backwards compatibility
        servers_missing_tdp=servers_unconfigured,
        total_tdp_watts=total_tdp_watts,
    )


@router.get(
    "/breakdown",
    response_model=CostBreakdownResponse,
    operation_id="get_cost_breakdown",
    summary="Get per-server electricity cost breakdown",
    responses={**AUTH_RESPONSES},
)
async def get_cost_breakdown(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CostBreakdownResponse:
    """Get per-server electricity cost breakdown.

    Returns a list of servers with their individual power estimates and costs
    based on actual CPU usage. Servers without power configuration appear last
    with null costs.

    US0092: Workstations show hours_used and use actual_usage calculation type.

    Returns:
        Cost breakdown including per-server costs, totals, and settings
    """
    # Get all servers
    result = await session.execute(select(Server))
    servers = result.scalars().all()

    # Get cost configuration
    cost_data = await get_config_value(session, "cost")
    if cost_data:
        cost_config = CostConfig(**cost_data)
    else:
        cost_config = DEFAULT_COST

    rate = cost_config.electricity_rate

    # US0092: Get uptime data for workstations (last 30 days)
    today = date.today()
    start_date = today - timedelta(days=30)
    uptime_data = await get_all_uptime_for_period(session, start_date, today)

    # Build server cost items
    configured_servers: list[ServerCostItem] = []
    unconfigured_servers: list[ServerCostItem] = []
    total_estimated_watts = 0.0
    total_tdp_watts = 0

    for server in servers:
        is_workstation = server.machine_type == "workstation"
        machine_type = "workstation" if is_workstation else "server"
        hours_used = uptime_data.get(server.id, 0.0) if is_workstation else None
        calculation_type = "actual_usage" if is_workstation else "24x7"

        # Try to get power configuration (category-based)
        power_config = get_power_config(
            server.machine_category,
            server.machine_category_source,
            server.idle_watts,
            server.tdp_watts,
        )

        if power_config:
            # Server has power configuration - use usage-based calculation
            avg_cpu = await get_avg_cpu_24h(session, server.id)
            cpu_percent = avg_cpu if avg_cpu is not None else DEFAULT_CPU_PERCENT

            # Calculate estimated power (AC1)
            estimated_watts = calculate_power_watts(
                power_config.idle_watts,
                power_config.max_watts,
                cpu_percent,
            )

            # US0092: Calculate cost based on machine type
            if is_workstation:
                monthly = calculate_workstation_cost(
                    power_config.max_watts, hours_used or 0.0, rate
                )
                daily = round(monthly / 30, 2) if monthly > 0 else 0.0
            else:
                daily = calc_daily_cost(estimated_watts, rate)
                monthly = round(daily * 30, 2)

            item = ServerCostItem(
                server_id=server.id,
                hostname=server.hostname,
                machine_type=machine_type,
                machine_category=server.machine_category,
                machine_category_label=get_category_label(server.machine_category),
                machine_category_source=server.machine_category_source,
                cpu_model=server.cpu_model,
                idle_watts=power_config.idle_watts,
                tdp_watts=power_config.max_watts,
                estimated_watts=round(estimated_watts, 1),
                avg_cpu_percent=round(cpu_percent, 1),
                hours_used=hours_used,
                calculation_type=calculation_type,
                daily_cost=daily,
                monthly_cost=monthly,
            )
            configured_servers.append(item)
            total_estimated_watts += estimated_watts
            total_tdp_watts += power_config.max_watts

        elif server.tdp_watts is not None:
            # Fallback: TDP-only mode (AC5)
            # US0092: Calculate cost based on machine type
            if is_workstation:
                monthly = calculate_workstation_cost(server.tdp_watts, hours_used or 0.0, rate)
                daily = round(monthly / 30, 2) if monthly > 0 else 0.0
            else:
                daily = calc_daily_cost(server.tdp_watts, rate)
                monthly = round(daily * 30, 2)

            item = ServerCostItem(
                server_id=server.id,
                hostname=server.hostname,
                machine_type=machine_type,
                machine_category=None,
                machine_category_label=None,
                machine_category_source=None,
                cpu_model=server.cpu_model,
                idle_watts=None,
                tdp_watts=server.tdp_watts,
                estimated_watts=float(server.tdp_watts),  # TDP used as estimate
                avg_cpu_percent=None,  # No usage-based calculation
                hours_used=hours_used,
                calculation_type=calculation_type,
                daily_cost=daily,
                monthly_cost=monthly,
            )
            configured_servers.append(item)
            total_estimated_watts += server.tdp_watts
            total_tdp_watts += server.tdp_watts

        else:
            # No configuration
            item = ServerCostItem(
                server_id=server.id,
                hostname=server.hostname,
                machine_type=machine_type,
                machine_category=server.machine_category,
                machine_category_label=get_category_label(server.machine_category),
                machine_category_source=server.machine_category_source,
                cpu_model=server.cpu_model,
                idle_watts=None,
                tdp_watts=None,
                estimated_watts=None,
                avg_cpu_percent=None,
                hours_used=hours_used,
                calculation_type=calculation_type,
                daily_cost=None,
                monthly_cost=None,
            )
            unconfigured_servers.append(item)

    # Sort configured servers by monthly_cost descending
    configured_servers.sort(key=lambda s: s.monthly_cost or 0, reverse=True)

    # Combine: configured first (sorted by cost), then unconfigured
    all_servers = configured_servers + unconfigured_servers

    # Calculate totals by summing individual item costs
    # This ensures consistency with summary endpoint which uses the same per-item calculations
    total_daily = sum(s.daily_cost or 0 for s in configured_servers)
    total_monthly = sum(s.monthly_cost or 0 for s in configured_servers)

    totals = CostTotals(
        servers_configured=len(configured_servers),
        servers_unconfigured=len(unconfigured_servers),
        total_estimated_watts=round(total_estimated_watts, 1),
        daily_cost=round(total_daily, 2),
        monthly_cost=round(total_monthly, 2),
        # Deprecated fields for backwards compatibility
        servers_with_tdp=len(configured_servers),
        servers_without_tdp=len(unconfigured_servers),
        total_tdp_watts=total_tdp_watts,
    )

    settings = CostSettings(
        electricity_rate=cost_config.electricity_rate,
        currency_symbol=cost_config.currency_symbol,
    )

    return CostBreakdownResponse(
        servers=all_servers,
        totals=totals,
        settings=settings,
    )
