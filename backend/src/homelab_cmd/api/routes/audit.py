"""Command execution audit API endpoints.

Part of EP0013: Synchronous Command Execution - US0155 Command Execution Audit Trail.

This module provides read-only access to the command audit log.
No update or delete endpoints are exposed to ensure immutability (AC3).
"""

import csv
import io
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import get_async_session, verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES
from homelab_cmd.api.schemas.audit import (
    CommandAuditEntry,
    CommandAuditListResponse,
)
from homelab_cmd.services.audit_service import list_audit_logs

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Audit"])


@router.get(
    "/audit/commands",
    response_model=CommandAuditListResponse,
    operation_id="list_command_audit",
    summary="List command execution audit log",
    description=(
        "Query the immutable command execution audit log with filtering and pagination. "
        "Supports filtering by server, action type, date range, and success/failure status."
    ),
    responses=AUTH_RESPONSES,
)
async def get_command_audit_list(
    server_id: str | None = Query(
        None,
        description="Filter by server ID",
    ),
    action_type: str | None = Query(
        None,
        description="Filter by action type (e.g., 'restart_service', 'apply_updates')",
    ),
    from_date: datetime | None = Query(
        None,
        description="Filter entries on or after this date (ISO 8601 format)",
    ),
    to_date: datetime | None = Query(
        None,
        description="Filter entries on or before this date (ISO 8601 format)",
    ),
    success_only: bool | None = Query(
        None,
        description="If true, only successful commands (exit_code=0); if false, only failures",
    ),
    page: int = Query(
        1,
        ge=1,
        description="Page number (1-indexed)",
    ),
    page_size: int = Query(
        100,
        ge=1,
        le=100,
        description="Number of entries per page (max 100)",
    ),
    db: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CommandAuditListResponse:
    """List command audit log entries with filtering and pagination."""
    # Validate date range
    if from_date and to_date and from_date > to_date:
        raise HTTPException(
            status_code=400,
            detail="from_date must be before or equal to to_date",
        )

    entries, total = await list_audit_logs(
        db=db,
        server_id=server_id,
        action_type=action_type,
        from_date=from_date,
        to_date=to_date,
        success_only=success_only,
        page=page,
        page_size=page_size,
    )

    return CommandAuditListResponse(
        entries=[CommandAuditEntry.model_validate(e) for e in entries],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/audit/commands/export",
    operation_id="export_command_audit",
    summary="Export command audit log as CSV",
    description=(
        "Export filtered command audit log entries as a CSV file. "
        "stdout/stderr fields are excluded from export to keep file size manageable."
    ),
    responses={
        **AUTH_RESPONSES,
        200: {
            "description": "CSV file download",
            "content": {"text/csv": {}},
        },
    },
)
async def export_command_audit(
    server_id: str | None = Query(None, description="Filter by server ID"),
    action_type: str | None = Query(None, description="Filter by action type"),
    from_date: datetime | None = Query(None, description="Filter entries from this date"),
    to_date: datetime | None = Query(None, description="Filter entries to this date"),
    success_only: bool | None = Query(None, description="Filter by success/failure"),
    db: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> StreamingResponse:
    """Export command audit log as CSV file."""
    # Validate date range
    if from_date and to_date and from_date > to_date:
        raise HTTPException(
            status_code=400,
            detail="from_date must be before or equal to to_date",
        )

    async def generate_csv():
        """Generate CSV data as a stream."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(
            [
                "id",
                "server_id",
                "command",
                "action_type",
                "exit_code",
                "duration_ms",
                "executed_at",
                "executed_by",
            ]
        )
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        # Stream entries in pages to handle large datasets
        page = 1
        page_size = 1000

        while True:
            entries, _ = await list_audit_logs(
                db=db,
                server_id=server_id,
                action_type=action_type,
                from_date=from_date,
                to_date=to_date,
                success_only=success_only,
                page=page,
                page_size=page_size,
            )

            if not entries:
                break

            for entry in entries:
                writer.writerow(
                    [
                        entry.id,
                        entry.server_id,
                        entry.command,
                        entry.action_type,
                        entry.exit_code,
                        entry.duration_ms,
                        entry.executed_at.isoformat() if entry.executed_at else "",
                        entry.executed_by,
                    ]
                )

            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            page += 1

    # Generate filename with timestamp
    from datetime import UTC

    filename = f"command_audit_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
