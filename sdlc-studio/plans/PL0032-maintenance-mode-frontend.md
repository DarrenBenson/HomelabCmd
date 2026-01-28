# PL0032: Maintenance Mode Frontend - Implementation Plan

> **Status:** Complete
> **Story:** [US0029: Server Maintenance Mode](../stories/US0029-server-maintenance-mode.md)
> **Epic:** [EP0004: Remediation Engine](../epics/EP0004-remediation.md)
> **Created:** 2026-01-19
> **Language:** TypeScript (React)

## Overview

Implement the frontend components for server maintenance mode. This plan covers AC4 (maintenance mode indicator on dashboard) and AC5 (maintenance mode display and toggle in server detail). The backend API (AC1-AC3) is already complete.

## Acceptance Criteria Summary

| AC | Name | Description | Backend |
|----|------|-------------|---------|
| AC4 | Maintenance mode visible in UI | Dashboard shows maintenance indicator for paused servers | N/A |
| AC5 | Server detail shows mode | Server detail displays mode with toggle option | N/A |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript 5.x
- **Framework:** React 18 with Vite
- **Test Framework:** Vitest with React Testing Library
- **Styling:** Tailwind CSS

### Relevant Best Practices

- Use existing UI patterns (StatusLED component, card layouts)
- Maintain consistent test patterns from existing test files
- Follow Tailwind utility class conventions
- Use optimistic updates for toggle actions

### Existing Patterns

From `frontend/src/components/ServerCard.tsx`:
- Status indicator via `StatusLED` component
- Footer section for secondary info (uptime, updates)
- Conditional rendering based on server properties

From `frontend/src/pages/ServerDetail.tsx`:
- Server Information card with status display
- Polling pattern with `useCallback` and `useEffect`
- Error handling with retry capability

From `frontend/src/api/servers.ts`:
- Simple async functions wrapping `api.get()`
- Type-safe responses with TypeScript interfaces

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI changes are straightforward additions to existing components. Write implementation first, then add targeted tests for the new functionality.

### Test Priority

1. ServerCard: Maintenance badge visibility when `is_paused=true`
2. ServerDetail: Maintenance mode display and toggle
3. API: pauseServer/unpauseServer functions

## Implementation Steps

### Phase 1: Type Definitions

**Goal:** Add `is_paused` and `paused_at` fields to frontend types

#### Step 1.1: Update Server types

- [ ] Add `is_paused: boolean` to `Server` interface
- [ ] Add `is_paused: boolean` and `paused_at: string | null` to `ServerDetail` interface

**Files to modify:**
- `frontend/src/types/server.ts`

**Implementation:**
```typescript
// In Server interface (line ~30)
export interface Server {
  id: string;
  hostname: string;
  display_name: string | null;
  status: ServerStatus;
  is_paused: boolean;  // Add this
  updates_available: number | null;
  security_updates: number | null;
  latest_metrics: LatestMetrics | null;
}

// In ServerDetail interface (line ~47)
export interface ServerDetail {
  // ... existing fields ...
  is_paused: boolean;           // Add this
  paused_at: string | null;     // Add this
  // ... rest of fields ...
}
```

---

### Phase 2: API Client Extensions

**Goal:** Add pauseServer and unpauseServer functions

#### Step 2.1: Add pause/unpause API functions

- [ ] Add `pauseServer(serverId: string): Promise<ServerDetail>` function
- [ ] Add `unpauseServer(serverId: string): Promise<ServerDetail>` function

**Files to modify:**
- `frontend/src/api/servers.ts`

**Implementation:**
```typescript
export async function pauseServer(serverId: string): Promise<ServerDetail> {
  return api.put<ServerDetail>(`/api/v1/servers/${serverId}/pause`);
}

export async function unpauseServer(serverId: string): Promise<ServerDetail> {
  return api.put<ServerDetail>(`/api/v1/servers/${serverId}/unpause`);
}
```

---

### Phase 3: ServerCard Maintenance Indicator (AC4)

**Goal:** Show maintenance mode badge on dashboard server cards

#### Step 3.1: Add maintenance badge to ServerCard

- [ ] Add maintenance badge in card header (next to server name)
- [ ] Use orange/warning colour to indicate maintenance state
- [ ] Badge only visible when `is_paused=true`

**Files to modify:**
- `frontend/src/components/ServerCard.tsx`

**Implementation:**
```tsx
{/* Header */}
<div className="flex items-center gap-2 mb-3">
  <StatusLED status={server.status} />
  <h3
    className="font-sans font-semibold text-text-primary truncate"
    data-testid="server-hostname"
  >
    {server.display_name || server.hostname}
  </h3>
  {/* Maintenance mode badge */}
  {server.is_paused && (
    <span
      className="ml-auto flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded bg-status-warning/20 text-status-warning"
      data-testid="maintenance-badge"
      title="Server is in maintenance mode"
    >
      Maintenance
    </span>
  )}
</div>
```

---

### Phase 4: ServerDetail Maintenance Display (AC5)

**Goal:** Display maintenance mode status and toggle in server detail

#### Step 4.1: Add maintenance mode to Server Information card

- [ ] Show "Maintenance Mode" row with current status
- [ ] Add toggle button to enable/disable
- [ ] Show paused_at timestamp when paused

**Files to modify:**
- `frontend/src/pages/ServerDetail.tsx`

**Implementation:**
```tsx
// Add to imports
import { pauseServer, unpauseServer } from '../api/servers';

// Add state for toggle loading
const [pauseLoading, setPauseLoading] = useState(false);

// Add toggle handler
const handleToggleMaintenance = async () => {
  if (!server || !serverId) return;

  setPauseLoading(true);
  try {
    const updated = server.is_paused
      ? await unpauseServer(serverId)
      : await pauseServer(serverId);
    setServer(updated);
  } catch (err) {
    // Optionally show error toast
    console.error('Failed to toggle maintenance mode:', err);
  } finally {
    setPauseLoading(false);
  }
};

// In Server Information card, add after status row:
<div className="flex justify-between items-center">
  <span className="text-text-secondary">Maintenance Mode</span>
  <div className="flex items-center gap-3">
    <span
      className={server.is_paused ? 'text-status-warning' : 'text-text-primary'}
      data-testid="maintenance-status"
    >
      {server.is_paused ? 'Enabled' : 'Disabled'}
    </span>
    <button
      onClick={handleToggleMaintenance}
      disabled={pauseLoading}
      className={cn(
        'px-3 py-1 text-xs font-medium rounded transition-colors',
        server.is_paused
          ? 'bg-status-success/20 text-status-success hover:bg-status-success/30'
          : 'bg-status-warning/20 text-status-warning hover:bg-status-warning/30',
        pauseLoading && 'opacity-50 cursor-not-allowed'
      )}
      data-testid="maintenance-toggle"
    >
      {pauseLoading ? '...' : server.is_paused ? 'Disable' : 'Enable'}
    </button>
  </div>
</div>

{/* Show paused_at timestamp when paused */}
{server.is_paused && server.paused_at && (
  <div className="flex justify-between">
    <span className="text-text-secondary">Paused Since</span>
    <span className="font-mono text-text-primary" data-testid="paused-at">
      {formatRelativeTime(server.paused_at)}
    </span>
  </div>
)}
```

#### Step 4.2: Add cn utility import if needed

- [ ] Ensure `cn` utility is imported for conditional classes

**Files to check:**
- `frontend/src/pages/ServerDetail.tsx` - may need to add import

---

### Phase 5: Testing

**Goal:** Add tests for maintenance mode UI components

#### Step 5.1: Update ServerCard tests

- [ ] Test maintenance badge visible when `is_paused=true`
- [ ] Test maintenance badge hidden when `is_paused=false`

**Files to modify:**
- `frontend/src/components/ServerCard.test.tsx`

**Implementation:**
```typescript
describe('Maintenance mode badge (US0029 AC4)', () => {
  it('displays maintenance badge when server is paused', () => {
    const pausedServer: Server = {
      ...mockServer,
      is_paused: true,
    };
    render(<ServerCard server={pausedServer} />);

    const badge = screen.getByTestId('maintenance-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Maintenance');
  });

  it('does not display maintenance badge when server is not paused', () => {
    const normalServer: Server = {
      ...mockServer,
      is_paused: false,
    };
    render(<ServerCard server={normalServer} />);

    expect(screen.queryByTestId('maintenance-badge')).not.toBeInTheDocument();
  });
});
```

#### Step 5.2: Update ServerDetail tests

- [ ] Test maintenance mode display when paused
- [ ] Test maintenance mode display when normal
- [ ] Test toggle button triggers API call

**Files to modify:**
- `frontend/src/pages/ServerDetail.test.tsx`

#### Step 5.3: Add API client tests

- [ ] Test pauseServer makes PUT request
- [ ] Test unpauseServer makes PUT request

**Files to modify:**
- `frontend/src/api/servers.test.ts`

#### Step 5.4: Update mock server objects

- [ ] Add `is_paused: false` to existing mock server objects

**Files to modify:**
- `frontend/src/components/ServerCard.test.tsx`
- `frontend/src/pages/ServerDetail.test.tsx`
- Any other test files using mock Server objects

---

### Phase 6: Validation

**Goal:** Verify all acceptance criteria are met

#### Step 6.1: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC4 | Visual check: maintenance badge on paused server card | Pending |
| AC5 | Visual check: toggle button works in server detail | Pending |

#### Step 6.2: Run Tests

```bash
cd frontend && npm run test
```

#### Step 6.3: Manual Testing

- [ ] Start backend and frontend
- [ ] Create/use a test server
- [ ] Verify ServerCard shows no maintenance badge (default)
- [ ] Navigate to server detail, enable maintenance mode
- [ ] Verify badge appears on dashboard
- [ ] Verify detail page shows "Enabled" and paused timestamp
- [ ] Disable maintenance mode
- [ ] Verify badge disappears

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| API error on toggle | Log error, keep previous state |
| Toggle while loading | Disable button during request |
| Rapid toggle clicks | Debounce via loading state |
| Server goes offline while paused | Badge still visible |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Type mismatch with backend | Low | Types derived from backend schema |
| Stale UI after toggle | Low | Update state from API response |
| Missing is_paused in API response | Medium | Backend already returns field |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0029 AC1-AC3: Backend API | Story | Complete - pause/unpause endpoints exist |
| cn utility | Library | May need import in ServerDetail |

## Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Should maintenance mode be visually prominent on offline servers? | Darren | Open |

## Definition of Done Checklist

- [ ] Types updated with is_paused and paused_at
- [ ] API client has pauseServer/unpauseServer functions
- [ ] ServerCard shows maintenance badge when paused
- [ ] ServerDetail shows maintenance status with toggle
- [ ] Unit tests for new functionality
- [ ] Manual testing completed
- [ ] No TypeScript errors
- [ ] No ESLint errors

## Notes

This is a 2-point story with frontend-only scope. The backend work (AC1-AC3) is already complete with tests in `tests/test_actions_api.py`. This plan covers the remaining frontend acceptance criteria (AC4-AC5).

Key UX decisions:
1. Maintenance badge uses orange/warning colour to stand out without being alarming
2. Toggle button uses green for "Disable" (resume normal) and orange for "Enable" (pause)
3. Paused timestamp shown only when in maintenance mode
