"""Command execution request and response schemas.

Part of EP0013: Synchronous Command Execution - US0153.
Extended by US0156: Real-Time Command Output Streaming.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# US0156: Streaming output types
class OutputChunkSchema(BaseModel):
    """Single chunk of command output for SSE streaming.

    Attributes:
        type: Chunk type - stdout, stderr, exit, or error.
        data: Output text or exit code (as string for exit type).
        timestamp: ISO timestamp when chunk was received.
    """

    type: Literal["stdout", "stderr", "exit", "error"] = Field(
        ...,
        description="Type of output chunk",
    )
    data: str = Field(
        ...,
        description="Output text or exit code (for exit type)",
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="When this chunk was received",
    )


class ProgressInfoSchema(BaseModel):
    """Progress information for apt/package operations.

    Attributes:
        percent: Progress percentage (0-100).
        stage: Current stage description.
    """

    percent: int = Field(
        ...,
        ge=0,
        le=100,
        description="Progress percentage (0-100)",
    )
    stage: str = Field(
        ...,
        description="Current stage description",
    )


class StreamExitSchema(BaseModel):
    """Final message when command stream completes.

    Attributes:
        code: Command exit code (0 = success).
        duration_ms: Total execution time in milliseconds.
    """

    code: int = Field(
        ...,
        description="Command exit code (0 = success)",
    )
    duration_ms: int = Field(
        ...,
        ge=0,
        description="Total execution time in milliseconds",
    )


class CommandExecuteRequest(BaseModel):
    """Request body for command execution.

    Attributes:
        command: The shell command to execute on the server.
        action_type: The type of action (e.g., restart_service, apply_updates).
            Must match a whitelisted action type.
    """

    command: str = Field(
        ...,
        min_length=1,
        description="Shell command to execute on the server",
        json_schema_extra={"example": "systemctl restart nginx"},
    )
    action_type: str = Field(
        ...,
        min_length=1,
        description="Action type for whitelist validation (e.g., restart_service, apply_updates)",
        json_schema_extra={"example": "restart_service"},
    )


class CommandExecuteResponse(BaseModel):
    """Response body for command execution.

    Attributes:
        exit_code: The command's exit status (0 = success).
        stdout: Standard output from the command.
        stderr: Standard error from the command.
        duration_ms: Execution time in milliseconds.
    """

    exit_code: int = Field(
        ...,
        description="Command exit status (0 = success, non-zero = failure)",
        json_schema_extra={"example": 0},
    )
    stdout: str = Field(
        ...,
        description="Standard output from the command",
        json_schema_extra={"example": "Service restarted successfully"},
    )
    stderr: str = Field(
        ...,
        description="Standard error from the command",
        json_schema_extra={"example": ""},
    )
    duration_ms: int = Field(
        ...,
        ge=0,
        description="Execution time in milliseconds",
        json_schema_extra={"example": 150},
    )
