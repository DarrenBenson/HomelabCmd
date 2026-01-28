# PL0018: Dashboard Alert Display - Implementation Plan

> **Status:** Complete
> **Story:** [US0015: Dashboard Alert Display](../stories/US0015-dashboard-alerts.md)
> **Epic:** [EP0002: Alerting & Notifications](../epics/EP0002-alerting.md)
> **Created:** 2026-01-19
> **Language:** TypeScript

## Overview

Add an alert section to the Dashboard page that displays active alerts prominently above the server grid. The section includes an alert banner showing the count of active alerts, individual alert cards with severity-based styling, acknowledge buttons, and an empty state when no alerts exist.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Alert banner count | Banner shows "X Active Alerts" count |
| AC2 | Critical styling | Critical alerts displayed with red styling at top |
| AC3 | Alert card info | Card shows server name, type, severity, time |
| AC4 | Acknowledge action | Acknowledge button updates status without reload |
| AC5 | Empty state | Shows "All Systems Operational" when no alerts |
| AC6 | Brand compliance | Colours match brand guide (red critical, amber high) |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript 5.9.3
- **Framework:** React 19.2.0 + Vite 7.2.4
- **Test Framework:** Vitest + @testing-library/react

### Relevant Best Practices

- Use existing API pattern (`api.get`, `api.post`) from `client.ts`
- Follow component patterns from existing `ServerCard.tsx`
- Use `formatRelativeTime` from `lib/formatters.ts` for time display
- Use CSS custom properties from `index.css` for brand colours
- Include `data-testid` attributes for testing
- Support keyboard navigation (accessible buttons)

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| React | /websites/react_dev | useState, useEffect, optimistic updates | State + side effects |
| Lucide React | N/A | Icons for alerts | AlertTriangle, Check, CheckCircle |

### Existing Patterns

**From Dashboard.tsx - Data fetching with polling:**
```typescript
const [servers, setServers] = useState<Server[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let ignore = false;
  async function fetchData() {
    try {
      const data = await getServers();
      if (!ignore) {
        setServers(data.servers);
        setError(null);
      }
    } catch (err) { /* ... */ }
  }
  fetchData();
  const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
  return () => { ignore = true; clearInterval(intervalId); };
}, []);
```

**From api/client.ts - API calls:**
```typescript
export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) => fetchApi<T>(endpoint, {...}),
};
```

**From ServerCard.tsx - Card component pattern:**
```typescript
export function ServerCard({ server, onClick }: ServerCardProps) {
  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg p-4 ...">
      {/* Content */}
    </div>
  );
}
```

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Frontend component development benefits from visual feedback during implementation. Tests verify the component behaviour after the visual/interactive aspects are working.

### Test Priority

1. Alert banner shows correct count
2. Alert cards display required info (server name, severity, time)
3. Acknowledge button calls API and updates UI
4. Empty state renders when no alerts
5. Severity-based sorting (critical first)

### Documentation Updates Required

- [ ] None (OpenAPI auto-updated, component is internal)

## Implementation Steps

### Phase 1: Create Alert Types and API Functions

**Goal:** Define TypeScript interfaces and API calls for alerts.

#### Step 1.1: Create alert types

- [ ] Create `frontend/src/types/alert.ts`
- [ ] Define `AlertStatus` type ('open', 'acknowledged', 'resolved')
- [ ] Define `AlertSeverity` type ('critical', 'high', 'medium', 'low')
- [ ] Define `Alert` interface matching API response
- [ ] Define `AlertsResponse` interface with pagination

**Files to create:**
- `frontend/src/types/alert.ts` - Alert type definitions

**Type definitions:**
```typescript
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Alert {
  id: number;
  server_id: string;
  server_name: string | null;
  alert_type: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string | null;
  threshold_value: number | null;
  actual_value: number | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  auto_resolved: boolean;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  limit: number;
  offset: number;
}

export interface AlertAcknowledgeResponse {
  id: number;
  status: AlertStatus;
  acknowledged_at: string;
}
```

#### Step 1.2: Create alerts API module

- [ ] Create `frontend/src/api/alerts.ts`
- [ ] Implement `getAlerts(status?: string)` function
- [ ] Implement `acknowledgeAlert(id: number)` function

**Files to create:**
- `frontend/src/api/alerts.ts` - Alert API functions

**API functions:**
```typescript
import { api } from './client';
import type { AlertsResponse, AlertAcknowledgeResponse } from '../types/alert';

export async function getAlerts(status?: string): Promise<AlertsResponse> {
  const params = status ? `?status=${status}` : '';
  return api.get<AlertsResponse>(`/api/v1/alerts${params}`);
}

export async function acknowledgeAlert(alertId: number): Promise<AlertAcknowledgeResponse> {
  return api.post<AlertAcknowledgeResponse>(`/api/v1/alerts/${alertId}/acknowledge`, {});
}
```

### Phase 2: Create Alert Components

**Goal:** Build reusable alert UI components.

#### Step 2.1: Create AlertCard component

- [ ] Create `frontend/src/components/AlertCard.tsx`
- [ ] Display severity badge with brand colours
- [ ] Display server name, alert title, relative time
- [ ] Include acknowledge button (disabled if already acknowledged)
- [ ] Use left border colour based on severity
- [ ] Add keyboard accessibility

**Files to create:**
- `frontend/src/components/AlertCard.tsx` - Individual alert card

**Component structure:**
```typescript
interface AlertCardProps {
  alert: Alert;
  onAcknowledge: (alertId: number) => void;
  isAcknowledging?: boolean;
}

export function AlertCard({ alert, onAcknowledge, isAcknowledging }: AlertCardProps)
```

**Colour mapping (from brand guide):**
- Critical: `#F87171` (Red Alert)
- High: `#FBBF24` (Amber Alert)
- Medium: `#22D3EE` (Terminal Cyan)
- Low: `#C9D1D9` (Soft White)

#### Step 2.2: Create AlertBanner component

- [ ] Create `frontend/src/components/AlertBanner.tsx`
- [ ] Show alert count with icon
- [ ] Include "View All" link (for future US0016)
- [ ] Show empty state when no alerts
- [ ] Display list of AlertCard components (max 5)

**Files to create:**
- `frontend/src/components/AlertBanner.tsx` - Alert section container

**Component structure:**
```typescript
interface AlertBannerProps {
  alerts: Alert[];
  onAcknowledge: (alertId: number) => void;
  acknowledgingIds: Set<number>;
  maxDisplay?: number; // Default 5
}

export function AlertBanner({ alerts, onAcknowledge, acknowledgingIds, maxDisplay = 5 }: AlertBannerProps)
```

### Phase 3: Integrate with Dashboard

**Goal:** Add alert section to Dashboard page.

#### Step 3.1: Update Dashboard state and data fetching

- [ ] Add `alerts` state to Dashboard
- [ ] Add `acknowledgingIds` state (Set for optimistic UI)
- [ ] Fetch alerts alongside servers in useEffect
- [ ] Add `handleAcknowledge` function with optimistic update
- [ ] Sort alerts by severity (critical first) then by created_at

**Files to modify:**
- `frontend/src/pages/Dashboard.tsx` - Add alert state and fetching

**State additions:**
```typescript
const [alerts, setAlerts] = useState<Alert[]>([]);
const [acknowledgingIds, setAcknowledgingIds] = useState<Set<number>>(new Set());
```

#### Step 3.2: Render AlertBanner in Dashboard

- [ ] Import AlertBanner component
- [ ] Render AlertBanner after header, before server grid
- [ ] Pass alerts (filtered to open/acknowledged only)
- [ ] Pass acknowledge handler

**Considerations:**
- Only show alerts with status 'open' on dashboard
- Sort: critical > high > medium > low, then newest first
- Limit to 5 alerts, show "View all X alerts" link if more

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met.

#### Step 4.1: Component Tests

- [ ] Create `frontend/src/components/AlertCard.test.tsx`
- [ ] Test renders alert info correctly
- [ ] Test severity badge colours
- [ ] Test acknowledge button click
- [ ] Test acknowledged state (button disabled)
- [ ] Test keyboard accessibility

- [ ] Create `frontend/src/components/AlertBanner.test.tsx`
- [ ] Test shows correct alert count
- [ ] Test empty state renders
- [ ] Test max 5 alerts displayed
- [ ] Test "View all" link appears when > 5 alerts

**Files to create:**
- `frontend/src/components/AlertCard.test.tsx`
- `frontend/src/components/AlertBanner.test.tsx`

#### Step 4.2: Dashboard Integration Tests

- [ ] Update `frontend/src/pages/Dashboard.test.tsx`
- [ ] Test alerts section renders with alerts
- [ ] Test empty state shows "All Systems Operational"
- [ ] Test acknowledge updates UI optimistically

#### Step 4.3: API Tests

- [ ] Create `frontend/src/api/alerts.test.ts`
- [ ] Test getAlerts function
- [ ] Test acknowledgeAlert function

**Files to create:**
- `frontend/src/api/alerts.test.ts`

#### Step 4.4: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | AlertBanner shows "X Active Alerts" | Done |
| AC2 | Critical alerts have red styling and sort first | Done |
| AC3 | AlertCard shows server name, type, severity, time | Done |
| AC4 | Acknowledge button updates without reload | Done |
| AC5 | Empty state shows "All Systems Operational" | Done |
| AC6 | Colours match brand guide | Done |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Many alerts (>5) | Show 5 + "View all X alerts" link |
| Alert acknowledged while viewing | Update UI optimistically, rollback on error |
| Acknowledge API fails | Show error toast, revert optimistic update |
| API error fetching alerts | Show cached data with warning (like servers) |
| Alert auto-resolves while viewing | Remove from list on next poll refresh |
| No server_name in alert | Fall back to server_id |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API latency on acknowledge | Poor UX | Optimistic update with rollback |
| Stale alert data | Confusion | Poll every 30s with servers |
| Large number of alerts | Performance | Limit to 5, paginate in full list |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0014: Alert API | Story | Done - API endpoints exist |
| US0005: Dashboard Server List | Story | Done - Dashboard page exists |
| Brand guide colours | Document | Defined in sdlc-studio/brand-guide.md |

## Open Questions

None - all requirements are clear from story and existing patterns.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Component tests written and passing
- [x] Integration tests updated
- [x] Edge cases handled
- [x] Code follows existing patterns
- [x] No linting errors
- [ ] Visual verification in browser
- [x] Alert colours match brand guide

## Notes

- Alerts are fetched with `?status=open` to only show active alerts
- Maximum 5 alerts on dashboard; full list in US0016 (Alert List View)
- Use existing 30-second polling interval from Dashboard
- Lucide icons: `AlertTriangle` for banner, `Check` for acknowledge button, `CheckCircle` for empty state
- Brand colours are already defined as CSS variables in index.css
