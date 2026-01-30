"""Command execution request and response schemas.

Part of EP0013: Synchronous Command Execution - US0153.
"""

from pydantic import BaseModel, Field


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
