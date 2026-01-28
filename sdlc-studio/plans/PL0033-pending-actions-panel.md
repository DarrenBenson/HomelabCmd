# PL0033: Pending Actions Panel - Implementation Plan

> **Status:** Complete
> **Story:** [US0030: Pending Actions Panel](../stories/US0030-pending-actions-panel.md)
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Created:** 2026-01-19
> **Language:** TypeScript (React)

## Overview

Implement the Pending Actions Panel for the dashboard. This panel displays actions awaiting approval on paused servers, with approve/reject buttons for each action. The backend API (US0024, US0026) is already complete.

## Acceptance Criteria Summary

| AC | Name | Description | Backend |
|----|------|-------------|---------|
| AC1 | Panel visible | Dashboard shows panel when pending actions exist | GET /api/v1/actions?status=pending |
| AC2 | Panel hidden | Panel not shown when no pending actions | N/A |
| AC3 | Action details | Server name, action type, service name, created time shown | N/A |
| AC4 | Approve works | Approve button approves action and removes from list | POST /api/v1/actions/{id}/approve |
| AC5 | Reject works | Reject shows reason modal, then rejects action | POST /api/v1/actions/{id}/reject |
| AC6 | Maintenance indicator | Badge indicates why approval required | N/A |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript 5.x
- **Framework:** React 18 with Vite
- **Test Framework:** Vitest with React Testing Library
- **Styling:** Tailwind CSS

### Relevant Best Practices

- Follow existing AlertBanner pattern for panel layout
- Use optimistic UI updates (remove action immediately, revert on error)
- Maintain consistent test patterns from existing test files
- Use Tailwind utility class conventions from brand guide

### Existing Patterns

From `frontend/src/components/AlertBanner.tsx`:
- Panel with header, item list, and "View All" link
- Empty state handling
- Item limit with "+N more" indicator

From `frontend/src/pages/Dashboard.tsx`:
- Polling pattern with useEffect and interval
- Optimistic updates with loading state tracking
- Error toast for failed operations

From `frontend/src/api/servers.ts`:
- Type-safe API functions

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI changes follow established patterns from AlertBanner. Write implementation first, then add targeted tests.

### Test Priority

1. PendingActionsPanel: Visibility when actions exist/empty
2. ActionCard: Details display and button clicks
3. RejectModal: Form validation and submission
4. API: getActions, approveAction, rejectAction functions

## Implementation Steps

### Phase 1: Type Definitions

**Goal:** Add Action types to frontend

#### Step 1.1: Create action types

- [ ] Create `frontend/src/types/action.ts` with Action interfaces
- [ ] Define ActionResponse, ActionListResponse, RejectActionRequest

**Files to create:**
- `frontend/src/types/action.ts`

**Implementation:**
```typescript
export type ActionStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'rejected';
export type ActionType = 'restart_service' | 'clear_logs';

export interface Action {
  id: number;
  server_id: string;
  action_type: ActionType;
  status: ActionStatus;
  service_name: string | null;
  command: string;
  alert_id: number | null;
  created_at: string;
  created_by: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  executed_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  stdout: string | null;
  stderr: string | null;
}

export interface ActionsResponse {
  actions: Action[];
  total: number;
  limit: number;
  offset: number;
}

export interface RejectActionRequest {
  reason: string;
}
```

---

### Phase 2: API Client Extensions

**Goal:** Add actions API functions

#### Step 2.1: Create actions API module

- [ ] Create `frontend/src/api/actions.ts`
- [ ] Add `getActions(params?)` function with status filter
- [ ] Add `approveAction(actionId)` function
- [ ] Add `rejectAction(actionId, reason)` function

**Files to create:**
- `frontend/src/api/actions.ts`

**Implementation:**
```typescript
import { api } from './client';
import type { Action, ActionsResponse, RejectActionRequest } from '../types/action';

export interface GetActionsParams {
  status?: string;
  server_id?: string;
  limit?: number;
  offset?: number;
}

export async function getActions(params?: GetActionsParams): Promise<ActionsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.server_id) searchParams.set('server_id', params.server_id);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const query = searchParams.toString();
  const url = query ? `/api/v1/actions?${query}` : '/api/v1/actions';
  return api.get<ActionsResponse>(url);
}

export async function approveAction(actionId: number): Promise<Action> {
  return api.post<Action>(`/api/v1/actions/${actionId}/approve`, {});
}

export async function rejectAction(actionId: number, reason: string): Promise<Action> {
  const body: RejectActionRequest = { reason };
  return api.post<Action>(`/api/v1/actions/${actionId}/reject`, body);
}
```

---

### Phase 3: Utility Functions

**Goal:** Add relative time formatting

#### Step 3.1: Add formatRelativeTime utility

- [ ] Check if `formatRelativeTime` exists in `frontend/src/utils/`
- [ ] If not, create utility function

**Files to check/create:**
- `frontend/src/utils/formatTime.ts` or similar

**Implementation (if needed):**
```typescript
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}
```

---

### Phase 4: RejectModal Component

**Goal:** Create modal for rejection reason input

#### Step 4.1: Create RejectModal component

- [ ] Create modal with title, action description, reason textarea, Cancel/Reject buttons
- [ ] Validate reason is not empty
- [ ] Call onReject with reason on submit

**Files to create:**
- `frontend/src/components/RejectModal.tsx`

**Implementation:**
```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import type { Action } from '../types/action';

interface RejectModalProps {
  action: Action;
  onReject: (reason: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RejectModal({ action, onReject, onCancel, isLoading }: RejectModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onReject(reason.trim());
    }
  };

  const actionDescription = action.action_type === 'restart_service'
    ? `Restart ${action.service_name} on ${action.server_id}`
    : `${action.action_type} on ${action.server_id}`;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="reject-modal-overlay"
      onClick={onCancel}
    >
      <div
        className="bg-bg-panel border border-border-default rounded-lg w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
        data-testid="reject-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Reject Action</h2>
          <button
            onClick={onCancel}
            className="p-1 text-text-tertiary hover:text-text-secondary rounded"
            aria-label="Close"
            data-testid="reject-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4">
          <p className="text-text-secondary text-sm mb-4">
            Rejecting: <span className="font-medium text-text-primary">{actionDescription}</span>
          </p>

          <label className="block text-sm font-medium text-text-secondary mb-2">
            Reason (required):
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Service recovered automatically"
            className="w-full h-24 px-3 py-2 bg-bg-secondary border border-border-default rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-status-info resize-none"
            data-testid="reject-reason-input"
            disabled={isLoading}
            required
          />

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              data-testid="reject-modal-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || isLoading}
              className="px-4 py-2 text-sm font-medium bg-status-error text-white rounded-md hover:bg-status-error/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="reject-modal-submit"
            >
              {isLoading ? 'Rejecting...' : 'Reject Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### Phase 5: PendingActionCard Component

**Goal:** Create card for individual pending action

#### Step 5.1: Create PendingActionCard component

- [ ] Show server name with maintenance badge
- [ ] Show action description (type + service name)
- [ ] Show relative created time
- [ ] Approve button (green)
- [ ] Reject button (red)

**Files to create:**
- `frontend/src/components/PendingActionCard.tsx`

**Implementation:**
```tsx
import { Check, X, Wrench } from 'lucide-react';
import type { Action } from '../types/action';
import { formatRelativeTime } from '../utils/formatTime';

interface PendingActionCardProps {
  action: Action;
  onApprove: (actionId: number) => void;
  onReject: (action: Action) => void;
  isApproving?: boolean;
}

export function PendingActionCard({
  action,
  onApprove,
  onReject,
  isApproving,
}: PendingActionCardProps) {
  const actionDescription = action.action_type === 'restart_service'
    ? `Restart Service: ${action.service_name}`
    : action.action_type === 'clear_logs'
    ? 'Clear Logs'
    : action.action_type;

  return (
    <div
      className="bg-bg-secondary border border-border-subtle rounded-lg p-3"
      data-testid={`pending-action-${action.id}`}
    >
      {/* Header with server name and maintenance badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="font-semibold text-sm text-text-primary"
          data-testid="action-server-name"
        >
          {action.server_id}
        </span>
        <span
          className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-status-warning/20 text-status-warning"
          data-testid="maintenance-mode-badge"
        >
          <Wrench className="w-3 h-3" />
          Maintenance Mode
        </span>
      </div>

      {/* Action description */}
      <p
        className="text-sm text-text-secondary mb-1"
        data-testid="action-description"
      >
        {actionDescription}
      </p>

      {/* Created time */}
      <p
        className="text-xs text-text-tertiary mb-3"
        data-testid="action-created-at"
      >
        Created: {formatRelativeTime(action.created_at)}
      </p>

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onApprove(action.id)}
          disabled={isApproving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-status-success/20 text-status-success hover:bg-status-success/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="approve-button"
        >
          <Check className="w-3.5 h-3.5" />
          {isApproving ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={() => onReject(action)}
          disabled={isApproving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-status-error/20 text-status-error hover:bg-status-error/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="reject-button"
        >
          <X className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}
```

---

### Phase 6: PendingActionsPanel Component

**Goal:** Create panel container for pending actions

#### Step 6.1: Create PendingActionsPanel component

- [ ] Show panel header with action count
- [ ] Display list of PendingActionCard components
- [ ] Handle empty state (return null)
- [ ] Support scrollable list for many actions

**Files to create:**
- `frontend/src/components/PendingActionsPanel.tsx`

**Implementation:**
```tsx
import { Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PendingActionCard } from './PendingActionCard';
import type { Action } from '../types/action';

interface PendingActionsPanelProps {
  actions: Action[];
  onApprove: (actionId: number) => void;
  onReject: (action: Action) => void;
  approvingIds: Set<number>;
  maxDisplay?: number;
}

export function PendingActionsPanel({
  actions,
  onApprove,
  onReject,
  approvingIds,
  maxDisplay = 5,
}: PendingActionsPanelProps) {
  // AC2: Panel hidden when empty
  if (actions.length === 0) {
    return null;
  }

  const displayActions = actions.slice(0, maxDisplay);
  const hasMore = actions.length > maxDisplay;

  return (
    <div
      className="bg-bg-secondary border border-border-default rounded-lg p-4"
      data-testid="pending-actions-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-status-warning" />
          <span className="text-text-primary font-medium" data-testid="pending-actions-count">
            Pending Actions ({actions.length})
          </span>
        </div>
        <Link
          to="/actions?status=pending"
          className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          data-testid="view-all-actions-link"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Action List */}
      <div className="space-y-2 max-h-80 overflow-y-auto" data-testid="pending-actions-list">
        {displayActions.map((action) => (
          <PendingActionCard
            key={action.id}
            action={action}
            onApprove={onApprove}
            onReject={onReject}
            isApproving={approvingIds.has(action.id)}
          />
        ))}
      </div>

      {/* Show more indicator */}
      {hasMore && (
        <div className="mt-3 pt-3 border-t border-border-subtle text-center">
          <span className="text-sm text-text-tertiary">
            +{actions.length - maxDisplay} more action{actions.length - maxDisplay !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
```

---

### Phase 7: Dashboard Integration

**Goal:** Integrate PendingActionsPanel into Dashboard

#### Step 7.1: Update Dashboard to fetch and display pending actions

- [ ] Import action types and API functions
- [ ] Add state for pendingActions, approvingIds, rejectingAction
- [ ] Fetch pending actions in useEffect alongside servers/alerts
- [ ] Add handleApprove function (optimistic update)
- [ ] Add handleReject function (shows modal, then calls API)
- [ ] Render PendingActionsPanel between AlertBanner and ServerGrid
- [ ] Render RejectModal when rejectingAction is set

**Files to modify:**
- `frontend/src/pages/Dashboard.tsx`

**Implementation (key changes):**
```tsx
// Add imports
import { PendingActionsPanel } from '../components/PendingActionsPanel';
import { RejectModal } from '../components/RejectModal';
import { getActions, approveAction, rejectAction } from '../api/actions';
import type { Action } from '../types/action';

// Add state
const [pendingActions, setPendingActions] = useState<Action[]>([]);
const [approvingIds, setApprovingIds] = useState<Set<number>>(new Set());
const [rejectingAction, setRejectingAction] = useState<Action | null>(null);
const [rejectLoading, setRejectLoading] = useState(false);
const [actionError, setActionError] = useState<string | null>(null);

// Update fetchData to include actions
async function fetchData() {
  try {
    const [serverData, alertData, actionsData] = await Promise.all([
      getServers(),
      getAlerts({ status: 'open' }),
      getActions({ status: 'pending' }),
    ]);
    if (!ignore) {
      setServers(serverData.servers);
      setAlerts(sortAlerts(alertData.alerts));
      setPendingActions(actionsData.actions);
      setError(null);
    }
  } catch (err) {
    // ... error handling
  }
}

// Add handlers
async function handleApproveAction(actionId: number) {
  setApprovingIds((prev) => new Set(prev).add(actionId));
  setActionError(null);

  // Optimistic update
  setPendingActions((prev) => prev.filter((a) => a.id !== actionId));

  try {
    await approveAction(actionId);
  } catch (err) {
    // Revert on error
    const message = err instanceof Error ? err.message : 'Failed to approve action';
    setActionError(message);
    // Refetch to restore
    const actionsData = await getActions({ status: 'pending' });
    setPendingActions(actionsData.actions);
    setTimeout(() => setActionError(null), 5000);
  } finally {
    setApprovingIds((prev) => {
      const next = new Set(prev);
      next.delete(actionId);
      return next;
    });
  }
}

async function handleRejectAction(reason: string) {
  if (!rejectingAction) return;

  setRejectLoading(true);
  setActionError(null);

  try {
    await rejectAction(rejectingAction.id, reason);
    // Remove from list on success
    setPendingActions((prev) => prev.filter((a) => a.id !== rejectingAction.id));
    setRejectingAction(null);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reject action';
    setActionError(message);
    setTimeout(() => setActionError(null), 5000);
  } finally {
    setRejectLoading(false);
  }
}

// In JSX, after AlertBanner:
<PendingActionsPanel
  actions={pendingActions}
  onApprove={handleApproveAction}
  onReject={setRejectingAction}
  approvingIds={approvingIds}
/>

{/* Reject Modal */}
{rejectingAction && (
  <RejectModal
    action={rejectingAction}
    onReject={handleRejectAction}
    onCancel={() => setRejectingAction(null)}
    isLoading={rejectLoading}
  />
)}
```

---

### Phase 8: Testing

**Goal:** Add tests for new components

#### Step 8.1: Add actions API tests

- [ ] Test getActions with status filter
- [ ] Test approveAction POST request
- [ ] Test rejectAction POST request with reason

**Files to create:**
- `frontend/src/api/actions.test.ts`

#### Step 8.2: Add PendingActionsPanel tests

- [ ] Test panel visible when actions exist
- [ ] Test panel hidden when no actions
- [ ] Test action count displayed
- [ ] Test action details shown

**Files to create:**
- `frontend/src/components/PendingActionsPanel.test.tsx`

#### Step 8.3: Add PendingActionCard tests

- [ ] Test server name displayed
- [ ] Test maintenance badge visible
- [ ] Test action description
- [ ] Test approve button click
- [ ] Test reject button click

**Files to create:**
- `frontend/src/components/PendingActionCard.test.tsx`

#### Step 8.4: Add RejectModal tests

- [ ] Test modal renders with action description
- [ ] Test reason input required
- [ ] Test cancel closes modal
- [ ] Test submit calls onReject with reason

**Files to create:**
- `frontend/src/components/RejectModal.test.tsx`

#### Step 8.5: Update Dashboard tests

- [ ] Test pending actions panel renders when actions exist
- [ ] Test approve removes action from list
- [ ] Test reject shows modal

**Files to modify:**
- `frontend/src/pages/Dashboard.test.tsx`

---

### Phase 9: Validation

**Goal:** Verify all acceptance criteria are met

#### Step 9.1: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Panel visible when pending actions exist | Pending |
| AC2 | Panel hidden when no pending actions | Pending |
| AC3 | Action details (server, type, service, time) | Pending |
| AC4 | Approve button approves and removes | Pending |
| AC5 | Reject shows modal, requires reason | Pending |
| AC6 | Maintenance mode badge visible | Pending |

#### Step 9.2: Run Tests

```bash
cd frontend && npm run test
```

#### Step 9.3: Manual Testing

- [ ] Start backend and frontend
- [ ] Create a paused server (PUT /api/v1/servers/{id}/pause)
- [ ] Create a pending action on paused server (POST /api/v1/actions)
- [ ] Verify panel appears on dashboard
- [ ] Verify action card shows server name, maintenance badge, action type, time
- [ ] Click Approve - verify action removed
- [ ] Create another pending action
- [ ] Click Reject - verify modal appears
- [ ] Enter reason and submit - verify action removed
- [ ] Verify panel disappears when no pending actions

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Approve fails (network) | Show error toast, refetch to restore list |
| Reject fails (network) | Show error toast, keep modal open |
| Action approved elsewhere | Removed on next poll |
| Many actions (>5) | Scrollable list with "+N more" indicator |
| Empty reason | Submit button disabled |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Type mismatch with backend | Low | Types derived from backend schema |
| Stale UI after approval/rejection | Low | Optimistic update + polling |
| Modal doesn't close on success | Low | Explicit setRejectingAction(null) |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0024: Action Queue API | Story | Complete - GET/POST /api/v1/actions |
| US0026: Maintenance Mode Approval | Story | Complete - approve/reject endpoints |
| US0029: Server Maintenance Mode | Story | Complete - is_paused field |
| AlertBanner component | Pattern | Reference for panel structure |

## Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Should actions link to server detail? | Darren | Open |
| Should panel auto-refresh faster than 30s? | Darren | Open |

## Definition of Done Checklist

- [ ] Action types defined in frontend
- [ ] API client has getActions/approveAction/rejectAction functions
- [ ] PendingActionsPanel component created
- [ ] PendingActionCard component created
- [ ] RejectModal component created
- [ ] Dashboard integration complete
- [ ] Unit tests for all new components
- [ ] Manual testing completed
- [ ] No TypeScript errors
- [ ] No ESLint errors

## Notes

This is a 3-point story with frontend-only scope. The backend work (US0024, US0026) is already complete. The main complexity is the reject modal with reason input and optimistic UI updates.

Key UX decisions:
1. Panel uses orange/warning colour for Clock icon (pending = waiting)
2. Maintenance Mode badge on each action explains why approval needed
3. Approve is green (positive action), Reject is red (negative action)
4. Modal required for rejection to capture reason
5. Optimistic updates for approve (instant feedback)
