# PL0036: Package Update List View - Implementation Plan

> **Status:** Complete
> **Story:** [US0051: Package Update List View](../stories/US0051-package-update-list.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-20
> **Language:** Python (Backend), TypeScript (Frontend)

## Overview

Implement detailed package update listing to replace the current aggregate count display. The agent will collect individual package information, store it in a new database table, and expose it via a new API endpoint for frontend display.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Agent collects package list | Agent collects name, versions, repository, and security flag for each upgradable package |
| AC2 | Package list stored in database | Heartbeat processing stores package list in new `pending_packages` table |
| AC3 | Package list displayed in server detail | Server detail page shows expandable table with package details |
| AC4 | Package list filterable by type | Filter toggle for "All" vs "Security only" packages |
| AC5 | Package list refreshed on heartbeat | Package list updates automatically with each heartbeat |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.12+ (Backend), TypeScript (Frontend)
- **Framework:** FastAPI (Backend), React with Vite (Frontend)
- **Test Framework:** pytest (Backend), Vitest (Frontend)

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use specific exception handling, not bare `except:`
- HTTP requests must have explicit timeouts
- Type hints on all public functions
- Use pathlib for file paths
- Use logging instead of print

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | API endpoint with nested relationships | Depends, Query params, response_model |
| SQLAlchemy | /sqlalchemy/sqlalchemy | async upsert with conflict resolution | merge(), on_conflict_do_update |
| Pydantic | /pydantic/pydantic | nested response schemas | model_validate, Field |

### Existing Patterns

From codebase exploration:
- **Server model:** `backend/src/homelab_cmd/db/models/server.py` - follows TimestampMixin pattern
- **Routes pattern:** `backend/src/homelab_cmd/api/routes/servers.py` - uses `verify_api_key` dependency, standard responses
- **Schema pattern:** `backend/src/homelab_cmd/api/schemas/server.py` - Pydantic models with Field descriptions
- **Agent collectors:** `agent/collectors.py` - subprocess-based collection with timeout handling
- **Heartbeat processing:** `backend/src/homelab_cmd/api/routes/agents.py` - async session handling

## Recommended Approach

**Strategy:** TDD
**Rationale:** This is an API story with 10 well-defined edge cases. The API contracts are clearly specified in the story. Writing tests first will ensure edge cases are covered and serve as living documentation.

### Test Priority

1. Agent collection tests - verify `apt list --upgradable` parsing
2. API endpoint tests - GET /api/v1/servers/{id}/packages returns correct schema
3. Heartbeat integration tests - package data persisted correctly
4. Frontend component tests - PackageList component rendering and filtering

### Documentation Updates Required

- [ ] Update API documentation with new endpoint
- [ ] Update agent README with package list collection

## Implementation Steps

### Phase 1: Database Model

**Goal:** Create `PendingPackage` model and migration

#### Step 1.1: Create PendingPackage Model

- [ ] Create `backend/src/homelab_cmd/db/models/pending_package.py`
- [ ] Define columns: id, server_id, name, current_version, new_version, repository, is_security, detected_at, updated_at
- [ ] Add relationship to Server model
- [ ] Add `pending_packages` relationship to Server model

**Files to modify:**
- `backend/src/homelab_cmd/db/models/pending_package.py` - New file
- `backend/src/homelab_cmd/db/models/server.py` - Add relationship
- `backend/src/homelab_cmd/db/models/__init__.py` - Export new model

**Considerations:**
- Use UUID for primary key (consistent with other models)
- Use composite unique constraint on (server_id, name) for upsert operations
- Include TimestampMixin for created_at/updated_at

#### Step 1.2: Create Migration

- [ ] Generate Alembic migration
- [ ] Test migration on fresh database
- [ ] Test migration on existing database with data

**Files to modify:**
- `backend/alembic/versions/xxx_add_pending_packages.py` - New migration

### Phase 2: API Endpoint

**Goal:** Create GET /api/v1/servers/{server_id}/packages endpoint

#### Step 2.1: Create Response Schema

- [ ] Create `PackageResponse` schema with all fields
- [ ] Create `PackageListResponse` schema with packages array and metadata
- [ ] Add Field descriptions and validation

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/server.py` - Add PackageResponse, PackageListResponse

#### Step 2.2: Create API Route

- [ ] Add GET endpoint to servers router
- [ ] Query pending_packages by server_id
- [ ] Return 404 if server not found
- [ ] Include last_checked timestamp (server.last_seen)
- [ ] Include counts (total and security)

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/servers.py` - Add get_server_packages endpoint

### Phase 3: Agent Collection

**Goal:** Agent collects individual package details

#### Step 3.1: Update Collectors

- [ ] Add `get_package_update_list()` function to collectors.py
- [ ] Parse `apt list --upgradable` output
- [ ] Extract: name, current_version, new_version, repository
- [ ] Detect security packages from repository name
- [ ] Handle timeout (30s) and errors gracefully

**Files to modify:**
- `agent/collectors.py` - Add get_package_update_list function

#### Step 3.2: Update Heartbeat

- [ ] Add packages field to heartbeat payload
- [ ] Call get_package_update_list() in main loop
- [ ] Include in send_heartbeat() call

**Files to modify:**
- `agent/heartbeat.py` - Add packages to payload
- `agent/__main__.py` - Call get_package_update_list

### Phase 4: Heartbeat Processing

**Goal:** Backend processes and stores package list from heartbeat

#### Step 4.1: Update Heartbeat Schema

- [ ] Add `PackageUpdate` schema to heartbeat.py
- [ ] Add `packages` field to HeartbeatRequest (list of PackageUpdate)

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add PackageUpdate, packages field

#### Step 4.2: Update Heartbeat Handler

- [ ] Process packages in receive_heartbeat endpoint
- [ ] Delete existing packages for server not in new list
- [ ] Upsert new/updated packages
- [ ] Update detected_at for new, updated_at for existing

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Process packages in heartbeat

### Phase 5: Frontend Components

**Goal:** Display package list in server detail view

#### Step 5.1: Add Types

- [ ] Add Package interface to types/server.ts
- [ ] Add PackagesResponse interface

**Files to modify:**
- `frontend/src/types/server.ts` - Add Package types

#### Step 5.2: Add API Hook

- [ ] Create useServerPackages hook
- [ ] Fetch from GET /api/v1/servers/{id}/packages
- [ ] Handle loading and error states

**Files to modify:**
- `frontend/src/hooks/useServerPackages.ts` - New file

#### Step 5.3: Create PackageList Component

- [ ] Create expandable/collapsible section
- [ ] Table with columns: Package, Current, Available, Type
- [ ] Security badge with warning colour
- [ ] Filter toggle: All / Security Only
- [ ] Empty state: "No updates available" or "Package information not available"
- [ ] Pagination for 25+ packages

**Files to modify:**
- `frontend/src/components/PackageList.tsx` - New file
- `frontend/src/pages/ServerDetail.tsx` - Include PackageList component

### Phase 6: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 6.1: Backend Unit Tests

- [ ] Test PendingPackage model creation
- [ ] Test package API endpoint (success, not found, empty)
- [ ] Test heartbeat package processing (create, update, delete)

**Files to modify:**
- `backend/tests/test_packages.py` - New file

#### Step 6.2: Agent Unit Tests

- [ ] Test get_package_update_list() with mock output
- [ ] Test parsing various apt output formats
- [ ] Test error handling (timeout, permission denied)

**Files to modify:**
- `agent/tests/test_collectors.py` - Add package list tests

#### Step 6.3: Frontend Unit Tests

- [ ] Test PackageList component rendering
- [ ] Test filter toggle functionality
- [ ] Test empty states

**Files to modify:**
- `frontend/src/components/__tests__/PackageList.test.tsx` - New file

#### Step 6.4: Integration Tests

- [ ] Test full flow: agent -> heartbeat -> API -> frontend
- [ ] Test with 100+ packages for pagination

#### Step 6.5: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Agent unit tests with mock apt output | Pending |
| AC2 | API integration test showing database storage | Pending |
| AC3 | Frontend component test showing table render | Pending |
| AC4 | Frontend test toggling filter | Pending |
| AC5 | Integration test with multiple heartbeats | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | apt not available (non-Debian) | Agent catches subprocess exception, returns empty list; API returns 200 with empty packages; UI shows "Package information not available" | Phase 3 | [ ] |
| 2 | Very large package list (100+) | API returns all packages; frontend paginates with 25 per page | Phase 2, 5 | [ ] |
| 3 | Package removed between heartbeats | Backend deletes packages not in new list before upserting | Phase 4 | [ ] |
| 4 | Same package, version changed | Backend uses upsert with ON CONFLICT DO UPDATE | Phase 4 | [ ] |
| 5 | Server not found | API returns 404 with `{"detail": "Server not found"}` | Phase 2 | [ ] |
| 6 | Server exists but no heartbeat yet | API returns 200 with empty packages, last_checked: null | Phase 2 | [ ] |
| 7 | apt list command times out | Agent catches subprocess.TimeoutExpired, returns empty list | Phase 3 | [ ] |
| 8 | Package name contains special chars | Store as-is (UTF-8), display with proper escaping | Phase 4, 5 | [ ] |
| 9 | Repository field contains colons/slashes | Parse regex handles common formats | Phase 3 | [ ] |
| 10 | Concurrent heartbeat updates | Database transaction handles race; last write wins | Phase 4 | [ ] |

### Coverage Summary

- Story edge cases: 10
- Handled in plan: 10
- Unhandled: 0

### Edge Case Implementation Notes

- Edge case #1: Agent uses try/except around subprocess call with FileNotFoundError and subprocess.CalledProcessError
- Edge case #2: Frontend uses pagination component with configurable page size (default 25)
- Edge case #3: Backend deletes all packages for server_id before inserting new ones (within same transaction)
- Edge case #4: Alternative to delete-all: use INSERT ... ON CONFLICT (server_id, name) DO UPDATE SET
- Edge case #10: Wrap heartbeat package processing in database transaction; isolation level handles race

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| apt output format varies by version | Medium | Test on OMV (Debian 12) and Raspberry Pi OS (Debian 11) |
| Large package lists cause slow heartbeat | Low | Package collection is already separate from metrics; 100 packages ~5KB JSON |
| Database growth with many servers | Low | Packages are replaced on each heartbeat, not accumulated |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0044: Package Update Display | Story | Done - provides baseline counts we're extending |
| US0003: Agent Heartbeat | Story | Done - heartbeat infrastructure exists |
| US0006: Server Detail View | Story | Done - provides UI location for package list |

## Open Questions

- [x] Should we paginate server-side or client-side? **Decision: Client-side for simplicity; all packages fit in reasonable response size**

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)
- [ ] Ready for code review
- [ ] Manual verification on OMV and Raspberry Pi OS

## Notes

- The existing `updates_available` and `security_updates` counts will continue to be populated for backward compatibility
- The new package list provides the detail behind those counts
- Agent changes are backward compatible (new field in heartbeat, ignored by older backends)
