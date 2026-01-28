"""Metrics history API schemas."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class TimeRange(str, Enum):
    """Valid time ranges for metrics history.

    Different ranges query different data tiers (US0046):
    - 24h: Raw metrics (1-minute resolution)
    - 7d: Raw metrics with hourly aggregation
    - 30d: Hourly aggregate table
    - 12m: Daily aggregate table
    """

    HOURS_24 = "24h"
    DAYS_7 = "7d"
    DAYS_30 = "30d"
    MONTHS_12 = "12m"


class MetricPoint(BaseModel):
    """A single data point in the metrics time series."""

    model_config = ConfigDict(from_attributes=True)

    timestamp: datetime = Field(..., description="When the metrics were recorded")
    cpu_percent: float | None = Field(None, description="CPU usage percentage (0-100)")
    memory_percent: float | None = Field(None, description="Memory usage percentage (0-100)")
    disk_percent: float | None = Field(None, description="Disk usage percentage (0-100)")


class MetricsHistoryResponse(BaseModel):
    """Response schema for metrics history endpoint."""

    server_id: str = Field(..., description="Server identifier")
    range: str = Field(..., description="Time range requested (24h, 7d, 30d, 12m)")
    resolution: str = Field(..., description="Data resolution (1m, 1h, 4h, 1d)")
    data_points: list[MetricPoint] = Field(
        default_factory=list, description="Time-series data points"
    )
    total_points: int = Field(..., description="Number of data points returned")


# US0113: Sparkline schemas for inline metric charts


class SparklinePoint(BaseModel):
    """A single data point for sparkline display.

    Simplified format with just timestamp and value for efficient transfer.
    """

    timestamp: datetime = Field(..., description="When the metric was recorded")
    value: float | None = Field(None, description="Metric value (0-100 for percentages)")


class SparklineResponse(BaseModel):
    """Response schema for sparkline endpoint.

    Returns a lightweight array of data points suitable for rendering
    a small inline chart on server cards.
    """

    server_id: str = Field(..., description="Server identifier")
    metric: str = Field(..., description="Metric type (cpu_percent, memory_percent, etc.)")
    period: str = Field(..., description="Time period covered (e.g., 30m)")
    data: list[SparklinePoint] = Field(
        default_factory=list, description="Time-series data points for sparkline"
    )
