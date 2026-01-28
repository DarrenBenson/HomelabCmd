"""Remediation action models for HomelabCmd.

This module contains models for tracking remediation actions (service restarts,
etc.) queued from the dashboard. Actions start as "pending" and are processed
in EP0004 (Remediation Engine).
"""

from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server


class ActionStatus(str, Enum):
    """Status values for a remediation action.

    State machine:
        pending → approved → executing → completed
                    │           │
                    │           └─► failed
                    │
                    └─► rejected (terminal)

    For normal servers (is_paused=false), actions skip pending and start at approved.
    """

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class RemediationAction(Base):
    """SQLAlchemy model for a remediation action.

    Attributes:
        id: Unique identifier (autoincrement)
        server_id: Reference to the server
        action_type: Type of action (e.g., 'restart_service')
        status: Current status (default: pending)
        service_name: Service name for restart actions
        command: The command to execute
        created_at: Record creation timestamp
        created_by: Who created the action (default: 'dashboard')
        alert_id: Optional reference to the triggering alert
        approved_at: When the action was approved
        approved_by: Who approved the action ('auto' for normal servers)
        rejected_at: When the action was rejected
        rejected_by: Who rejected the action
        rejection_reason: Why the action was rejected
        executed_at: When execution started
        completed_at: When execution completed
        exit_code: Command exit code
        stdout: Command standard output
        stderr: Command standard error
    """

    __tablename__ = "remediation_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=ActionStatus.PENDING.value, nullable=False
    )
    service_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    command: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    created_by: Mapped[str] = mapped_column(String(50), default="dashboard", nullable=False)

    # Optional link to triggering alert (US0023 AC7)
    alert_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("alerts.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Approval tracking fields (US0023 AC5)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Rejection tracking fields (US0023 AC4)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Execution result fields (US0023 AC6)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout: Mapped[str | None] = mapped_column(Text, nullable=True)
    stderr: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationship to server
    server: Mapped["Server"] = relationship("Server", back_populates="remediation_actions")

    __table_args__ = (
        Index("idx_remediation_actions_server_status", "server_id", "status"),
        Index("idx_remediation_actions_status", "status"),
    )

    def __repr__(self) -> str:
        """Return string representation of the remediation action."""
        return (
            f"<RemediationAction(id={self.id!r}, server_id={self.server_id!r}, "
            f"action_type={self.action_type!r}, status={self.status!r})>"
        )
