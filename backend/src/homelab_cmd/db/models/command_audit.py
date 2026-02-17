"""Command audit log models for HomelabCmd.

This module contains the model for immutable command execution audit logging.
Part of US0155: Command Execution Audit Trail (EP0013).

The audit log is append-only - no update or delete operations are exposed.
"""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from homelab_cmd.db.base import Base

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server


class CommandAuditLog(Base):
    """SQLAlchemy model for command execution audit log.

    This table provides an immutable audit trail of all command executions
    for security compliance and incident investigation.

    Attributes:
        id: Unique identifier (autoincrement)
        server_id: Reference to the server where command was executed
        command: The actual command that was executed
        action_type: Type of action (e.g., 'restart_service', 'apply_updates')
        exit_code: Command exit code (0 = success)
        stdout: Command standard output (truncated to 10KB)
        stderr: Command standard error (truncated to 10KB)
        duration_ms: Command execution duration in milliseconds
        executed_at: When the command was executed
        executed_by: Who initiated the command (default: 'dashboard')
    """

    __tablename__ = "command_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    command: Mapped[str] = mapped_column(Text, nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout: Mapped[str | None] = mapped_column(Text, nullable=True)
    stderr: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    executed_by: Mapped[str] = mapped_column(String(255), default="dashboard", nullable=False)

    # Relationship to server (read-only for audit purposes)
    server: Mapped["Server"] = relationship("Server", back_populates="command_audit_logs")

    __table_args__ = (
        Index("idx_command_audit_server_date", "server_id", "executed_at"),
        Index("idx_command_audit_type_date", "action_type", "executed_at"),
        Index("idx_command_audit_date", "executed_at"),
    )

    def __repr__(self) -> str:
        """Return string representation of the audit log entry."""
        return (
            f"<CommandAuditLog(id={self.id!r}, server_id={self.server_id!r}, "
            f"action_type={self.action_type!r}, exit_code={self.exit_code!r})>"
        )
