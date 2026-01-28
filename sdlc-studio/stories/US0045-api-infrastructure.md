# US0045: API Infrastructure and Authentication

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** a secure, documented API foundation
**So that** all endpoints are protected by authentication and I can explore the API via Swagger UI

## Context

### Persona Reference

**Darren** - Security-conscious homelab operator. Wants API protection even on LAN. Appreciates good documentation.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

This story establishes the foundational API infrastructure including authentication middleware, health check endpoint, OpenAPI documentation, and CORS configuration for the React SPA. All subsequent API stories depend on this foundation.

## Acceptance Criteria

### AC1: API key authentication required

- **Given** a request to any `/api/v1/*` endpoint (except health)
- **When** the `X-API-Key` header is missing or invalid
- **Then** 401 Unauthorised is returned

### AC2: Health check endpoint available

- **Given** the application is running
- **When** GET `/api/v1/system/health` is called (no auth)
- **Then** a 200 response with health status is returned

### AC3: OpenAPI documentation available

- **Given** the application is running
- **When** navigating to `/api/docs`
- **Then** Swagger UI is displayed with all endpoint documentation

### AC4: ReDoc documentation available

- **Given** the application is running
- **When** navigating to `/api/redoc`
- **Then** ReDoc documentation is displayed

### AC5: CORS configured for SPA

- **Given** the React SPA running on the same origin
- **When** making API requests
- **Then** CORS headers allow the requests

### AC6: API versioning in path

- **Given** the API base path
- **When** accessing endpoints
- **Then** all endpoints are prefixed with `/api/v1`

## Scope

### In Scope

- API key authentication middleware
- X-API-Key header validation
- Health check endpoint (unauthenticated)
- OpenAPI 3.1.0 specification generation
- Swagger UI at /api/docs
- ReDoc at /api/redoc
- CORS middleware configuration
- Standard error response format
- API versioning (v1)

### Out of Scope

- Per-agent API keys
- OAuth/JWT authentication
- Rate limiting
- API key rotation
- Multi-user authentication

## Technical Notes

### API Contracts

**GET /api/v1/system/health (no auth required)**
```json
Response 200:
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "database": "connected",
  "timestamp": "2026-01-18T10:30:00Z"
}
```

**401 Unauthorised Response (standard)**
```json
{
  "detail": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key"
  }
}
```

**TRD Reference:** [§4 API Contracts - Configuration & System](../trd.md#4-api-contracts)

### FastAPI Implementation

```python
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="HomelabCmd API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # SPA served from same origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key authentication
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
API_KEY = os.getenv("HOMELAB_CMD_API_KEY", "dev-key-change-me")

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or missing API key"}
        )
    return api_key

# Health check (no auth)
@app.get("/api/v1/system/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "uptime_seconds": get_uptime(),
        "database": "connected",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

# Protected routes use Depends(verify_api_key)
@app.get("/api/v1/servers", dependencies=[Depends(verify_api_key)])
async def list_servers():
    ...
```

### Configuration

```yaml
# Environment variables
HOMELAB_CMD_API_KEY=your-secure-key-here  # Required in production
```

### Docker Health Check

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/system/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Missing X-API-Key header | 401 Unauthorised |
| Invalid API key | 401 Unauthorised |
| Health check with API key | 200 OK (key ignored) |
| Malformed JSON body | 422 Validation Error |
| Unknown endpoint | 404 Not Found |

## Test Scenarios

- [ ] Valid API key allows access
- [ ] Missing API key returns 401
- [ ] Invalid API key returns 401
- [ ] Health check works without auth
- [ ] Swagger UI accessible
- [ ] ReDoc accessible
- [ ] OpenAPI spec downloadable
- [ ] CORS headers present
- [ ] Error responses follow standard format

## Definition of Done


**Story-specific additions:**

- [ ] API key documented in README
- [ ] OpenAPI spec validates against 3.1.0
- [ ] Health check used in Docker healthcheck

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| None | - | - |

## Estimation

**Story Points:** 3

**Complexity:** Low - FastAPI provides most functionality

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation (QA gap analysis) |
| 2026-01-18 | Claude | Status changed to Planned, implementation plan PL0001 created |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
