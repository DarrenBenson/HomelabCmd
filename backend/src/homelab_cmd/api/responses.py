"""Shared response definitions for OpenAPI documentation.

This module provides reusable response definitions to ensure consistent
error documentation across all API endpoints.
"""

from homelab_cmd.api.schemas.errors import ErrorResponse

# Authentication error responses (401)
AUTH_RESPONSES: dict = {
    401: {
        "model": ErrorResponse,
        "description": "Invalid or missing API key",
    }
}

# Resource not found responses (404)
NOT_FOUND_RESPONSE: dict = {
    404: {
        "model": ErrorResponse,
        "description": "Resource not found",
    }
}

# Conflict responses (409)
CONFLICT_RESPONSE: dict = {
    409: {
        "model": ErrorResponse,
        "description": "Resource already exists",
    }
}

# Bad request responses (400)
BAD_REQUEST_RESPONSE: dict = {
    400: {
        "model": ErrorResponse,
        "description": "Invalid request state",
    }
}

# Forbidden responses (403)
FORBIDDEN_RESPONSE: dict = {
    403: {
        "model": ErrorResponse,
        "description": "Operation forbidden",
    }
}
