"""Pydantic schemas for Cost History API endpoints.

US0183: Historical Cost Tracking (EP0005)

Defines schemas for cost history, monthly summary, and per-server history APIs.
"""

from pydantic import BaseModel, Field


class CostHistoryItem(BaseModel):
    """Single cost history record."""

    date: str = Field(description="ISO date string or period label (e.g., '2026-01', 'W01')")
    estimated_kwh: float = Field(description="Estimated kWh consumed")
    estimated_cost: float = Field(description="Estimated cost in configured currency")
    electricity_rate: float = Field(description="Electricity rate per kWh")
    server_id: str | None = Field(default=None, description="Server ID (if filtered)")
    server_hostname: str | None = Field(default=None, description="Server hostname (if available)")


class CostHistoryResponse(BaseModel):
    """Response for cost history endpoint.

    AC2: Historical cost API with filtering and aggregation.
    """

    items: list[CostHistoryItem] = Field(description="Cost history records")
    aggregation: str = Field(description="Aggregation level: 'daily', 'weekly', or 'monthly'")
    start_date: str = Field(description="Start of date range (ISO format)")
    end_date: str = Field(description="End of date range (ISO format)")
    currency_symbol: str = Field(description="Currency symbol (e.g., '$', '£')")


class MonthlySummaryItem(BaseModel):
    """Monthly cost summary record."""

    year_month: str = Field(description="Year-month string 'YYYY-MM'")
    total_cost: float = Field(description="Total cost for the month")
    total_kwh: float = Field(description="Total kWh for the month")
    previous_month_cost: float | None = Field(
        default=None, description="Previous month's cost (for first month, None)"
    )
    change_percent: float | None = Field(
        default=None, description="Month-over-month change percentage"
    )


class MonthlySummaryResponse(BaseModel):
    """Response for monthly summary endpoint.

    AC5: Monthly cost summary with YTD.
    """

    months: list[MonthlySummaryItem] = Field(description="Monthly cost summaries")
    year: int = Field(description="Year of the summary")
    year_to_date_cost: float = Field(description="Year-to-date total cost")
    currency_symbol: str = Field(description="Currency symbol (e.g., '$', '£')")


class ServerCostHistoryResponse(BaseModel):
    """Response for per-server cost history endpoint.

    AC4: Per-server cost history.
    """

    server_id: str = Field(description="Server identifier")
    hostname: str = Field(description="Server hostname")
    period: str = Field(description="Period: '7d', '30d', '90d', or '12m'")
    items: list[CostHistoryItem] = Field(description="Cost history records")
    currency_symbol: str = Field(description="Currency symbol (e.g., '$', '£')")
