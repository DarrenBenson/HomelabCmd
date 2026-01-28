# PL0081: Connectivity Mode Management - Implementation Plan

> **Status:** Complete
> **Story:** [US0080: Connectivity Mode Management](../stories/US0080-connectivity-mode-management.md)
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Created:** 2026-01-26
> **Language:** Python / TypeScript

## Overview

Implement connectivity mode management for HomelabCmd, allowing users to choose between Tailscale Mode (mesh network with API discovery) and Direct SSH Mode (manual IP configuration). The implementation adds a settings page for mode selection, auto-detection logic based on Tailscale token presence, and a dashboard status bar showing the current connectivity mode.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Connectivity settings page | Two mode options with current mode highlighted |
| AC2 | Tailscale Mode configuration | Requires valid token, shows tailnet info |
| AC3 | Direct SSH Mode configuration | No token required, manual setup |
| AC4 | Mode auto-detection | Detect mode from Tailscale token presence |
| AC5 | Dashboard status bar | Show current mode, click to open settings |
| AC6 | SSH configuration shared | Username and key shared between modes |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Backend Framework:** FastAPI with SQLAlchemy 2.0
- **Frontend Framework:** React 18 with TypeScript
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Catch specific exceptions, not bare `except:`
- Always set explicit timeouts on network operations
- Use type hints for function signatures

From `~/.claude/best-practices/typescript.md`:
- Avoid `any`, use `unknown` if type not known
- Handle `null` and `undefined` explicitly
- Explicit return types for exported functions

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | Settings endpoint patterns | APIRouter, Depends, HTTPException |
| Pydantic | /pydantic/pydantic | Validation with Literal types | Field, validator |

### Existing Patterns

**Settings API Pattern (tailscale.py, ssh_settings.py):**
- Router with `/settings/{service}` prefix
- GET /status, POST /save, DELETE /remove, POST /test endpoints
- Helper function `_get_credential_service(session)`
- HTTPException with detail dict containing `code` and `message`

**Config Storage Pattern (config.py):**
- Key-value pairs in `config` table with JSON value column
- Upsert pattern via `set_config_value(session, key, value)`
- Retrieve via `get_config_value(session, key)`

**Frontend Component Pattern (TailscaleSettings.tsx):**
- Self-contained with loading/error/success states
- useEffect for initial data fetch
- Form submission with loading state
- Confirmation modal for destructive actions

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Story extends existing patterns from US0076, US0079, US0081. Settings API and Config storage are well-established. Most complexity is UI work. All dependencies are already implemented and tested.

### Test Priority

1. Mode auto-detection with valid Tailscale token returns "tailscale"
2. Mode auto-detection without token returns "direct_ssh"
3. Mode auto-detection with invalid token falls back to "direct_ssh"
4. Cannot switch to Tailscale mode without valid token (400 error)
5. Mode persists to database correctly
6. SSH username validation (empty, invalid characters)
7. Status bar endpoint returns correct format

### Documentation Updates Required

- [x] AGENTS.md - Add connectivity settings endpoints
- [x] AGENTS.md - Add connectivity_service.py to project structure

## Implementation Tasks

> **Deterministic task table** - exact files, dependencies, and parallel execution flags.

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Create connectivity schemas | `backend/src/homelab_cmd/api/schemas/connectivity.py` | - | Yes | [x] |
| 2 | Create ConnectivityService | `backend/src/homelab_cmd/services/connectivity_service.py` | - | Yes | [x] |
| 3 | Add connectivity schemas to __init__ | `backend/src/homelab_cmd/api/schemas/__init__.py` | 1 | No | [x] |
| 4 | Create connectivity settings router | `backend/src/homelab_cmd/api/routes/connectivity_settings.py` | 1, 2 | No | [x] |
| 5 | Register router in main.py | `backend/src/homelab_cmd/main.py` | 4 | No | [x] |
| 6 | Create TypeScript types | `frontend/src/types/connectivity.ts` | - | Yes | [x] |
| 7 | Create API client | `frontend/src/api/connectivity.ts` | 6 | No | [x] |
| 8 | Create ConnectivitySettings component | `frontend/src/components/ConnectivitySettings.tsx` | 7 | No | [x] |
| 9 | Update Settings.tsx | `frontend/src/pages/Settings.tsx` | 8 | No | [x] |
| 10 | Add status bar to Dashboard | `frontend/src/pages/Dashboard.tsx` | 7 | No | [x] |
| 11 | Write backend tests | `tests/test_connectivity_settings.py` | 4 | No | [x] |
| 12 | Update AGENTS.md | `AGENTS.md` | 4 | No | [x] |

### Task Dependency Graph

```
1 (schemas) ──► 3 (init) ──► 4 (router) ──► 5 (main.py)
2 (service) ──────────────┘           │
                                      ▼
6 (TS types) ──► 7 (API client) ──► 8 (component) ──► 9 (Settings)
                        │
                        └──────────► 10 (Dashboard)
                                            │
                                     11 (tests) ──► 12 (docs)
```

### Parallel Execution Groups

Tasks that can run concurrently:

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 2, 6 | None |
| 2 | 3, 7 | Tasks 1, 6 |
| 3 | 4 | Tasks 1, 2, 3 |
| 4 | 5, 8, 10 | Tasks 4, 7 |
| 5 | 9, 11, 12 | Tasks 5, 8, 10 |

## Implementation Phases

### Phase 1: Backend - Schemas and Service

**Goal:** Create Pydantic schemas and ConnectivityService with auto-detection logic

**Tasks in this phase:** 1, 2, 3

#### Step 1.1: Create Pydantic Schemas

- [x] ConnectivityMode literal type ("tailscale" | "direct_ssh")
- [x] ConnectivityStatusResponse (full configuration)
- [x] ConnectivityUpdateRequest (mode, ssh_username)
- [x] ConnectivityUpdateResponse (success, mode, message)
- [x] ConnectivityStatusBarResponse (mode, display, healthy)
- [x] Add SSH username validator (regex: `^[a-z_][a-z0-9_-]{0,31}$`)

**Files modified:**
- `backend/src/homelab_cmd/api/schemas/connectivity.py` - New schema file
- `backend/src/homelab_cmd/api/schemas/__init__.py` - Export schemas

#### Step 1.2: Create ConnectivityService

- [x] `get_connectivity_status()` - Get full connectivity configuration
- [x] `detect_connectivity_mode()` - Auto-detect mode from token presence
- [x] `update_connectivity_mode()` - Update mode with validation
- [x] `get_status_bar_info()` - Get minimal status for dashboard
- [x] Integration with CredentialService for token check
- [x] Integration with TailscaleService for token validation

**Files modified:**
- `backend/src/homelab_cmd/services/connectivity_service.py` - New service

**Considerations:**
- Use async patterns consistent with other services
- Catch TailscaleAuthError and TailscaleConnectionError in auto-detect
- Default to "direct_ssh" when no configuration exists

### Phase 2: Backend - API Routes

**Goal:** Create connectivity settings API endpoints

**Tasks in this phase:** 4, 5

#### Step 2.1: Create Connectivity Settings Router

- [x] GET /api/v1/settings/connectivity - Full connectivity status
- [x] PUT /api/v1/settings/connectivity - Update mode and settings
- [x] GET /api/v1/settings/connectivity/status - Status bar data
- [x] Validation: Cannot switch to Tailscale without valid token
- [x] Clear SSH connection pool on mode change

**Files modified:**
- `backend/src/homelab_cmd/api/routes/connectivity_settings.py` - New router

#### Step 2.2: Register Router

- [x] Import connectivity_settings_router
- [x] Add to app.include_router()
- [x] Use tags=["Configuration"]

**Files modified:**
- `backend/src/homelab_cmd/main.py` - Register router

### Phase 3: Frontend - Types and API Client

**Goal:** Create TypeScript types and API client functions

**Tasks in this phase:** 6, 7

#### Step 3.1: Create TypeScript Types

- [x] ConnectivityMode type
- [x] TailscaleInfo interface
- [x] SSHInfo interface
- [x] ConnectivityStatusResponse interface
- [x] ConnectivityUpdateRequest interface
- [x] ConnectivityUpdateResponse interface
- [x] ConnectivityStatusBarResponse interface

**Files modified:**
- `frontend/src/types/connectivity.ts` - New type file

#### Step 3.2: Create API Client

- [x] getConnectivityStatus()
- [x] updateConnectivityMode()
- [x] getConnectivityStatusBar()

**Files modified:**
- `frontend/src/api/connectivity.ts` - New API client

### Phase 4: Frontend - UI Components

**Goal:** Create ConnectivitySettings component and integrate into Settings page

**Tasks in this phase:** 8, 9

#### Step 4.1: Create ConnectivitySettings Component

- [x] Mode selection radio buttons (Tailscale / Direct SSH)
- [x] Tailscale mode: show token status, tailnet info, device count
- [x] Direct SSH mode: show info about manual configuration
- [x] Highlight current active mode
- [x] Save mode button with loading state
- [x] Error handling for mode switch validation

**Files modified:**
- `frontend/src/components/ConnectivitySettings.tsx` - New component

#### Step 4.2: Update Settings Page

- [x] Import ConnectivitySettings component
- [x] Add as first section before Tailscale/SSH settings
- [x] Ensure proper spacing and layout

**Files modified:**
- `frontend/src/pages/Settings.tsx` - Add ConnectivitySettings

### Phase 5: Frontend - Dashboard Status Bar

**Goal:** Add connectivity status indicator to dashboard header

**Tasks in this phase:** 10

#### Step 5.1: Add Status Bar to Dashboard

- [x] Fetch connectivity status on mount
- [x] Display mode indicator in header
- [x] Tailscale: show mode and device info
- [x] Direct SSH: show mode indicator
- [x] Error state: show warning color
- [x] Click navigates to /settings
- [x] Refresh status periodically (60 seconds)

**Files modified:**
- `frontend/src/pages/Dashboard.tsx` - Add status bar to header

### Phase 6: Testing and Documentation

**Goal:** Write tests and update documentation

**Tasks in this phase:** 11, 12

#### Step 6.1: Backend Tests

- [x] Test mode auto-detection with valid token
- [x] Test mode auto-detection without token
- [x] Test mode auto-detection with expired token
- [x] Test cannot switch to Tailscale without token
- [x] Test mode persistence to database
- [x] Test SSH username validation (empty)
- [x] Test SSH username validation (invalid chars)
- [x] Test status bar endpoint format

**Test file:** `tests/test_connectivity_settings.py`

#### Step 6.2: Update Documentation

- [x] Add connectivity settings endpoints to AGENTS.md
- [x] Add connectivity_service.py to project structure

**Files modified:**
- `AGENTS.md` - Add endpoint documentation

#### Step 6.3: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | E2E test loads settings page | `ConnectivitySettings.tsx` | Done |
| AC2 | Unit test Tailscale mode requires token | `test_connectivity_settings.py` | Done |
| AC3 | Unit test Direct SSH mode no token | `test_connectivity_settings.py` | Done |
| AC4 | Unit test auto-detection | `test_connectivity_settings.py` | Done |
| AC5 | E2E test dashboard shows mode | `Dashboard.tsx` | Done |
| AC6 | Unit test SSH shared | `connectivity_service.py` | Done |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Switch to Tailscale without token | Check credential_exists() before mode change, return 400 with TAILSCALE_TOKEN_REQUIRED code | Phase 2 | [x] |
| 2 | Tailscale token expires while in Tailscale mode | Auto-detect calls test_connection(), on failure returns direct_ssh with mode_auto_detected=true | Phase 1 | [x] |
| 3 | Invalid mode value in request | Pydantic Literal["tailscale", "direct_ssh"] validation, auto 422 error | Phase 1 | [x] |
| 4 | SSH username empty | Pydantic validator with min_length=1, return 400 with SSH_USERNAME_REQUIRED | Phase 1 | [x] |
| 5 | SSH username with invalid characters | Regex validator `^[a-z_][a-z0-9_-]{0,31}$`, return 400 with INVALID_SSH_USERNAME | Phase 1 | [x] |
| 6 | Mode changed while connections active | Import SSHPooledExecutor, call clear_pool() on mode change | Phase 2 | [x] |
| 7 | Dashboard status when API unreachable | Frontend catches error, displays error indicator with warning color | Phase 5 | [x] |
| 8 | First startup with no configuration | detect_connectivity_mode() returns "direct_ssh" when no config/token exists | Phase 1 | [x] |

### Coverage Summary

- Story edge cases: 8
- Handled in plan: 8
- Unhandled: 0

### Edge Case Implementation Notes

- **Token validation in auto-detect** should catch both TailscaleAuthError (invalid token) and TailscaleConnectionError (network issues) - both fall back to direct_ssh
- **SSH username regex** follows Linux username conventions: lowercase letter or underscore, followed by up to 31 lowercase letters, digits, underscores, or hyphens
- **Connection pool clearing** is a best-effort operation - log warning if it fails but continue with mode change

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Config key may not exist | Mode returns null | Default to "direct_ssh" in service |
| TailscaleService throws on test | Auto-detect fails | Catch exceptions, fall back to direct_ssh |
| SSH pool clear fails | Stale connections | Log warning, continue mode change |
| Frontend conflicts with existing settings | UI broken | Keep component isolated, import into Settings.tsx |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0076 (Tailscale API Client) | Service | Tailscale token management - Done |
| US0079 (SSH Connection) | Service | SSH key configuration - Done |
| US0081 (Credential Service) | Service | Credential storage - Done |
| Config model | Database | Already exists in models/config.py |

## Open Questions

None - all questions resolved in story.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (26 tests)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors (frontend builds successfully)
- [x] Documentation updated (AGENTS.md)
- [x] Ready for code review

## Notes

- The ConnectivitySettings component should be placed BEFORE TailscaleSettings in the Settings page, as it provides context for why Tailscale configuration exists
- Consider refactoring Settings.tsx in a future story to use a tabbed interface if it gets too long
- The status bar indicator uses Link from react-router-dom for navigation
- Auto-detection runs on app start and whenever the settings page loads
