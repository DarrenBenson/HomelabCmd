"""Metrics history API endpoints.

Supports tiered data storage (US0046):
- Raw metrics: 60-second granularity, 7-day retention
- Hourly aggregates: 1-hour granularity, 90-day retention
- Daily aggregates: 1-day granularity, 12-month retention

Supports metrics export (US0048):
- CSV and JSON export formats
- Exports respect selected time range
- Uses appropriate data tier for each range
"""

import csv
import json as json_module
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from enum import Enum
from io import StringIO
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.metrics import MetricPoint, MetricsHistoryResponse, TimeRange
from homelab_cmd.db.models.metrics import Metrics, MetricsDaily, MetricsHourly
from homelab_cmd.db.models.server import Server
from homelab_cmd.db.session import get_async_session

router = APIRouter(prefix="/servers", tags=["Metrics"])


class DataTier(str, Enum):
    """Data tier for metrics queries."""

    RAW = "raw"
    RAW_AGGREGATED = "raw_aggregated"  # Query raw, aggregate in Python
    HOURLY = "hourly"
    DAILY = "daily"


class ExportFormat(str, Enum):
    """Supported export formats (US0048)."""

    CSV = "csv"
    JSON = "json"


# Time range configuration: (hours, resolution_label, data_tier, aggregation_seconds)
# aggregation_seconds only applies when data_tier is RAW_AGGREGATED
RANGE_CONFIG: dict[TimeRange, tuple[int, str, DataTier, int]] = {
    TimeRange.HOURS_24: (24, "1m", DataTier.RAW, 0),  # Raw data, no aggregation
    TimeRange.DAYS_7: (168, "1h", DataTier.RAW_AGGREGATED, 3600),  # Query raw, aggregate
    TimeRange.DAYS_30: (720, "1h", DataTier.HOURLY, 0),  # Query hourly table
    TimeRange.MONTHS_12: (8760, "1d", DataTier.DAILY, 0),  # Query daily table (365 days)
}


def aggregate_metrics(metrics: list[Metrics], aggregation_seconds: int) -> list[MetricPoint]:
    """Aggregate metrics by time bucket.

    Groups raw metrics into time buckets and calculates averages for each bucket.

    Args:
        metrics: Raw metrics records from database.
        aggregation_seconds: Size of each time bucket in seconds.

    Returns:
        List of MetricPoint with aggregated values.
    """
    if aggregation_seconds == 0:
        # No aggregation, return raw data
        return [
            MetricPoint(
                timestamp=m.timestamp,
                cpu_percent=m.cpu_percent,
                memory_percent=m.memory_percent,
                disk_percent=m.disk_percent,
            )
            for m in metrics
        ]

    # Group by time bucket
    buckets: dict[datetime, list[Metrics]] = defaultdict(list)
    for m in metrics:
        # Calculate bucket start time
        ts = m.timestamp.timestamp()
        bucket_ts = (int(ts) // aggregation_seconds) * aggregation_seconds
        bucket_dt = datetime.fromtimestamp(bucket_ts, tz=UTC)
        buckets[bucket_dt].append(m)

    # Calculate averages for each bucket
    result: list[MetricPoint] = []
    for bucket_dt in sorted(buckets.keys()):
        bucket_metrics = buckets[bucket_dt]

        # Calculate averages, filtering out None values
        cpu_values = [m.cpu_percent for m in bucket_metrics if m.cpu_percent is not None]
        memory_values = [m.memory_percent for m in bucket_metrics if m.memory_percent is not None]
        disk_values = [m.disk_percent for m in bucket_metrics if m.disk_percent is not None]

        result.append(
            MetricPoint(
                timestamp=bucket_dt,
                cpu_percent=round(sum(cpu_values) / len(cpu_values), 2) if cpu_values else None,
                memory_percent=round(sum(memory_values) / len(memory_values), 2)
                if memory_values
                else None,
                disk_percent=round(sum(disk_values) / len(disk_values), 2) if disk_values else None,
            )
        )

    return result


def convert_hourly_to_points(hourly_metrics: list[MetricsHourly]) -> list[MetricPoint]:
    """Convert hourly aggregate records to MetricPoints.

    Uses the average values from the aggregates.
    """
    return [
        MetricPoint(
            timestamp=m.timestamp,
            cpu_percent=round(m.cpu_avg, 2) if m.cpu_avg is not None else None,
            memory_percent=round(m.memory_avg, 2) if m.memory_avg is not None else None,
            disk_percent=round(m.disk_avg, 2) if m.disk_avg is not None else None,
        )
        for m in hourly_metrics
    ]


def convert_daily_to_points(daily_metrics: list[MetricsDaily]) -> list[MetricPoint]:
    """Convert daily aggregate records to MetricPoints.

    Uses the average values from the aggregates.
    """
    return [
        MetricPoint(
            timestamp=m.timestamp,
            cpu_percent=round(m.cpu_avg, 2) if m.cpu_avg is not None else None,
            memory_percent=round(m.memory_avg, 2) if m.memory_avg is not None else None,
            disk_percent=round(m.disk_avg, 2) if m.disk_avg is not None else None,
        )
        for m in daily_metrics
    ]


@router.get(
    "/{server_id}/metrics",
    response_model=MetricsHistoryResponse,
    operation_id="get_server_metrics",
    summary="Get historical metrics for a server",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_metrics_history(
    server_id: str,
    range: TimeRange = Query(
        default=TimeRange.HOURS_24,
        description="Time range for metrics history",
    ),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> MetricsHistoryResponse:
    """Get historical metrics for a server.

    Returns time-series data for CPU, memory, and disk usage over the
    specified time range. Data is sourced from the appropriate tier:

    - **24h**: Raw data points (no aggregation)
    - **7d**: Raw data with hourly aggregation
    - **30d**: Hourly aggregate table (1-hour resolution)
    - **12m**: Daily aggregate table (1-day resolution)
    """
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Get range configuration
    hours, resolution, data_tier, aggregation_seconds = RANGE_CONFIG[range]
    cutoff = datetime.now(UTC) - timedelta(hours=hours)

    data_points: list[MetricPoint] = []

    if data_tier == DataTier.RAW:
        # Query raw metrics, no aggregation
        result = await session.execute(
            select(Metrics)
            .where(Metrics.server_id == server_id)
            .where(Metrics.timestamp >= cutoff)
            .order_by(Metrics.timestamp)
        )
        raw_metrics = list(result.scalars().all())
        data_points = aggregate_metrics(raw_metrics, 0)

    elif data_tier == DataTier.RAW_AGGREGATED:
        # Query raw metrics, aggregate in Python
        result = await session.execute(
            select(Metrics)
            .where(Metrics.server_id == server_id)
            .where(Metrics.timestamp >= cutoff)
            .order_by(Metrics.timestamp)
        )
        raw_metrics = list(result.scalars().all())
        data_points = aggregate_metrics(raw_metrics, aggregation_seconds)

    elif data_tier == DataTier.HOURLY:
        # Query hourly aggregate table
        result = await session.execute(
            select(MetricsHourly)
            .where(MetricsHourly.server_id == server_id)
            .where(MetricsHourly.timestamp >= cutoff)
            .order_by(MetricsHourly.timestamp)
        )
        hourly_metrics = list(result.scalars().all())
        data_points = convert_hourly_to_points(hourly_metrics)

    elif data_tier == DataTier.DAILY:
        # Query daily aggregate table
        result = await session.execute(
            select(MetricsDaily)
            .where(MetricsDaily.server_id == server_id)
            .where(MetricsDaily.timestamp >= cutoff)
            .order_by(MetricsDaily.timestamp)
        )
        daily_metrics = list(result.scalars().all())
        data_points = convert_daily_to_points(daily_metrics)

    return MetricsHistoryResponse(
        server_id=server_id,
        range=range.value,
        resolution=resolution,
        data_points=data_points,
        total_points=len(data_points),
    )


def _export_csv(
    data: list[dict[str, Any]],
    filename: str,
    tier: DataTier,
) -> StreamingResponse:
    """Generate CSV response for metrics export.

    Args:
        data: List of metric dictionaries.
        filename: Output filename.
        tier: Data tier determines column format.

    Returns:
        StreamingResponse with CSV content.
    """
    output = StringIO()
    writer = csv.writer(output)

    if tier in (DataTier.RAW, DataTier.RAW_AGGREGATED):
        # Simple format for raw data
        writer.writerow(["timestamp", "cpu_percent", "memory_percent", "disk_percent"])
        for point in data:
            writer.writerow(
                [
                    point["timestamp"],
                    point["cpu_percent"],
                    point["memory_percent"],
                    point["disk_percent"],
                ]
            )
    else:
        # Aggregate format with min/max for hourly/daily
        writer.writerow(
            [
                "timestamp",
                "cpu_avg",
                "cpu_min",
                "cpu_max",
                "memory_avg",
                "memory_min",
                "memory_max",
                "disk_avg",
                "disk_min",
                "disk_max",
            ]
        )
        for point in data:
            writer.writerow(
                [
                    point["timestamp"],
                    point.get("cpu_avg"),
                    point.get("cpu_min"),
                    point.get("cpu_max"),
                    point.get("memory_avg"),
                    point.get("memory_min"),
                    point.get("memory_max"),
                    point.get("disk_avg"),
                    point.get("disk_min"),
                    point.get("disk_max"),
                ]
            )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _export_json(
    data: list[dict[str, Any]],
    filename: str,
    server_id: str,
    server_name: str,
    range_value: str,
) -> StreamingResponse:
    """Generate JSON response for metrics export.

    Args:
        data: List of metric dictionaries.
        filename: Output filename.
        server_id: Server identifier.
        server_name: Server display name.
        range_value: Time range string.

    Returns:
        StreamingResponse with JSON content.
    """
    export_data = {
        "server_id": server_id,
        "server_name": server_name,
        "range": range_value,
        "exported_at": datetime.now(UTC).isoformat(),
        "data_points": data,
    }

    content = json_module.dumps(export_data, indent=2, default=str)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _raw_metrics_to_export_dicts(metrics: list[Metrics]) -> list[dict[str, Any]]:
    """Convert raw metrics to export dictionaries."""
    return [
        {
            "timestamp": m.timestamp.isoformat(),
            "cpu_percent": m.cpu_percent,
            "memory_percent": m.memory_percent,
            "disk_percent": m.disk_percent,
        }
        for m in metrics
    ]


def _hourly_metrics_to_export_dicts(metrics: list[MetricsHourly]) -> list[dict[str, Any]]:
    """Convert hourly aggregate metrics to export dictionaries."""
    return [
        {
            "timestamp": m.timestamp.isoformat(),
            "cpu_avg": round(m.cpu_avg, 2) if m.cpu_avg is not None else None,
            "cpu_min": round(m.cpu_min, 2) if m.cpu_min is not None else None,
            "cpu_max": round(m.cpu_max, 2) if m.cpu_max is not None else None,
            "memory_avg": round(m.memory_avg, 2) if m.memory_avg is not None else None,
            "memory_min": round(m.memory_min, 2) if m.memory_min is not None else None,
            "memory_max": round(m.memory_max, 2) if m.memory_max is not None else None,
            "disk_avg": round(m.disk_avg, 2) if m.disk_avg is not None else None,
            "disk_min": round(m.disk_min, 2) if m.disk_min is not None else None,
            "disk_max": round(m.disk_max, 2) if m.disk_max is not None else None,
        }
        for m in metrics
    ]


def _daily_metrics_to_export_dicts(metrics: list[MetricsDaily]) -> list[dict[str, Any]]:
    """Convert daily aggregate metrics to export dictionaries."""
    return [
        {
            "timestamp": m.timestamp.isoformat(),
            "cpu_avg": round(m.cpu_avg, 2) if m.cpu_avg is not None else None,
            "cpu_min": round(m.cpu_min, 2) if m.cpu_min is not None else None,
            "cpu_max": round(m.cpu_max, 2) if m.cpu_max is not None else None,
            "memory_avg": round(m.memory_avg, 2) if m.memory_avg is not None else None,
            "memory_min": round(m.memory_min, 2) if m.memory_min is not None else None,
            "memory_max": round(m.memory_max, 2) if m.memory_max is not None else None,
            "disk_avg": round(m.disk_avg, 2) if m.disk_avg is not None else None,
            "disk_min": round(m.disk_min, 2) if m.disk_min is not None else None,
            "disk_max": round(m.disk_max, 2) if m.disk_max is not None else None,
        }
        for m in metrics
    ]


@router.get(
    "/{server_id}/metrics/export",
    operation_id="export_server_metrics",
    summary="Export metrics data as CSV or JSON",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def export_metrics(
    server_id: str,
    range: TimeRange = Query(
        ...,
        description="Time range for export",
    ),
    format: ExportFormat = Query(
        default=ExportFormat.CSV,
        description="Export format (csv or json)",
    ),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> StreamingResponse:
    """Export metrics data as CSV or JSON.

    Uses the appropriate data tier based on time range:
    - **24h**: Raw data points
    - **7d**: Raw data (hourly resolution)
    - **30d**: Hourly aggregate table
    - **12m**: Daily aggregate table

    Returns a downloadable file with the metrics data.
    """
    # Verify server exists
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": f"Server '{server_id}' not found"},
        )

    # Get range configuration
    hours, _resolution, data_tier, _aggregation_seconds = RANGE_CONFIG[range]
    cutoff = datetime.now(UTC) - timedelta(hours=hours)

    data: list[dict[str, Any]] = []

    if data_tier in (DataTier.RAW, DataTier.RAW_AGGREGATED):
        # Query raw metrics
        result = await session.execute(
            select(Metrics)
            .where(Metrics.server_id == server_id)
            .where(Metrics.timestamp >= cutoff)
            .order_by(Metrics.timestamp)
        )
        raw_metrics = list(result.scalars().all())
        data = _raw_metrics_to_export_dicts(raw_metrics)

    elif data_tier == DataTier.HOURLY:
        # Query hourly aggregate table
        result = await session.execute(
            select(MetricsHourly)
            .where(MetricsHourly.server_id == server_id)
            .where(MetricsHourly.timestamp >= cutoff)
            .order_by(MetricsHourly.timestamp)
        )
        hourly_metrics = list(result.scalars().all())
        data = _hourly_metrics_to_export_dicts(hourly_metrics)

    elif data_tier == DataTier.DAILY:
        # Query daily aggregate table
        result = await session.execute(
            select(MetricsDaily)
            .where(MetricsDaily.server_id == server_id)
            .where(MetricsDaily.timestamp >= cutoff)
            .order_by(MetricsDaily.timestamp)
        )
        daily_metrics = list(result.scalars().all())
        data = _daily_metrics_to_export_dicts(daily_metrics)

    # Generate filename: {server_id}-metrics-{range}-{date}.{format}
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    filename = f"{server_id}-metrics-{range.value}-{today}.{format.value}"

    # Return appropriate format
    if format == ExportFormat.CSV:
        return _export_csv(data, filename, data_tier)
    else:
        return _export_json(data, filename, server_id, server.display_name, range.value)
