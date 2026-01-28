# PL0077: Tailscale API Client Integration - Implementation Plan

> **Status:** Complete
> **Story:** [US0076: Tailscale API Client Integration](../stories/US0076-tailscale-api-client.md)
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Created:** 2026-01-26
> **Language:** Python

## Overview

Implement Tailscale API client integration for HomelabCmd v2.0. This enables automatic device discovery from the Tailscale control plane, replacing manual IP configuration. The implementation includes a backend service for API communication, REST endpoints for token management, and frontend UI for configuration.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | HTTP client implementation | httpx async client with 10s connect, 30s read timeout |
| AC2 | Token configuration | Settings UI for save/remove token with masked display |
| AC3 | Test connection | Validate token against Tailscale API, show tailnet name and device count |
| AC4 | Error handling | Specific exceptions for 401, 403, 429, timeouts, network errors |
| AC5 | Rate limiting | Respect Retry-After header with backoff |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI with SQLAlchemy 2.0
- **Frontend:** React 18 with TypeScript
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- HTTP requests must have explicit timeouts
- Catch specific exceptions, not bare `except:`
- Use httpx.AsyncClient with context manager or proper cleanup
- API keys from environment/config, never hardcoded

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| httpx | /encode/httpx | async timeout error handling | `httpx.Timeout(10.0, connect=10.0, read=30.0)`, `httpx.ConnectTimeout`, `httpx.HTTPStatusError` |

### Existing Patterns

**Service Pattern (from credential_service.py):**
```python
class SomeService:
    def __init__(self, session: AsyncSession, ...) -> None:
        self.session = session

    async def method_name(self, param: Type) -> ReturnType:
        # Business logic
        ...
```

**httpx Pattern (from notifier.py):**
```python
self.client = httpx.AsyncClient(timeout=10.0)
# Later: await self.client.post(url, json=payload)
await self.client.aclose()
```

**API Route Pattern:**
- APIRouter with prefix and tags
- Dependency injection for auth and session
- HTTPException with `detail={"code": "...", "message": "..."}`
- Pydantic schemas for request/response

## Recommended Approach

**Strategy:** Test-After
**Rationale:** External API integration requires extensive mocking. Service design is clear from AC. Faster to implement core logic first, then add comprehensive mocked tests using respx library.

### Test Priority

1. Service: test_connection with mocked Tailscale API responses
2. Error handling: 401, 403, 429, timeout, network errors
3. API routes: token save/remove/test with mocked service

### Documentation Updates Required

- [ ] AGENTS.md - Add Tailscale API endpoints table

## Implementation Tasks

> **Deterministic task table** - exact files, dependencies, and parallel execution flags.

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Create TailscaleService exceptions | `backend/src/homelab_cmd/services/tailscale_service.py` | - | Yes | [x] |
| 2 | Create TailscaleService class | `backend/src/homelab_cmd/services/tailscale_service.py` | 1 | No | [x] |
| 3 | Implement test_connection method | `backend/src/homelab_cmd/services/tailscale_service.py` | 2 | No | [x] |
| 4 | Export TailscaleService | `backend/src/homelab_cmd/services/__init__.py` | 3 | No | [x] |
| 5 | Create Pydantic schemas | `backend/src/homelab_cmd/api/schemas/tailscale.py` | - | Yes | [x] |
| 6 | Create API routes | `backend/src/homelab_cmd/api/routes/tailscale.py` | 4, 5 | No | [x] |
| 7 | Register router in main.py | `backend/src/homelab_cmd/main.py` | 6 | No | [x] |
| 8 | Create frontend API client | `frontend/src/api/tailscale.ts` | - | Yes | [x] |
| 9 | Create TypeScript types | `frontend/src/types/tailscale.ts` | - | Yes | [x] |
| 10 | Create TailscaleSettings component | `frontend/src/components/TailscaleSettings.tsx` | 8, 9 | No | [x] |
| 11 | Update Settings page | `frontend/src/pages/Settings.tsx` | 10 | No | [x] |
| 12 | Write service unit tests | `tests/test_tailscale_service.py` | 4 | No | [x] |
| 13 | Write API route tests | `tests/test_tailscale_api.py` | 7 | No | [x] |
| 14 | Update AGENTS.md | `AGENTS.md` | 7 | No | [x] |

### Task Dependency Graph

```
1 (exceptions) ──► 2 (class) ──► 3 (test_connection) ──► 4 (export)
                                                            │
5 (schemas) ────────────────────────────────────────────────┼──► 6 (routes) ──► 7 (main.py)
                                                            │                      │
8 (api client) ─────────────────────────────────────────────┼──► 10 (component)    │
                                                            │        │              │
9 (types) ──────────────────────────────────────────────────┘        ▼              │
                                                                   11 (Settings)    │
                                                                                    ▼
                                                            12 (tests) ◄────────────┤
                                                            13 (API tests) ◄────────┤
                                                            14 (docs) ◄─────────────┘
```

### Parallel Execution Groups

Tasks that can run concurrently:

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 5, 8, 9 | None |
| 2 | 2, 3, 4 | Task 1 complete |
| 3 | 6, 7 | Tasks 4, 5 complete |
| 4 | 10, 11 | Tasks 8, 9 complete |
| 5 | 12, 13, 14 | Task 7 complete |

## Implementation Phases

### Phase 1: Service Layer

**Goal:** Create TailscaleService with httpx client and error handling

**Tasks in this phase:** 1, 2, 3, 4

#### Step 1.1: Create Custom Exceptions

- [ ] Create TailscaleError base exception
- [ ] Create TailscaleAuthError for 401/403
- [ ] Create TailscaleRateLimitError with retry_after attribute
- [ ] Create TailscaleConnectionError for timeouts/network errors

**Files to create:**
- `backend/src/homelab_cmd/services/tailscale_service.py`

**Code structure:**
```python
class TailscaleError(Exception):
    """Base exception for Tailscale API errors."""
    pass

class TailscaleAuthError(TailscaleError):
    """Authentication or permission error (401, 403)."""
    pass

class TailscaleRateLimitError(TailscaleError):
    """Rate limit exceeded (429)."""
    def __init__(self, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.retry_after = retry_after

class TailscaleConnectionError(TailscaleError):
    """Connection or network error."""
    pass
```

#### Step 1.2: Create TailscaleService Class

- [ ] Initialize httpx.AsyncClient with timeouts
- [ ] Store base URL and token retrieval
- [ ] Implement proper async cleanup

**Key implementation details:**
```python
class TailscaleService:
    BASE_URL = "https://api.tailscale.com/api/v2"

    def __init__(self, credential_service: CredentialService) -> None:
        self._credential_service = credential_service
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=10.0, read=30.0)
        )

    async def close(self) -> None:
        await self._client.aclose()
```

#### Step 1.3: Implement test_connection Method

- [ ] Get token from credential service
- [ ] Make GET request to /tailnet/-/devices
- [ ] Parse response for tailnet name and device count
- [ ] Handle all error conditions (401, 403, 429, timeout, network)

**Considerations:**
- Token retrieved per-request (not cached) to support updates
- Extract tailnet name from first device's hostname if available
- Return dataclass with tailnet, device_count, success

#### Step 1.4: Export Service

- [ ] Add TailscaleService to `services/__init__.py`
- [ ] Add exceptions to exports

### Phase 2: API Routes

**Goal:** Create REST endpoints for token management and test connection

**Tasks in this phase:** 5, 6, 7

#### Step 2.1: Create Pydantic Schemas

- [ ] TailscaleTokenRequest: token field with validation
- [ ] TailscaleTokenResponse: success, message
- [ ] TailscaleTestResponse: success, tailnet, device_count, message, error, code
- [ ] TailscaleStatusResponse: configured, masked_token

**Files to create:**
- `backend/src/homelab_cmd/api/schemas/tailscale.py`

#### Step 2.2: Create API Routes

- [ ] POST /api/v1/settings/tailscale/token - save token
- [ ] DELETE /api/v1/settings/tailscale/token - remove token
- [ ] POST /api/v1/settings/tailscale/test - test connection
- [ ] GET /api/v1/settings/tailscale/status - check configuration status

**Files to create:**
- `backend/src/homelab_cmd/api/routes/tailscale.py`

**Key patterns:**
- Use dependency injection for CredentialService and TailscaleService
- Return appropriate HTTP status codes (200, 400, 401, 503)
- Mask token in responses (show first 8 chars + "...")

#### Step 2.3: Register Router

- [ ] Import tailscale router in main.py
- [ ] Include router with prefix `/api/v1`

**Files to modify:**
- `backend/src/homelab_cmd/main.py`

### Phase 3: Frontend

**Goal:** Add Tailscale configuration UI to Settings page

**Tasks in this phase:** 8, 9, 10, 11

#### Step 3.1: Create TypeScript Types

- [ ] TailscaleTokenRequest interface
- [ ] TailscaleTestResponse interface
- [ ] TailscaleStatusResponse interface

**Files to create:**
- `frontend/src/types/tailscale.ts`

#### Step 3.2: Create API Client

- [ ] saveToken(token: string)
- [ ] removeToken()
- [ ] testConnection()
- [ ] getStatus()

**Files to create:**
- `frontend/src/api/tailscale.ts`

#### Step 3.3: Create TailscaleSettings Component

- [ ] Token input field (password type)
- [ ] Save Token button
- [ ] Remove Token button
- [ ] Test Connection button with spinner
- [ ] Success/error message display

**Files to create:**
- `frontend/src/components/TailscaleSettings.tsx`

**States to handle:**
- No token configured
- Token configured (show masked)
- Testing in progress
- Test success (green checkmarks)
- Test error (red X with message)

#### Step 3.4: Update Settings Page

- [ ] Import TailscaleSettings component
- [ ] Add "Connectivity" section
- [ ] Position above or below existing sections

**Files to modify:**
- `frontend/src/pages/Settings.tsx`

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria with comprehensive tests

**Tasks in this phase:** 12, 13

#### Step 4.1: Service Unit Tests

- [ ] Test successful connection returns tailnet info
- [ ] Test 401 raises TailscaleAuthError with "Invalid API token"
- [ ] Test 403 raises TailscaleAuthError with "Token lacks required permissions"
- [ ] Test 429 raises TailscaleRateLimitError with retry_after
- [ ] Test connection timeout raises TailscaleConnectionError
- [ ] Test network error raises TailscaleConnectionError
- [ ] Test no token configured returns appropriate error

**Test file:** `tests/test_tailscale_service.py`

**Mocking strategy:**
- Use respx library to mock httpx requests
- Mock CredentialService.get_credential

#### Step 4.2: API Route Tests

- [ ] Test save token stores encrypted value
- [ ] Test save empty token returns 400
- [ ] Test remove token deletes credential
- [ ] Test connection with valid token
- [ ] Test connection with invalid token returns error
- [ ] Test status returns masked token

**Test file:** `backend/tests/test_api_tailscale.py`

#### Step 4.3: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Check httpx client config | `tailscale_service.py` | Pending |
| AC2 | Test save/mask token in UI | `test_api_tailscale.py` | Pending |
| AC3 | Test connection endpoint | `test_tailscale_service.py` | Pending |
| AC4 | Test error scenarios | `test_tailscale_service.py` | Pending |
| AC5 | Test 429 handling | `test_tailscale_service.py` | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Token is empty string | Validate in API route schema, reject with 400 before storage | Phase 2 | [ ] |
| 2 | Token has invalid format | Accept (let Tailscale API return 401), handle as auth error | Phase 1 | [ ] |
| 3 | Tailscale API returns 401 | Catch HTTPStatusError, raise TailscaleAuthError("Invalid API token") | Phase 1 | [ ] |
| 4 | Tailscale API returns 403 | Catch HTTPStatusError, raise TailscaleAuthError("Token lacks required permissions") | Phase 1 | [ ] |
| 5 | Tailscale API returns 429 | Parse Retry-After header, raise TailscaleRateLimitError with delay | Phase 1 | [ ] |
| 6 | Tailscale API connection timeout | Catch httpx.ConnectTimeout, raise TailscaleConnectionError | Phase 1 | [ ] |
| 7 | Tailscale API unreachable | Catch httpx.ConnectError, raise TailscaleConnectionError | Phase 1 | [ ] |
| 8 | Token removed while test in progress | Check for None from credential service, return "No token configured" | Phase 1 | [ ] |
| 9 | Concurrent token updates | Last write wins via credential service upsert logic | Phase 2 | [ ] |

### Coverage Summary

- Story edge cases: 9
- Handled in plan: 9
- Unhandled: 0

### Edge Case Implementation Notes

- Edge cases 3-7 all occur in test_connection method with specific exception mapping
- Edge case 1 uses Pydantic Field validation with min_length=1
- Edge case 8 checks get_credential return value before API call
- Edge case 9 is implicitly handled by CredentialService upsert

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tailscale API changes | Client may break | Use stable v2 API, add version header |
| Rate limiting during testing | Tests fail intermittently | Mock all Tailscale API calls in tests |
| Token exposure in logs | Security breach | Never log token value, use masked display |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0081 (Credential Service) | Story | Must be complete - currently in Review |
| httpx | Python library | Already installed |
| respx | Python library | Add for testing (mock httpx) |

## Open Questions

None.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (29 tests)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Documentation updated (AGENTS.md)
- [x] Ready for code review

## Notes

- US0081 (Credential Encryption) is now in Review status and can be marked Done
- This story enables US0077 (Device Discovery) which will use the client
- Frontend component follows existing Settings page patterns
- Consider adding respx to dev dependencies for httpx mocking

