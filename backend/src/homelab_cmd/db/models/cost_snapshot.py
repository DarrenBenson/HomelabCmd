"""Cost snapshot models for historical cost tracking.

US0183: Historical Cost Tracking (EP0005)

Stores daily cost snapshots for each server and monthly aggregates for
long-term retention. Daily snapshots are rolled up to monthly after 2 years.

Retention tiers:
- Daily: 2-year retention
- Monthly: Indefinite retention
"""

from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from homelab_cmd.db.base import Base


class CostSnapshot(Base):
    """Daily cost snapshot for a server.

    Records the estimated electricity cost for a server on a specific date.
    Captures the configuration at the time of snapshot to enable historical
    analysis even if server configuration changes.

    AC1: Daily cost snapshot recorded with required fields.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Foreign key to the server
        date: Date of the snapshot (one per server per day)
        estimated_kwh: Estimated kWh consumed that day
        estimated_cost: Cost in configured currency
        electricity_rate: Rate per kWh at time of snapshot
        tdp_watts: Max power (TDP) at time of snapshot
        idle_watts: Idle power at time of snapshot
        avg_cpu_percent: Average CPU usage for the day
        machine_type: 'server' or 'workstation'
        hours_used: Hours of operation (workstations only)
    """

    __tablename__ = "cost_snapshots"

    __table_args__ = (
        # Unique constraint: one snapshot per server per day
        UniqueConstraint("server_id", "date", name="uq_cost_snapshot"),
        # Composite index for efficient date range queries
        Index("idx_cost_snapshot_server_date", "server_id", "date"),
        # Index for fleet-wide queries by date
        Index("idx_cost_snapshot_date", "date"),
    )

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to server
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Date of snapshot
    date: Mapped[date] = mapped_column(Date, nullable=False)

    # Cost data
    estimated_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_cost: Mapped[float] = mapped_column(Float, nullable=False)
    electricity_rate: Mapped[float] = mapped_column(Float, nullable=False)

    # Power configuration at time of snapshot
    tdp_watts: Mapped[int | None] = mapped_column(Integer, nullable=True)
    idle_watts: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Machine type for different calculation methods
    machine_type: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Workstation-specific: actual hours of operation
    hours_used: Mapped[float | None] = mapped_column(Float, nullable=True)

    def __repr__(self) -> str:
        """Return string representation of the cost snapshot."""
        return (
            f"<CostSnapshot(id={self.id}, server_id={self.server_id!r}, "
            f"date={self.date}, cost={self.estimated_cost})>"
        )


class CostSnapshotMonthly(Base):
    """Monthly aggregated cost snapshot.

    AC6: Data retention - monthly aggregates for data older than 2 years.

    Created by rolling up daily snapshots. Server_id is nullable to allow
    retention of historical data even after server deletion.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Foreign key to server (nullable for deleted servers)
        year_month: Year-month string "YYYY-MM"
        total_kwh: Total kWh for the month
        total_cost: Total cost for the month
        avg_electricity_rate: Average rate for the month
        snapshot_count: Number of daily snapshots aggregated
    """

    __tablename__ = "cost_snapshots_monthly"

    __table_args__ = (
        # Unique constraint: one monthly record per server per month
        UniqueConstraint("server_id", "year_month", name="uq_monthly_cost_snapshot"),
        # Index for efficient queries
        Index("idx_cost_snapshot_monthly_server", "server_id", "year_month"),
        Index("idx_cost_snapshot_monthly_ym", "year_month"),
    )

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to server (nullable for historical data after server deletion)
    server_id: Mapped[str | None] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Year-month identifier (e.g., "2026-01")
    year_month: Mapped[str] = mapped_column(String(7), nullable=False)

    # Aggregated cost data
    total_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    total_cost: Mapped[float] = mapped_column(Float, nullable=False)
    avg_electricity_rate: Mapped[float] = mapped_column(Float, nullable=False)

    # Number of daily snapshots included in this aggregate
    snapshot_count: Mapped[int] = mapped_column(Integer, nullable=False)

    def __repr__(self) -> str:
        """Return string representation of the monthly cost snapshot."""
        return (
            f"<CostSnapshotMonthly(id={self.id}, server_id={self.server_id!r}, "
            f"year_month={self.year_month!r}, cost={self.total_cost})>"
        )
