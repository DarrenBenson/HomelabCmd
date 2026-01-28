# PL0110: Warning State Visual Treatment - Implementation Plan

> **Status:** Complete
> **Story:** [US0110: Warning State Visual Treatment](../stories/US0110-warning-state-visual.md)
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-28
> **Language:** Python (backend), TypeScript (frontend)

## Overview

Implement visual distinction for servers with active alerts (warning state) so users can quickly triage servers needing attention vs servers that are down. This requires backend enhancement to include alert counts in server responses and frontend updates to display warning styling.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Warning state border | Yellow/amber border when status="online" AND active_alert_count > 0 |
| AC2 | Warning badge with count | Badge showing count (e.g., "3 alerts") with yellow background |
| AC3 | Status LED for warning | Yellow LED colour with tooltip "Warning - {count} active alerts" |
| AC4 | Backend provides alert count | Server response includes active_alert_count field |
| AC5 | Tooltip with alert summary | Hover tooltip shows max 3 alerts with "+N more" if exceeded |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Framework:** FastAPI (backend), React 18 (frontend)
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices
- Python: Use type hints, specific exception handling, efficient queries
- TypeScript: No `any`, explicit return types, strict null checks
- Both: Follow existing patterns in codebase

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Response models, dependency injection |
| SQLAlchemy | /sqlalchemy/sqlalchemy | Subqueries, func.count, group_by |
| React | /facebook/react | Conditional rendering, props |

### Existing Patterns
- **Backend Query Pattern:** list_servers uses window function subquery for metrics (lines 59-76 in servers.py)
- **Alert Model:** AlertStatus.OPEN = "open" for active alerts (alert.py line 27)
- **Index:** idx_alerts_server_status on (server_id, status) enables efficient filtering
- **Badge Pattern:** Maintenance badge in ServerCard.tsx (lines 131-140)
- **Status LED:** Conditional styling with isPaused priority (StatusLED.tsx lines 29-36)

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI-heavy story with visual elements that benefit from seeing the implementation before writing tests. Existing test patterns in codebase provide templates.

### Test Priority
1. Backend: API test verifying active_alert_count in server list response
2. Frontend: StatusLED test for warning state rendering
3. Frontend: ServerCard test for warning badge and border

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add active_alert_count field to ServerResponse | `backend/src/homelab_cmd/api/schemas/server.py` | - | [x] |
| 2 | Add active_alert_summaries field to ServerResponse | `backend/src/homelab_cmd/api/schemas/server.py` | 1 | [x] |
| 3 | Import Alert model and AlertStatus in servers.py | `backend/src/homelab_cmd/api/routes/servers.py` | - | [x] |
| 4 | Add alert count subquery to list_servers | `backend/src/homelab_cmd/api/routes/servers.py` | 3 | [x] |
| 5 | Add alert summaries subquery to list_servers | `backend/src/homelab_cmd/api/routes/servers.py` | 4 | [x] |
| 6 | Populate active_alert_count in server response | `backend/src/homelab_cmd/api/routes/servers.py` | 4 | [x] |
| 7 | Populate active_alert_summaries in server response | `backend/src/homelab_cmd/api/routes/servers.py` | 5 | [x] |
| 8 | Add active_alert_count to Server interface | `frontend/src/types/server.ts` | - | [x] |
| 9 | Add active_alert_summaries to Server interface | `frontend/src/types/server.ts` | 8 | [x] |
| 10 | Add activeAlertCount prop to StatusLED | `frontend/src/components/StatusLED.tsx` | - | [x] |
| 11 | Add warning state styling to StatusLED | `frontend/src/components/StatusLED.tsx` | 10 | [x] |
| 12 | Update StatusLED aria-label for warning | `frontend/src/components/StatusLED.tsx` | 11 | [x] |
| 13 | Add warning border styling to ServerCard | `frontend/src/components/ServerCard.tsx` | 8 | [x] |
| 14 | Add warning badge component to ServerCard | `frontend/src/components/ServerCard.tsx` | 8 | [x] |
| 15 | Add tooltip to warning badge | `frontend/src/components/ServerCard.tsx` | 14 | [x] |
| 16 | Pass activeAlertCount to StatusLED | `frontend/src/components/ServerCard.tsx` | 10, 13 | [x] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| Backend Schema | 1, 2 | None |
| Backend Query | 3, 4, 5, 6, 7 | Backend Schema |
| Frontend Types | 8, 9 | None |
| Frontend StatusLED | 10, 11, 12 | None |
| Frontend ServerCard | 13, 14, 15, 16 | Frontend Types, Frontend StatusLED |

---

## Implementation Phases

### Phase 1: Backend Schema
**Goal:** Add alert count fields to server response schema

- [ ] Add active_alert_count: int = Field(0) to ServerResponse
- [ ] Add active_alert_summaries: list[str] = Field(default_factory=list) to ServerResponse

**Files:** `backend/src/homelab_cmd/api/schemas/server.py` - Add two new fields after line 203

### Phase 2: Backend Query
**Goal:** Efficiently query alert counts and populate response

- [ ] Import Alert and AlertStatus from db.models.alert
- [ ] Create alert count subquery: SELECT server_id, COUNT(*) WHERE status='open' GROUP BY server_id
- [ ] Create alert summaries subquery: SELECT server_id, array of titles LIMIT 3
- [ ] LEFT JOIN alert subqueries with main server query
- [ ] Populate active_alert_count from query result (default 0 if NULL)
- [ ] Populate active_alert_summaries from query result (default [] if NULL)

**Files:** `backend/src/homelab_cmd/api/routes/servers.py` - Modify list_servers function (lines 45-108)

### Phase 3: Frontend Types
**Goal:** Update TypeScript types to match new API response

- [ ] Add active_alert_count: number to Server interface
- [ ] Add active_alert_summaries?: string[] to Server interface

**Files:** `frontend/src/types/server.ts` - Add fields to Server interface (around line 49)

### Phase 4: Frontend StatusLED
**Goal:** Add warning state visual to status indicator

- [ ] Add activeAlertCount?: number prop to StatusLEDProps
- [ ] Add hasWarning derived state: activeAlertCount > 0 && status === 'online' && !isPaused
- [ ] Add warning colour class: 'bg-status-warning animate-pulse' when hasWarning
- [ ] Update aria-label: 'Server status: warning - N active alerts'
- [ ] Maintain priority: offline > paused > warning > online

**Files:** `frontend/src/components/StatusLED.tsx` - Modify component

### Phase 5: Frontend ServerCard
**Goal:** Add warning visual treatment to server cards

- [ ] Derive hasWarning: server.active_alert_count > 0 && status === 'online' && !isPaused
- [ ] Add conditional border: 'border-l-yellow-500' when hasWarning
- [ ] Add warning badge after machine type badge showing count
- [ ] Use formatUpdateCount for 99+ display
- [ ] Add title tooltip with summaries (max 3, "+N more" if exceeded)
- [ ] Pass activeAlertCount to StatusLED component

**Files:** `frontend/src/components/ServerCard.tsx` - Modify component

### Phase 6: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test for border class when hasWarning | `ServerCard.test.tsx` | Pending |
| AC2 | Unit test for badge rendering with count | `ServerCard.test.tsx` | Pending |
| AC3 | Unit test for StatusLED warning colour | `StatusLED.test.tsx` | Pending |
| AC4 | API test for active_alert_count in response | `test_api_servers.py` | Pending |
| AC5 | Unit test for tooltip content | `ServerCard.test.tsx` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Server offline with alerts | Check status first; offline styling takes precedence over warning | Phase 4, 5 |
| 2 | Alert resolved while viewing | Dashboard polls every 30s; count updates on next poll | Phase 2 |
| 3 | 0 active alerts | Conditional rendering; no warning styling when count=0 | Phase 4, 5 |
| 4 | 100+ active alerts | Use formatUpdateCount pattern showing "99+" | Phase 5 |
| 5 | Alert query fails | Try/except in backend; log error, return count=0 | Phase 2 |
| 6 | Server paused with alerts | isPaused check takes precedence over warning | Phase 4, 5 |

**Coverage:** 6/6 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| N+1 queries for summaries | Dashboard slow | Use subquery with GROUP BY, LIMIT in SQL |
| Alert count query slows list_servers | Dashboard load > 3s | Use existing index idx_alerts_server_status |
| Visual priority confusion | Wrong state displayed | Clear priority order in code, comprehensive tests |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Manual verification in browser

---

## Notes

**Visual Priority Order (highest to lowest):**
1. Offline (red) - Server is down
2. Paused/Maintenance (amber with wrench) - Intentionally in maintenance
3. Warning (yellow) - Online but has active alerts
4. Online (green) - Healthy

**Colour References from index.css:**
- status-success: #4ADE80 (green)
- status-warning: #FBBF24 (yellow/amber)
- status-error: #F87171 (red)

**Existing Pattern References:**
- Badge: Maintenance badge pattern (ServerCard.tsx lines 131-140)
- Border: Machine type border pattern (ServerCard.tsx line 73)
- LED Priority: isPaused check (StatusLED.tsx line 31)
