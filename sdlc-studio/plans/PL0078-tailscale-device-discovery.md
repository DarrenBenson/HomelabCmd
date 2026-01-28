# PL0078: Tailscale Device Discovery - Implementation Plan

> **Status:** Complete
> **Story:** [US0077: Tailscale Device Discovery](../stories/US0077-tailscale-device-discovery.md)
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Created:** 2026-01-26
> **Language:** Python / TypeScript

## Overview

Implement Tailscale device discovery for HomelabCmd. This enables users to view all devices in their tailnet via a REST API and React UI, with filtering, caching, and identification of already-imported servers. Builds on the Tailscale API client (US0076) and credential service (US0081).

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Device list endpoint | Returns sorted devices with id, name, hostname, tailscale_ip, os, last_seen, online |
| AC2 | Filtering support | Query params for online status and OS type |
| AC3 | 5-minute cache | Cache results with TTL, refresh bypass param, cache_hit indicator |
| AC4 | Discovery UI page | Device cards with status indicators and Import button |
| AC5 | Loading/empty states | Spinner during load, messages for no-token and empty results |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Backend Framework:** FastAPI with SQLAlchemy 2.0
- **Frontend Framework:** React 18 with TypeScript
- **Test Framework:** pytest with pytest-asyncio, respx for HTTP mocking

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Always set explicit timeouts on HTTP requests
- Catch specific exceptions, not bare `except:`
- Use dataclasses for structured responses

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| httpx | /encode/httpx | async caching patterns | Use existing patterns from US0076 |

### Existing Patterns

**TailscaleService (from US0076):**
```python
class TailscaleService:
    async def get_devices(self) -> list[dict]:
        """Already fetches raw device list from Tailscale API."""
```

**API Route Pattern (from tailscale.py):**
- FastAPI router with prefix and tags
- Dependency injection for auth and session
- TailscaleService instantiation with credential service
- Exception handling mapping service errors to HTTP responses

**Frontend Pattern (from TailscaleSettings.tsx):**
- useState for loading, error, success states
- useEffect for initial data fetch
- Lucide icons for status indicators
- Tailwind CSS for styling

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Extends existing Tailscale integration with established patterns. Service layer change is minimal (add caching). API endpoint follows existing route conventions. External API mocking with respx is simpler after seeing exact implementation.

### Test Priority

1. Cache TTL behavior and refresh bypass
2. Device filtering (online, OS)
3. Error handling (401, 503 for various failures)
4. Already-imported flag logic

### Documentation Updates Required

- [ ] AGENTS.md - Add Tailscale device discovery endpoint

## Implementation Tasks

> **Deterministic task table** - exact files, dependencies, and parallel execution flags.

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add TailscaleCache class | `backend/src/homelab_cmd/services/tailscale_service.py` | - | Yes | [x] |
| 2 | Add TailscaleDevice dataclass | `backend/src/homelab_cmd/services/tailscale_service.py` | - | Yes | [x] |
| 3 | Add get_devices_cached method | `backend/src/homelab_cmd/services/tailscale_service.py` | 1, 2 | No | [x] |
| 4 | Add Pydantic schemas for device list | `backend/src/homelab_cmd/api/schemas/tailscale.py` | - | Yes | [x] |
| 5 | Create devices route | `backend/src/homelab_cmd/api/routes/tailscale.py` | 3, 4 | No | [x] |
| 6 | Add TypeScript types | `frontend/src/types/tailscale.ts` | - | Yes | [x] |
| 7 | Add API client function | `frontend/src/api/tailscale.ts` | 6 | No | [x] |
| 8 | Create TailscaleDevices page | `frontend/src/pages/TailscaleDevices.tsx` | 7 | No | [x] |
| 9 | Add route to App.tsx | `frontend/src/App.tsx` | 8 | No | [x] |
| 10 | Add navigation link | `frontend/src/pages/Dashboard.tsx` | 9 | No | [x] |
| 11 | Write service cache tests | `tests/test_tailscale_service.py` | 3 | No | [x] |
| 12 | Write device API tests | `tests/test_tailscale_api.py` | 5 | No | [x] |
| 13 | Update AGENTS.md | `AGENTS.md` | 5 | No | [x] |

### Task Dependency Graph

```
1 (cache) ──┬──► 3 (get_devices_cached) ──► 5 (route)
2 (dataclass) ─┘                               │
                                               │
4 (schemas) ───────────────────────────────────┘
                                               │
6 (TS types) ──► 7 (API client) ──► 8 (page) ──► 9 (route) ──► 10 (nav)
                                               │
                                               ├──► 11 (service tests)
                                               ├──► 12 (API tests)
                                               └──► 13 (docs)
```

### Parallel Execution Groups

Tasks that can run concurrently:

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 2, 4, 6 | None |
| 2 | 3, 7 | Group 1 |
| 3 | 5 | Tasks 3, 4 |
| 4 | 8, 9, 10 | Task 7 |
| 5 | 11, 12, 13 | Task 5 |

## Implementation Phases

### Phase 1: Backend - Cache and Service

**Goal:** Add caching layer and transform Tailscale devices to our schema

**Tasks in this phase:** 1, 2, 3

#### Step 1.1: Add TailscaleCache Class

- [ ] Create TailscaleCache with 5-minute TTL
- [ ] Implement get() returning (data, cache_hit) tuple
- [ ] Implement set() with timestamp
- [ ] Implement invalidate() method

**Files to modify:**
- `backend/src/homelab_cmd/services/tailscale_service.py`

**Code structure:**
```python
from datetime import datetime, timedelta, timezone

class TailscaleCache:
    """In-memory cache for Tailscale device list with 5-minute TTL."""

    TTL = timedelta(minutes=5)

    def __init__(self) -> None:
        self._devices: list[dict] | None = None
        self._cached_at: datetime | None = None

    def get(self) -> tuple[list[dict] | None, datetime | None]:
        """Return (devices, cached_at) or (None, None) if expired/empty."""
        if self._devices is not None and self._cached_at is not None:
            if datetime.now(timezone.utc) - self._cached_at < self.TTL:
                return self._devices, self._cached_at
        return None, None

    def set(self, devices: list[dict]) -> datetime:
        """Cache devices and return cached_at timestamp."""
        self._devices = devices
        self._cached_at = datetime.now(timezone.utc)
        return self._cached_at

    def invalidate(self) -> None:
        """Clear the cache."""
        self._devices = None
        self._cached_at = None
```

#### Step 1.2: Add TailscaleDevice Dataclass

- [ ] Create dataclass with fields matching AC1
- [ ] Include transformation from Tailscale API response

**Code structure:**
```python
@dataclass
class TailscaleDevice:
    """Transformed Tailscale device for our API."""

    id: str
    name: str
    hostname: str
    tailscale_ip: str
    os: str
    os_version: str | None
    last_seen: datetime
    online: bool
    authorized: bool
    already_imported: bool = False

    @classmethod
    def from_tailscale_api(cls, data: dict, imported_hostnames: set[str]) -> "TailscaleDevice":
        """Transform Tailscale API response to our device format."""
        addresses = data.get("addresses", [])
        tailscale_ip = addresses[0] if addresses else ""
        hostname = data.get("hostname", "")

        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            hostname=hostname,
            tailscale_ip=tailscale_ip,
            os=data.get("os", ""),
            os_version=data.get("clientVersion"),
            last_seen=datetime.fromisoformat(data.get("lastSeen", "").replace("Z", "+00:00")),
            online=data.get("online", False),
            authorized=data.get("authorized", False),
            already_imported=hostname in imported_hostnames,
        )
```

#### Step 1.3: Add get_devices_cached Method

- [ ] Implement caching wrapper around get_devices()
- [ ] Accept refresh parameter to bypass cache
- [ ] Return devices sorted alphabetically by name

**Files to modify:**
- `backend/src/homelab_cmd/services/tailscale_service.py`

### Phase 2: Backend - API Route

**Goal:** Create REST endpoint with filtering and cache metadata

**Tasks in this phase:** 4, 5

#### Step 2.1: Add Pydantic Schemas

- [ ] TailscaleDeviceSchema - device response model
- [ ] TailscaleDeviceListResponse - list with cache metadata

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/tailscale.py`

**Code structure:**
```python
class TailscaleDeviceSchema(BaseModel):
    id: str
    name: str
    hostname: str
    tailscale_ip: str
    os: str
    os_version: str | None
    last_seen: datetime
    online: bool
    authorized: bool
    already_imported: bool

class TailscaleDeviceListResponse(BaseModel):
    devices: list[TailscaleDeviceSchema]
    count: int
    cache_hit: bool
    cached_at: datetime | None
```

#### Step 2.2: Create Devices Route

- [ ] GET /api/v1/tailscale/devices endpoint
- [ ] Query params: online (bool), os (str), refresh (bool)
- [ ] Validate OS filter against allowed values
- [ ] Query servers table for already_imported check
- [ ] Map service exceptions to HTTP responses

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/tailscale.py`

**Considerations:**
- Use separate router with prefix `/tailscale` for operational endpoints
- Include in main.py router registration
- Filter devices in-memory after cache retrieval

### Phase 3: Frontend - Types and API Client

**Goal:** Add TypeScript types and API client functions

**Tasks in this phase:** 6, 7

#### Step 3.1: Add TypeScript Types

- [ ] TailscaleDevice interface
- [ ] TailscaleDeviceListResponse interface

**Files to modify:**
- `frontend/src/types/tailscale.ts`

#### Step 3.2: Add API Client Function

- [ ] getTailscaleDevices(params?) function
- [ ] Support optional filters and refresh

**Files to modify:**
- `frontend/src/api/tailscale.ts`

### Phase 4: Frontend - Discovery Page

**Goal:** Create UI for viewing Tailscale devices

**Tasks in this phase:** 8, 9, 10

#### Step 4.1: Create TailscaleDevices Page

- [ ] Page layout with filter dropdowns
- [ ] Device card component
- [ ] Loading state with spinner
- [ ] No-token state with link to Settings
- [ ] Empty state message
- [ ] Error state with retry
- [ ] Refresh button
- [ ] Cache indicator

**Files to create:**
- `frontend/src/pages/TailscaleDevices.tsx`

**States to handle:**
- Loading: "Discovering devices..." with spinner
- No token: Message with link to Settings
- Empty: "No devices found in your tailnet"
- Error: Red alert with retry button
- Success: Device cards with filter controls

#### Step 4.2: Add Route

- [ ] Add route to React Router

**Files to modify:**
- `frontend/src/App.tsx`

#### Step 4.3: Add Navigation Link

- [ ] Add link under Discovery section

**Files to modify:**
- `frontend/src/components/Sidebar.tsx`

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria with comprehensive tests

**Tasks in this phase:** 11, 12, 13

#### Step 5.1: Service Cache Tests

- [ ] Test cache hit within TTL
- [ ] Test cache miss after TTL
- [ ] Test refresh bypasses cache
- [ ] Test cache_hit and cached_at in response

**Test file:** `tests/test_tailscale_service.py`

#### Step 5.2: Device API Tests

- [ ] Test device list returns sorted devices
- [ ] Test online filter
- [ ] Test OS filter
- [ ] Test invalid OS filter ignored
- [ ] Test no token returns 401
- [ ] Test API error returns 503
- [ ] Test empty list returns 200

**Test file:** `tests/test_tailscale_api.py`

#### Step 5.3: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Test device list endpoint | `test_tailscale_api.py` | Passed |
| AC2 | Test filtering | `test_tailscale_api.py` | Passed |
| AC3 | Test cache behavior | `test_tailscale_service.py` | Passed |
| AC4 | Manual UI verification | `TailscaleDevices.tsx` | Passed |
| AC5 | Manual UI verification | `TailscaleDevices.tsx` | Passed |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | No Tailscale token configured | TailscaleService raises TailscaleNotConfiguredError, route returns 401 with TAILSCALE_NOT_CONFIGURED | Phase 2 | [x] |
| 2 | Tailscale API returns 401 | TailscaleService raises TailscaleAuthError, route returns 401 with message "Tailscale token invalid or expired" | Phase 2 | [x] |
| 3 | Tailscale API returns 429 | TailscaleService raises TailscaleRateLimitError, route returns 503 with retry_after | Phase 2 | [x] |
| 4 | Tailscale API timeout | TailscaleService raises TailscaleConnectionError, route returns 503 with "timed out" | Phase 2 | [x] |
| 5 | Tailscale API returns empty list | Return 200 with devices: [], count: 0 | Phase 1 | [x] |
| 6 | Filter returns no results | Return 200 with empty devices array (same as empty list) | Phase 2 | [x] |
| 7 | Invalid OS filter value | Validate OS against allowed list (linux, windows, macos, ios, android), ignore invalid values | Phase 2 | [x] |
| 8 | Cache expired during request | Cache.get() returns None, service fetches fresh data, updates cache | Phase 1 | [x] |
| 9 | Device already imported as server | Query servers table by hostname, set already_imported=true if match found | Phase 2 | [x] |

### Coverage Summary

- Story edge cases: 9
- Handled in plan: 9
- Unhandled: 0

### Edge Case Implementation Notes

- Edge cases 1-4 reuse existing exception handling from US0076
- Edge case 7: Valid OS values from Tailscale API docs: linux, windows, macos, ios, android
- Edge case 9: Match on hostname field since we don't store Tailscale IPs in servers table

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tailscale API response format changes | Device parsing fails | Use defensive parsing with get() and fallback values |
| Cache memory growth with large tailnets | Memory pressure | Cache stores only device list, cleared on invalidate |
| Concurrent cache updates | Race conditions | Single cache instance per service, last write wins acceptable |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0076 (TailscaleService) | Story | Complete - provides get_devices() method |
| US0081 (CredentialService) | Story | Complete - provides token retrieval |
| httpx | Python library | Already installed |
| respx | Python library | Already installed for HTTP mocking |

## Open Questions

None.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (52 Tailscale tests, 1394 total)
- [x] Edge cases handled (9/9)
- [x] Code follows best practices
- [x] No linting errors
- [x] Documentation updated (AGENTS.md)
- [x] Ready for code review

## Notes

- Import button on device cards is a placeholder - actual import functionality is US0078
- Consider adding pagination if tailnets can have >100 devices (not in scope for this story)
- Cache is instance-level, not shared across requests - acceptable for single-process deployment
