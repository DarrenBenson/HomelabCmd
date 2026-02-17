"""Pydantic schemas for command execution audit API.

Part of EP0013: Synchronous Command Execution - US0155 Command Execution Audit Trail.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class CommandAuditEntry(BaseModel):
    """Schema for a single command audit log entry."""

    id: int = Field(..., description="Unique identifier")
    server_id: str = Field(..., description="ID of the server where command was executed")
    command: str = Field(..., description="The command that was executed")
    action_type: str = Field(..., description="Type of action (e.g., 'restart_service')")
    exit_code: int | None = Field(None, description="Command exit code (0 = success)")
    stdout: str | None = Field(None, description="Command standard output (truncated to 10KB)")
    stderr: str | None = Field(None, description="Command standard error (truncated to 10KB)")
    duration_ms: int | None = Field(None, description="Execution duration in milliseconds")
    executed_at: datetime = Field(..., description="When the command was executed")
    executed_by: str = Field(..., description="Who initiated the command")

    model_config = {"from_attributes": True}


class CommandAuditListResponse(BaseModel):
    """Response schema for listing command audit log entries."""

    entries: list[CommandAuditEntry] = Field(..., description="List of audit log entries")
    total: int = Field(..., description="Total number of entries matching filters")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of entries per page")


class CommandAuditExportEntry(BaseModel):
    """Flat schema for CSV export of audit entries."""

    id: int
    server_id: str
    command: str
    action_type: str
    exit_code: int | None
    duration_ms: int | None
    executed_at: datetime
    executed_by: str
    # Note: stdout/stderr excluded from CSV export to keep file size manageable

    model_config = {"from_attributes": True}
