# PL0049: Scan Dashboard Integration - Implementation Plan

> **Status:** Complete
> **Story:** [US0042: Scan Dashboard Integration](../stories/US0042-scan-dashboard-integration.md)
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-21
> **Language:** TypeScript

## Overview

Complete the Scans page by adding navigation link from the dashboard header and a "Recent Scans" widget showing the last 5 scans. Most functionality already exists in ScansPage.tsx - this plan addresses the remaining gaps.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Navigation Access | Scans page accessible from dashboard navigation |
| AC2 | Manual Scan Form | Form for hostname/IP input displayed (already exists) |
| AC3 | Scan Buttons | Quick and Full scan buttons available (already exists) |
| AC4 | Recent Scans | Last 5 scans displayed on Scans page |
| AC5 | History Link | Link to full scan history page (already exists) |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript
- **Framework:** React + Vite
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices

- Use functional components with hooks
- Extract reusable components
- Fetch data with useEffect and cleanup
- Use existing api client and types
- Follow existing component patterns (PendingActionsPanel, AlertBanner)

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| React | /facebook/react | useEffect data fetching | Cleanup, loading states |
| React Router | /remix-run/react-router | Link component | Use Link for navigation |

### Existing Patterns

- **Dashboard.tsx:289-301** - Header with navigation links (Settings button)
- **AlertBanner.tsx** - Example of compact list component
- **ScanHistoryPage.tsx** - Fetches scans with getScans(), shows list
- **api/scans.ts:27** - getScans(filters) already supports limit parameter

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI-focused story with simple page composition; existing patterns well-established; low edge case count (3)

### Test Priority

1. RecentScans component renders and fetches data
2. Navigation link to /scans present in Dashboard header
3. Empty state shown when no scans exist

### Documentation Updates Required

- [ ] None required - feature uses existing API

## Implementation Steps

### Phase 1: Add Navigation Link to Dashboard

**Goal:** Add "Scans" link in Dashboard header for easy access

#### Step 1.1: Add Link to Dashboard Header

- [x] Import Link from react-router-dom
- [x] Add Scans link between CostBadge and server count

**Files to modify:**
- `frontend/src/pages/Dashboard.tsx` - Add Link to /scans in header

**Considerations:**
- Use existing icon style (lucide-react Search icon)
- Match Settings button style (p-2 text-text-tertiary hover:text-text-primary)
- Position before Settings button for logical grouping

### Phase 2: Create Recent Scans Component

**Goal:** Display last 5 scans in a compact list on Scans page

#### Step 2.1: Create RecentScans Component

- [x] Create `frontend/src/components/RecentScans.tsx`
- [x] Fetch recent scans using getScans({ limit: 5 })
- [x] Display hostname, scan type, time ago, and status
- [x] Include "View All" link to /scans/history

**Files to create:**
- `frontend/src/components/RecentScans.tsx` - New component

**Component Structure:**
```typescript
interface RecentScansProps {
  // No props - self-contained component
}

export function RecentScans(): JSX.Element {
  // State: scans, loading, error
  // Effect: fetch on mount
  // Render: list or empty state
}
```

#### Step 2.2: Integrate into ScansPage

- [x] Import RecentScans component
- [x] Add between NetworkDiscovery and the "View Scan History" link
- [x] Remove standalone "View Scan History" link (now in RecentScans)

**Files to modify:**
- `frontend/src/pages/ScansPage.tsx` - Add RecentScans component

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 3.1: Unit Tests

- [ ] Write tests for RecentScans component
- [ ] Test Dashboard header link presence

#### Step 3.2: Integration Tests

- [ ] Test navigation from Dashboard to Scans page
- [ ] Test View All link navigates to history

#### Step 3.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Click Scans link in Dashboard header navigates to /scans | Pending |
| AC2 | Manual scan form visible on Scans page | Pending |
| AC3 | Quick Scan and Full Scan buttons visible | Pending |
| AC4 | Recent scans (last 5) displayed in widget | Pending |
| AC5 | View All link navigates to /scans/history | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Empty hostname | Disable scan buttons (already implemented) | N/A | [x] |
| 2 | Invalid IP format | Show validation error (already implemented) | N/A | [x] |
| 3 | No recent scans | Show "No scans yet" message in RecentScans | Phase 2 | [ ] |

### Coverage Summary

- Story edge cases: 3
- Handled in plan: 3
- Unhandled: 0

### Edge Case Implementation Notes

Empty state for RecentScans should match existing patterns:
- Use text-text-tertiary styling
- Simple message: "No scans yet. Run a scan to see results here."
- Consider adding a hint to use the form above

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API change breaks fetch | Medium | Use existing getScans function unchanged |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| api/scans.ts | Code | getScans({ limit: 5 }) already supported |
| types/scan.ts | Types | ScanListItem type for recent scans |

## Open Questions

None - all requirements clear from AC.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)
- [ ] Ready for code review

## Notes

Most of the work is already done in ScansPage.tsx. The main additions are:
1. A navigation link in Dashboard header
2. A RecentScans component showing last 5 scans

This is estimated at 3 story points, which aligns with the minimal implementation needed.
