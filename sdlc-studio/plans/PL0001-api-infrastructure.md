# PL0001: API Infrastructure and Authentication - Implementation Plan

> **Status:** Complete
> **Story:** [US0045: API Infrastructure and Authentication](../stories/US0045-api-infrastructure.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** Python

## Overview

This plan establishes the foundational API infrastructure for HomelabCmd. As a greenfield project, this creates the initial FastAPI application structure with authentication middleware, health check endpoint, OpenAPI documentation, and CORS configuration. All subsequent API stories depend on this foundation.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | API key authentication | X-API-Key header required for `/api/v1/*` (except health) |
| AC2 | Health check endpoint | GET `/api/v1/system/health` returns status without auth |
| AC3 | OpenAPI documentation | Swagger UI at `/api/docs` |
| AC4 | ReDoc documentation | ReDoc at `/api/redoc` |
| AC5 | CORS configured | SPA can make cross-origin requests |
| AC6 | API versioning | All endpoints prefixed with `/api/v1` |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI 0.109+
- **Test Framework:** pytest + pytest-asyncio
- **ASGI Server:** Uvicorn

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- API keys from environment variables (never hardcoded)
- Type hints on all public functions
- Specific exception handling (not bare `except:`)
- Logging module instead of print
- Use pathlib for file paths

### Existing Patterns

This is a greenfield project - no existing code. We establish patterns for:
- Project structure (src layout)
- Dependency injection with FastAPI
- Configuration management
- Error response format

## Recommended Approach

**Strategy:** TDD (Test-Driven Development)
**Rationale:** Foundation code benefits from tests-first approach. Authentication and health checks are straightforward to test, and having tests ensures the infrastructure is solid before building features on top.

### Test Priority

1. Health check endpoint returns correct response
2. Missing API key returns 401
3. Invalid API key returns 401
4. Valid API key allows access
5. CORS headers present in response

### Documentation Updates Required

- [ ] README.md - API key configuration
- [ ] Add .env.example with HOMELAB_CMD_API_KEY

## Implementation Steps

### Phase 1: Project Structure

**Goal:** Create the Python package structure and dependencies

#### Step 1.1: Initialise project

- [ ] Create `backend/src/homelab_cmd/` package directory
- [ ] Create `pyproject.toml` with dependencies
- [ ] Create `backend/src/homelab_cmd/__init__.py`
- [ ] Create `backend/src/homelab_cmd/main.py` (FastAPI app entry point)

**Files to create:**
- `pyproject.toml` - Project metadata and dependencies
- `backend/src/homelab_cmd/__init__.py` - Package init with version
- `backend/src/homelab_cmd/main.py` - FastAPI application factory

**Considerations:**
- Use `uv` for fast dependency management (per TRD)
- Include dev dependencies: pytest, pytest-asyncio, httpx (test client)
- Pin FastAPI >= 0.109 for Pydantic v2 and OpenAPI 3.1

#### Step 1.2: Configuration module

- [ ] Create `backend/src/homelab_cmd/config.py`
- [ ] Load API key from environment
- [ ] Set sensible defaults for development

**Files to create:**
- `backend/src/homelab_cmd/config.py` - Settings using pydantic-settings

**Considerations:**
- Use `pydantic-settings` for environment variable validation
- Default API key for dev only (warn in logs)
- Database URL placeholder for US0001

### Phase 2: Core API Implementation

**Goal:** Implement FastAPI app with authentication and health check

#### Step 2.1: Authentication dependency

- [ ] Create `backend/src/homelab_cmd/api/deps.py`
- [ ] Implement `verify_api_key` dependency
- [ ] Return 401 with standard error format

**Files to create:**
- `backend/src/homelab_cmd/api/__init__.py`
- `backend/src/homelab_cmd/api/deps.py` - Authentication dependencies

**Error response format:**
```json
{
  "detail": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key"
  }
}
```

#### Step 2.2: Health check endpoint

- [ ] Create `backend/src/homelab_cmd/api/routes/system.py`
- [ ] Implement GET `/api/v1/system/health`
- [ ] Track application start time for uptime

**Files to create:**
- `backend/src/homelab_cmd/api/routes/__init__.py`
- `backend/src/homelab_cmd/api/routes/system.py` - System endpoints

**Response schema:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "database": "connected",
  "timestamp": "2026-01-18T10:30:00Z"
}
```

#### Step 2.3: FastAPI application assembly

- [ ] Configure CORS middleware
- [ ] Configure OpenAPI/Swagger settings
- [ ] Mount API router with `/api/v1` prefix
- [ ] Add lifespan handler for startup time

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - Assemble application

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 3.1: Test setup

- [ ] Create `tests/` directory structure
- [ ] Create `tests/conftest.py` with fixtures
- [ ] Configure pytest-asyncio

**Files to create:**
- `tests/__init__.py`
- `tests/conftest.py` - Test fixtures (test client, API key)
- `pytest.ini` or `pyproject.toml` pytest config

#### Step 3.2: Authentication tests

- [ ] Test missing X-API-Key returns 401
- [ ] Test invalid X-API-Key returns 401
- [ ] Test valid X-API-Key allows access
- [ ] Test health check works without auth
- [ ] Test error response format

**Files to create:**
- `tests/test_auth.py` - Authentication tests

#### Step 3.3: Health check tests

- [ ] Test health endpoint returns 200
- [ ] Test response schema is correct
- [ ] Test uptime increments

**Files to create:**
- `tests/test_health.py` - Health check tests

#### Step 3.4: Documentation tests

- [ ] Test `/api/docs` returns HTML (Swagger)
- [ ] Test `/api/redoc` returns HTML (ReDoc)
- [ ] Test `/api/openapi.json` returns valid JSON

**Files to create:**
- `tests/test_docs.py` - Documentation endpoint tests

#### Step 3.5: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | `test_auth.py` - auth tests | Done |
| AC2 | `test_health.py` - health endpoint | Done |
| AC3 | `test_docs.py` - swagger access | Done |
| AC4 | `test_docs.py` - redoc access | Done |
| AC5 | `test_auth.py` - CORS headers | Done |
| AC6 | All tests use `/api/v1` prefix | Done |

### Phase 4: Docker Integration

**Goal:** Prepare for containerised deployment

#### Step 4.1: Docker files

- [ ] Create `Dockerfile` for production build
- [ ] Create `docker-compose.yml` for development
- [ ] Add health check to Docker config

**Files to create:**
- `Dockerfile` - Multi-stage Python build
- `docker-compose.yml` - Development setup
- `.dockerignore` - Exclude unnecessary files

#### Step 4.2: Environment configuration

- [ ] Create `.env.example` with documented variables
- [ ] Update README with setup instructions

**Files to create:**
- `.env.example` - Template environment file

## Project Structure (Final)

```
HomelabCmd/
├── src/
│   └── homelab_cmd/
│       ├── __init__.py
│       ├── main.py              # FastAPI application
│       ├── config.py            # Settings/configuration
│       └── api/
│           ├── __init__.py
│           ├── deps.py          # Dependencies (auth)
│           └── routes/
│               ├── __init__.py
│               └── system.py    # Health check
├── tests/
│   ├── __init__.py
│   ├── conftest.py              # Test fixtures
│   ├── test_auth.py
│   ├── test_health.py
│   └── test_docs.py
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Missing X-API-Key header | Return 401 with standard error format |
| Empty X-API-Key header | Return 401 (treated as invalid) |
| API key with whitespace | Trim before comparison |
| Very long API key | Accept (no length limit) |
| Health check during startup | Return 200 even if DB not ready (for container health) |
| CORS preflight (OPTIONS) | Allow without auth |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dev key used in production | Security breach | Log warning if using default key |
| Health check exposes info | Information disclosure | Only expose version, uptime, status |
| CORS too permissive | Security | Acceptable for LAN deployment, document |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| FastAPI | Python package | >= 0.109 for OpenAPI 3.1 |
| Uvicorn | Python package | ASGI server |
| pydantic-settings | Python package | Environment config |
| httpx | Python package | Test client |
| pytest | Python package | Testing framework |
| pytest-asyncio | Python package | Async test support |

## Open Questions

None - all technical decisions are specified in TRD.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (32 tests)
- [x] Edge cases handled
- [x] Code follows Python best practices
- [x] No linting errors (ruff)
- [x] Documentation updated (README, .env.example)
- [x] Docker files created
- [x] Ready for code review

## Notes

This is the first story to implement - it establishes project structure and patterns that all subsequent stories will follow. Take care to set good precedents for:
- Code organisation
- Test structure
- Error handling patterns
- Configuration management

## Next Steps After Completion

Once this story is complete, the following stories can proceed:
- **US0001**: Database Schema and Migrations (add SQLAlchemy, Alembic)
- **US0002**: Server Registration API (add server routes)
- **US0003**: Agent Heartbeat Endpoint (add agent routes)
