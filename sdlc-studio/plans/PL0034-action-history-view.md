# PL0034: Action History View

> **Status:** Complete
> **Story:** [US0031: Action History View](../stories/US0031-action-history-view.md)
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Created:** 2026-01-19

## Overview

Create an Actions page at `/actions` to display action history with filtering by server and status, pagination, and a detail panel showing full audit trail including execution output.

## Prerequisites

- [x] Action entity and API (US0024 - Complete)
- [x] Frontend types for Action (Complete)
- [x] API client for actions (Complete)
- [x] Pagination component (Complete)

## Implementation Steps

### Step 1: Create ActionsPage Component

**File:** `frontend/src/pages/ActionsPage.tsx`

Create the main page component following the AlertsPage pattern:

```tsx
// Key features:
// - URL-based filters (status, server_id)
// - Pagination with PAGE_SIZE = 20
// - Server filter dropdown (fetched from getServers)
// - Status filter dropdown (all, pending, approved, executing, completed, failed, rejected)
// - Table with columns: Server, Type, Status, Created, Completed
// - Row click opens detail panel
// - Refresh button
```

**Status configuration:**
| Status | Label | Colour |
|--------|-------|--------|
| pending | Pending | text-text-tertiary |
| approved | Approved | text-status-warning |
| executing | Executing | text-status-info |
| completed | Completed | text-status-success |
| failed | Failed | text-status-error |
| rejected | Rejected | text-text-muted |

**Table columns:**
1. Server - server_id (display name if available)
2. Type - action_type formatted (restart_service → "Restart Service")
3. Status - with colour coding
4. Created - formatRelativeTime(created_at)
5. Completed - formatRelativeTime(completed_at) or "-" if null

### Step 2: Create ActionDetailPanel Component

**File:** `frontend/src/components/ActionDetailPanel.tsx`

Slide-in panel showing full action details:

```tsx
interface ActionDetailPanelProps {
  action: Action;
  onClose: () => void;
}
```

**Content sections:**
1. **Header:** Action type and server (e.g., "Restart plex on omv-mediaserver")
2. **Status badge:** Coloured status indicator
3. **Timeline:** Chronological list of events:
   - Created: {created_at} by {created_by}
   - Approved: {approved_at} by {approved_by} (if approved)
   - Rejected: {rejected_at} by {rejected_by} - {rejection_reason} (if rejected)
   - Executed: {executed_at} (if executed)
   - Completed: {completed_at} (if completed)
4. **Command:** Display the command that was/will be executed
5. **Execution details (if executed):**
   - Exit code: {exit_code}
   - Output (stdout): Scrollable monospace block
   - Errors (stderr): Scrollable monospace block if present

**Styling:**
- Right slide-in panel (like AlertDetailPanel)
- Backdrop with close on click
- Scrollable content area
- Monospace font for command and output

### Step 3: Add Route to App.tsx

**File:** `frontend/src/App.tsx`

```tsx
import { ActionsPage } from './pages/ActionsPage';

// Add route:
<Route path="/actions" element={<ActionsPage />} />
```

### Step 4: Format Action Type Helper

**File:** `frontend/src/lib/formatters.ts`

Add function to format action types for display:

```tsx
export function formatActionType(actionType: string): string {
  const map: Record<string, string> = {
    'restart_service': 'Restart Service',
    'clear_logs': 'Clear Logs',
  };
  return map[actionType] || actionType.replace(/_/g, ' ');
}
```

### Step 5: Update Pagination Component

**File:** `frontend/src/components/Pagination.tsx`

Make the "alerts" text in "Showing X-Y of Z alerts" configurable:

```tsx
interface PaginationProps {
  // ... existing props
  itemName?: string;  // Default: "alerts"
}

// Usage: <Pagination itemName="actions" ... />
```

## Acceptance Criteria Mapping

| AC | Implementation |
|----|----------------|
| AC1: History page accessible | Route `/actions`, link from PendingActionsPanel "View All" |
| AC2: Actions listed with details | Table with Server, Type, Status, Created, Completed columns |
| AC3: Filter by server | Server dropdown filter, updates URL param `server` |
| AC4: Filter by status | Status dropdown filter, updates URL param `status` |
| AC5: View action details | Click row opens ActionDetailPanel with full audit trail |
| AC6: Pagination | Pagination component with 20 items per page |

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/pages/ActionsPage.tsx` | Main actions list page |
| `frontend/src/components/ActionDetailPanel.tsx` | Action detail slide-in panel |

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `/actions` route |
| `frontend/src/lib/formatters.ts` | Add `formatActionType` helper |
| `frontend/src/components/Pagination.tsx` | Add optional `itemName` prop |

## Test Plan

### Manual Testing

1. **Page access:**
   - Navigate to `/actions` directly
   - Click "View All" in PendingActionsPanel

2. **Actions list:**
   - Verify actions displayed in table
   - Verify correct columns shown
   - Verify status colours match config

3. **Filtering:**
   - Filter by server - verify URL updates, table filters
   - Filter by status - verify URL updates, table filters
   - Combine filters - verify both applied
   - Clear filters - verify reset

4. **Pagination:**
   - Create 50+ actions
   - Verify pagination shows
   - Verify page navigation works
   - Verify item count correct

5. **Detail panel:**
   - Click action row - panel opens
   - Verify all timeline events shown
   - Verify command displayed
   - Verify output displayed (for completed actions)
   - Close panel - verify closes

6. **Empty state:**
   - Clear all filters with no matching actions
   - Verify "No actions found" message

### Edge Cases

- Very long stdout/stderr (>10KB) - should be scrollable
- Actions with null fields (no service_name, no alert_id)
- Rejected action - shows rejection reason

## Dependencies

- Uses existing `getActions` API client
- Uses existing `getServers` API client
- Uses existing `Pagination` component
- Uses existing `formatRelativeTime` helper

## Estimation

**Effort:** Low-Medium (~2-3 hours)

- ActionsPage: 1-1.5 hours (follows AlertsPage pattern closely)
- ActionDetailPanel: 0.5-1 hour
- Route + helpers: 15 minutes
- Testing: 30 minutes

## Notes

- This page is **read-only** - no approve/reject actions (those are on Dashboard)
- Real-time updates out of scope - manual refresh only
- The PendingActionsPanel already links to `/actions?status=pending`
