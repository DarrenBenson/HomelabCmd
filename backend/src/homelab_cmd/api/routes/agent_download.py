"""Agent download endpoint for auto-update support.

Part of US0184: Agent Auto-Update Mechanism.

Serves agent package files for download by agents performing self-update.
"""

import hashlib
import io
import logging
import tarfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from homelab_cmd.config import get_settings

router = APIRouter(prefix="/agents", tags=["Agent Download"])
logger = logging.getLogger(__name__)


@router.get(
    "/download",
    operation_id="download_agent",
    summary="Download agent package for auto-update",
    description="""
Download the agent package as a tar.gz archive for self-update.

Returns a tar.gz archive containing all agent Python files needed for installation.
The X-Checksum-SHA256 header contains the SHA256 checksum for verification.
""",
    responses={
        200: {
            "description": "Agent package archive",
            "content": {"application/gzip": {}},
        },
        404: {
            "description": "Agent package not found",
        },
    },
)
async def download_agent(
    version: str = Query(None, description="Requested version (optional, returns latest)"),
) -> Response:
    """Download agent package for auto-update.

    Args:
        version: Requested version (currently ignored, always returns latest).

    Returns:
        Tar.gz archive of agent files with SHA256 checksum header.
    """
    settings = get_settings()
    agent_dir = Path(settings.agent_package_dir)

    if not agent_dir.exists():
        logger.error("Agent package directory not found: %s", agent_dir)
        raise HTTPException(
            status_code=404,
            detail="Agent package not available",
        )

    # Agent files to include in the package
    agent_files = [
        "agent.py",
        "config.py",
        "heartbeat.py",
        "collectors.py",
        "updater.py",
        "__init__.py",
        "__main__.py",
        "requirements.txt",
        "VERSION",
    ]

    # Create tar.gz archive in memory
    archive_buffer = io.BytesIO()

    try:
        with tarfile.open(fileobj=archive_buffer, mode="w:gz") as tar:
            for filename in agent_files:
                filepath = agent_dir / filename
                if filepath.exists():
                    tar.add(filepath, arcname=filename)
                    logger.debug("Added %s to agent package", filename)
                else:
                    logger.debug("Skipping missing file: %s", filename)

    except Exception as e:
        logger.exception("Failed to create agent package")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create agent package: {e}",
        ) from e

    # Get the archive bytes
    archive_bytes = archive_buffer.getvalue()

    if len(archive_bytes) == 0:
        logger.error("Agent package is empty - no files found in %s", agent_dir)
        raise HTTPException(
            status_code=404,
            detail="Agent package is empty",
        )

    # Calculate SHA256 checksum
    checksum = hashlib.sha256(archive_bytes).hexdigest()

    logger.info(
        "Serving agent package: %d bytes, checksum=%s",
        len(archive_bytes),
        checksum[:16] + "...",
    )

    return Response(
        content=archive_bytes,
        media_type="application/gzip",
        headers={
            "X-Checksum-SHA256": checksum,
            "Content-Disposition": "attachment; filename=homelab-agent.tar.gz",
        },
    )
