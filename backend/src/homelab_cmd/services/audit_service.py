"""Service for command execution audit logging.

Part of EP0013: Synchronous Command Execution - US0155 Command Execution Audit Trail.

This service provides immutable audit logging for all command executions,
supporting security compliance and incident investigation.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models import CommandAuditLog

logger = logging.getLogger(__name__)

# Maximum size for stdout/stderr in bytes (10KB)
MAX_OUTPUT_SIZE = 10240
TRUNCATION_MARKER = "... [truncated]"


def truncate_output(output: str | None, max_size: int = MAX_OUTPUT_SIZE) -> str | None:
    """Truncate output to maximum size with marker.

    Args:
        output: The output string to truncate
        max_size: Maximum size in bytes (default 10KB)

    Returns:
        Truncated string with marker if exceeded limit, or original string
    """
    if output is None:
        return None

    if len(output.encode("utf-8")) <= max_size:
        return output

    # Calculate how much we can keep, accounting for marker
    marker_size = len(TRUNCATION_MARKER.encode("utf-8"))
    keep_size = max_size - marker_size

    # Truncate by encoding, slicing, and decoding (handles multi-byte chars)
    encoded = output.encode("utf-8")[:keep_size]
    # Decode with error handling to avoid breaking on partial multi-byte chars
    truncated = encoded.decode("utf-8", errors="ignore")

    return truncated + TRUNCATION_MARKER


async def create_audit_log(
    db: AsyncSession,
    server_id: str,
    command: str,
    action_type: str,
    exit_code: int | None = None,
    stdout: str | None = None,
    stderr: str | None = None,
    duration_ms: int | None = None,
    executed_by: str = "dashboard",
) -> CommandAuditLog:
    """Create an immutable audit log entry for a command execution.

    This function creates an audit log entry that cannot be modified or deleted
    through the API, ensuring an immutable audit trail for compliance.

    Args:
        db: Database session
        server_id: ID of the server where command was executed
        command: The actual command that was executed
        action_type: Type of action (e.g., 'restart_service', 'apply_updates')
        exit_code: Command exit code (0 = success)
        stdout: Command standard output (will be truncated to 10KB)
        stderr: Command standard error (will be truncated to 10KB)
        duration_ms: Command execution duration in milliseconds
        executed_by: Who initiated the command (default: 'dashboard')

    Returns:
        The created CommandAuditLog entry
    """
    entry = CommandAuditLog(
        server_id=server_id,
        command=command,
        action_type=action_type,
        exit_code=exit_code,
        stdout=truncate_output(stdout),
        stderr=truncate_output(stderr),
        duration_ms=duration_ms,
        executed_at=datetime.now(UTC),
        executed_by=executed_by,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    logger.info(
        "Audit log created: server=%s action=%s exit_code=%s",
        server_id,
        action_type,
        exit_code,
    )

    return entry


async def list_audit_logs(
    db: AsyncSession,
    server_id: str | None = None,
    action_type: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    success_only: bool | None = None,
    page: int = 1,
    page_size: int = 100,
) -> tuple[list[CommandAuditLog], int]:
    """List audit log entries with filtering and pagination.

    Args:
        db: Database session
        server_id: Filter by server ID
        action_type: Filter by action type
        from_date: Filter entries on or after this date
        to_date: Filter entries on or before this date
        success_only: If True, only exit_code=0; if False, only exit_code!=0
        page: Page number (1-indexed)
        page_size: Number of entries per page (max 100)

    Returns:
        Tuple of (list of entries, total count)
    """
    # Build base query
    query = select(CommandAuditLog)

    # Apply filters
    if server_id:
        query = query.where(CommandAuditLog.server_id == server_id)
    if action_type:
        query = query.where(CommandAuditLog.action_type == action_type)
    if from_date:
        query = query.where(CommandAuditLog.executed_at >= from_date)
    if to_date:
        query = query.where(CommandAuditLog.executed_at <= to_date)
    if success_only is True:
        query = query.where(CommandAuditLog.exit_code == 0)
    elif success_only is False:
        query = query.where(CommandAuditLog.exit_code != 0)

    # Get total count
    from sqlalchemy import func

    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar() or 0

    # Apply ordering and pagination
    query = query.order_by(CommandAuditLog.executed_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    entries = list(result.scalars().all())

    return entries, total


async def cleanup_old_audit_entries(
    db: AsyncSession,
    retention_days: int = 90,
) -> int:
    """Remove audit entries older than retention period.

    This is the only mechanism for removing audit entries, ensuring
    intentional retention policy compliance while maintaining immutability
    of individual records.

    Args:
        db: Database session
        retention_days: Number of days to retain entries (default 90)

    Returns:
        Number of entries deleted
    """
    from sqlalchemy import delete

    cutoff_date = datetime.now(UTC) - timedelta(days=retention_days)

    stmt = delete(CommandAuditLog).where(CommandAuditLog.executed_at < cutoff_date)
    result = await db.execute(stmt)
    await db.commit()

    deleted_count = result.rowcount
    if deleted_count > 0:
        logger.info(
            "Audit log cleanup: deleted %d entries older than %d days",
            deleted_count,
            retention_days,
        )

    return deleted_count
