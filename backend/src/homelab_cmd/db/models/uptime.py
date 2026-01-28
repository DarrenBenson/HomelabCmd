"""Uptime tracking models for HomelabCmd.

This module stores daily uptime aggregations for workstation cost calculation.
Workstations have intermittent availability, so costs are based on actual
uptime rather than 24/7 assumptions.

US0092: Workstation Cost Tracking
"""

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server


class ServerUptimeDaily(Base):
    """Daily uptime aggregation for cost calculation.

    Tracks cumulative uptime hours per server per day. Used for workstation
    cost calculation based on actual usage rather than 24/7 assumptions.

    Attributes:
        id: Auto-incrementing primary key
        server_id: Foreign key to the server
        date: The date this uptime record is for
        uptime_hours: Cumulative uptime hours for the day (0-24)
        last_updated: Timestamp of last update
    """

    __tablename__ = "server_uptime_daily"

    __table_args__ = (
        UniqueConstraint("server_id", "date", name="uq_server_uptime_daily_server_date"),
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

    # The date this uptime record is for
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Cumulative uptime hours for the day (capped at 24)
    uptime_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Timestamp of last update
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationship to server
    server: Mapped["Server"] = relationship("Server", lazy="select")

    def __repr__(self) -> str:
        """Return string representation of the uptime record."""
        return (
            f"<ServerUptimeDaily(id={self.id}, server_id={self.server_id!r}, "
            f"date={self.date}, uptime_hours={self.uptime_hours})>"
        )
