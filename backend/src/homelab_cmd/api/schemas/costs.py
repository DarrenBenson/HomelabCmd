"""Pydantic schemas for Cost API endpoints.

This module defines the schemas for the cost summary and breakdown APIs.
"""

from pydantic import BaseModel, Field


class CostSummaryResponse(BaseModel):
    """Response for cost summary endpoint.

    Returns calculated electricity costs based on server power estimates
    and configured electricity rate. Includes separate breakdown for
    servers (24/7) and workstations (actual usage).
    """

    daily_cost: float
    monthly_cost: float
    currency_symbol: str
    servers_included: int
    servers_missing_config: int = Field(
        description="Servers without power configuration (category or TDP)"
    )
    total_estimated_watts: float = Field(description="Total estimated power draw based on usage")
    electricity_rate: float
    # US0092: Server vs workstation breakdown (AC5)
    server_cost_total: float = Field(
        default=0.0, description="Total monthly cost for servers (24/7 calculation)"
    )
    server_count: int = Field(default=0, description="Number of servers with power config")
    workstation_cost_total: float = Field(
        default=0.0, description="Total monthly cost for workstations (actual usage)"
    )
    workstation_count: int = Field(
        default=0, description="Number of workstations with power config"
    )
    # Deprecated fields for backwards compatibility
    servers_missing_tdp: int = Field(description="Deprecated: use servers_missing_config instead")
    total_tdp_watts: int = Field(description="Deprecated: use total_estimated_watts instead")


class ServerCostItem(BaseModel):
    """Per-server cost information for breakdown endpoint."""

    server_id: str
    hostname: str
    # US0092: Machine type (server or workstation)
    machine_type: str = Field(default="server", description="'server' or 'workstation'")
    # Power configuration
    machine_category: str | None = Field(
        None, description="Machine category (e.g., 'mini_pc', 'workstation')"
    )
    machine_category_label: str | None = Field(None, description="Human-readable category label")
    machine_category_source: str | None = Field(
        None, description="'auto' or 'user' - how category was set"
    )
    cpu_model: str | None = Field(None, description="CPU model from agent")
    # Power values
    idle_watts: int | None = Field(None, description="Power at idle")
    tdp_watts: int | None = Field(None, description="Max power / TDP")
    estimated_watts: float | None = Field(
        None, description="Estimated power based on avg CPU usage"
    )
    avg_cpu_percent: float | None = Field(None, description="Average CPU usage (last 24h)")
    # US0092: Workstation-specific fields (AC3)
    hours_used: float | None = Field(
        None, description="Hours used in period (workstations only)"
    )
    calculation_type: str = Field(
        default="24x7", description="'24x7' for servers, 'actual_usage' for workstations"
    )
    # Cost values
    daily_cost: float | None
    monthly_cost: float | None


class CostTotals(BaseModel):
    """Aggregate cost totals for breakdown endpoint."""

    servers_configured: int = Field(description="Servers with power configuration")
    servers_unconfigured: int = Field(description="Servers without power configuration")
    total_estimated_watts: float = Field(description="Total estimated power draw")
    daily_cost: float
    monthly_cost: float
    # Deprecated fields for backwards compatibility
    servers_with_tdp: int = Field(description="Deprecated: use servers_configured instead")
    servers_without_tdp: int = Field(description="Deprecated: use servers_unconfigured instead")
    total_tdp_watts: int = Field(description="Deprecated: use total_estimated_watts instead")


class CostSettings(BaseModel):
    """Cost configuration settings for breakdown endpoint."""

    electricity_rate: float
    currency_symbol: str


class CostBreakdownResponse(BaseModel):
    """Response for cost breakdown endpoint.

    Returns per-server cost breakdown with totals and settings.
    """

    servers: list[ServerCostItem]
    totals: CostTotals
    settings: CostSettings
