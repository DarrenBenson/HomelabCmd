# PL0185: Compliance Dashboard Widget - Implementation Plan

> **Status:** Draft
> **Story:** [US0120: Compliance Dashboard Widget](../stories/US0120-compliance-dashboard-widget.md)
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Created:** 2026-01-29
> **Language:** Python + TypeScript

## Overview

Implement a dashboard widget that displays configuration compliance status across all managed servers. The widget provides at-a-glance visibility into which machines are compliant, non-compliant, or have never been checked, with quick links to detailed views.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Compliance Summary Endpoint | GET /api/v1/config/compliance returns counts and machine list |
| AC2 | Dashboard Widget Display | Shows title, counts, and non-compliant machine list |
| AC3 | Widget Colour Coding | Green/amber/grey border based on compliance state |
| AC4 | Machine List in Widget | Non-compliant machines with mismatch count and last checked |
| AC5 | Navigation Links | View Details and machine name clicks navigate correctly |
| AC6 | Refresh Button | "Check All" triggers compliance checks with progress |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+ (backend), TypeScript (frontend)
- **Framework:** FastAPI + SQLAlchemy (backend), React + Tailwind (frontend)
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices
- Use Pydantic for request/response validation
- Explicit return types on exported TypeScript functions
- Avoid `any` in TypeScript - use specific types
- Follow existing widget patterns from EP0012 (Widget-Based Detail View)
- Use existing MachineData interface patterns

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| FastAPI | /tiangolo/fastapi | Route dependency injection |
| React | /facebook/react | useState, useEffect, data fetching |

### Existing Patterns

**Backend (from compliance_service.py, config_check.py):**
- ComplianceCheckService for checking individual servers
- ConfigCheck model stores compliance results
- ConfigPack service for pack definitions
- Existing compliance check endpoint structure

**Frontend Widget System (from EP0012):**
- WidgetContainer for consistent widget styling
- widgetRegistry.ts for widget metadata
- WidgetProps interface: { machine, width?, height? }
- Responsive grid layout with react-grid-layout
- Auto-refresh patterns (60s intervals)
- Loading/error states per widget

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is primarily a UI widget story building on existing compliance infrastructure. The AC are clear and follow established widget patterns from EP0012. UI visual verification is easier after implementation.

### Test Priority
1. Summary endpoint returns correct counts (compliant/non-compliant/never_checked)
2. Endpoint aggregates data from all servers
3. Widget renders correct colour coding based on state
4. Navigation links work correctly
5. Check All triggers compliance checks

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create ComplianceSummary schema | `api/schemas/config_check.py` | - | [ ] |
| 2 | Create compliance summary endpoint | `api/routes/config_check.py` | 1 | [ ] |
| 3 | Add aggregation logic to service | `services/compliance_service.py` | 1 | [ ] |
| 4 | Create TypeScript types | `frontend/src/types/config-check.ts` | - | [ ] |
| 5 | Create API client function | `frontend/src/api/config-check.ts` | 4 | [ ] |
| 6 | Create ComplianceWidget component | `frontend/src/components/widgets/ComplianceWidget.tsx` | 4, 5 | [ ] |
| 7 | Register widget in widgetRegistry | `frontend/src/components/widgets/widgetRegistry.ts` | 6 | [ ] |
| 8 | Export widget from index | `frontend/src/components/widgets/index.ts` | 6 | [ ] |
| 9 | Add widget to ServerDetailWidgetView | `frontend/src/components/widgets/ServerDetailWidgetView.tsx` | 6, 7 | [ ] |
| 10 | Write backend unit tests | `tests/test_config_check_api.py` | 2 | [ ] |
| 11 | Write frontend unit tests | `frontend/src/__tests__/widgets/ComplianceWidget.test.tsx` | 6 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| Backend Schemas | 1 | None |
| Backend Logic | 2, 3 | Task 1 |
| Frontend Types | 4, 5 | None (parallel with backend) |
| Frontend Components | 6, 7, 8, 9 | Tasks 4, 5 |
| Tests | 10, 11 | Implementation complete |

---

## Implementation Phases

### Phase 1: Backend API
**Goal:** Create compliance summary endpoint

- [ ] Add ComplianceSummaryResponse schema with summary counts and machine list
- [ ] Add ComplianceMachineSummary schema for per-machine status
- [ ] Add GET /api/v1/config/compliance endpoint
- [ ] Implement aggregation: query ConfigCheck for latest per server, compute counts
- [ ] Handle servers without any compliance checks (never_checked status)

**Files:**
- `backend/src/homelab_cmd/api/schemas/config_check.py` - Add summary schemas
- `backend/src/homelab_cmd/api/routes/config_check.py` - Add summary endpoint
- `backend/src/homelab_cmd/services/compliance_service.py` - Add get_compliance_summary

### Phase 2: Frontend Widget
**Goal:** Create compliance widget following existing patterns

- [ ] Add TypeScript types for compliance summary response
- [ ] Add useComplianceSummary hook or direct fetch function
- [ ] Create ComplianceWidget component with:
  - Summary counts (compliant/non-compliant/never checked)
  - Color-coded border (green/amber/grey)
  - Non-compliant machine list (first 5)
  - View Details and Check All buttons
- [ ] Register widget in widgetRegistry with metadata
- [ ] Export widget from index.ts
- [ ] Add widget rendering to ServerDetailWidgetView

**Files:**
- `frontend/src/types/config-check.ts` - Add summary types
- `frontend/src/api/config-check.ts` - Add getComplianceSummary
- `frontend/src/components/widgets/ComplianceWidget.tsx` - New widget
- `frontend/src/components/widgets/widgetRegistry.ts` - Add registration
- `frontend/src/components/widgets/index.ts` - Export
- `frontend/src/components/widgets/ServerDetailWidgetView.tsx` - Render widget

### Phase 3: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test: endpoint returns counts | `tests/test_config_check_api.py` | Pending |
| AC2 | Unit test: widget renders counts | `ComplianceWidget.test.tsx` | Pending |
| AC3 | Unit test: border colour logic | `ComplianceWidget.test.tsx` | Pending |
| AC4 | Unit test: machine list rendering | `ComplianceWidget.test.tsx` | Pending |
| AC5 | Unit test: navigation handlers | `ComplianceWidget.test.tsx` | Pending |
| AC6 | Unit test: check all button | `ComplianceWidget.test.tsx` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | No machines have packs assigned | Show "No packs configured" message in widget | Phase 2 |
| 2 | All machines compliant | Show green success state, no "Needs Attention" section | Phase 2 |
| 3 | Check All fails for some machines | Show partial results with individual error indicators | Phase 2 |
| 4 | API timeout | Show error state with retry button | Phase 2 |
| 5 | >5 non-compliant machines | Show first 5 with "+X more" link | Phase 2 |

**Coverage:** 5/5 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large number of servers slows aggregation | Performance | Add pagination or limit to endpoint, cache results |
| Widget layout conflicts with existing | UI issues | Test in edit mode, follow grid constraints |
| Check All overwhelms backend | Resource exhaustion | Sequential execution with rate limiting, progress indicator |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Widget integrates with existing dashboard system

---

## Notes

- This widget differs from server-detail widgets as it shows fleet-wide status
- Consider placement: could be a dashboard-level widget rather than server-detail widget
- The "Check All" functionality may need background task pattern if checking many servers
- Reuses existing ComplianceCheckService infrastructure from US0117
