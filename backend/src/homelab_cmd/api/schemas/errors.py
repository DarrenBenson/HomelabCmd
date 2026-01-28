"""Standardised error response schemas for OpenAPI documentation."""

from pydantic import BaseModel, ConfigDict, Field


class ErrorDetail(BaseModel):
    """Structured error detail for API error responses.

    Used for consistent error response documentation across all endpoints.
    """

    model_config = ConfigDict(
        json_schema_extra={"examples": [{"code": "NOT_FOUND", "message": "Server not found"}]}
    )

    code: str = Field(
        ...,
        description="Machine-readable error code",
        examples=["NOT_FOUND", "CONFLICT", "UNAUTHORIZED", "INVALID_STATE"],
    )
    message: str = Field(
        ...,
        description="Human-readable error message",
        examples=["Server 'web-01' not found"],
    )


class ErrorResponse(BaseModel):
    """Standard error response wrapper.

    All API error responses follow this format for consistency.
    """

    detail: ErrorDetail = Field(
        ...,
        description="Error details with code and message",
    )
