# PL0024: Service Status Display in Server Detail - Implementation Plan

> **Status:** Complete
> **Story:** [US0020: Service Status Display in Server Detail](../stories/US0020-service-status-display.md)
> **Epic:** [EP0003: Service Monitoring](../epics/EP0003-service-monitoring.md)
> **Created:** 2026-01-19
> **Language:** TypeScript/React

## Overview

Add a services section to the server detail view that displays expected services with their current status, resource usage for running services, and a restart button placeholder for future remediation functionality.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Services section | Services panel displays on server detail page |
| AC2 | Status indicators | Each service shows status with colour coding (green/red/grey) |
| AC3 | Resource display | Running services show PID, memory, CPU usage |
| AC4 | Stopped styling | Stopped services have warning/error styling (red left border) |
| AC5 | Restart button | Restart button visible for stopped services (disabled until EP0004) |
| AC6 | Brand compliance | Colours match brand guide exactly |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **Test Framework:** Vitest

### Relevant Best Practices

From codebase patterns:
- Component composition with props interfaces
- Tailwind CSS with `cn()` utility for conditional classes
- API functions return typed promises
- Data-testid attributes for testing
- JetBrains Mono for data values, Space Grotesk for UI text

### Existing Patterns

From codebase exploration:

1. **API pattern:** `api/servers.ts` - typed async functions using api.get<T>()
2. **Component pattern:** StatusLED, Gauge - small focused components with clear props
3. **Page pattern:** ServerDetail.tsx - useCallback for fetch, useEffect for polling
4. **Card styling:** `rounded-lg border border-border-default bg-bg-secondary p-6`
5. **Status colours:** status-success (#4ADE80), status-error (#F87171), text-muted (#484F58)

Reference files:
- `frontend/src/pages/ServerDetail.tsx` - Target page for integration
- `frontend/src/components/StatusLED.tsx` - Reference for status indicator
- `frontend/src/api/servers.ts` - API function pattern
- `sdlc-studio/brand-guide.md` - Colour specifications

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI component work with established patterns and clear visual requirements. Components follow existing conventions, making test-after straightforward.

### Test Priority

1. ServiceStatusLED renders correct colours for each status
2. ServiceCard displays resource info only when running
3. ServiceCard shows restart button only when stopped
4. ServicesPanel handles empty state
5. ServicesPanel handles loading and error states

### Documentation Updates Required

- [x] None required (no external API changes)

## Implementation Steps

### Phase 1: Types and API

**Goal:** Define TypeScript types and API function for services

#### Step 1.1: Create service types

- [x] Create `frontend/src/types/service.ts`
- [x] Define ServiceCurrentStatus interface
- [x] Define ExpectedService interface
- [x] Define ServicesResponse interface

**Files to create:**
- `frontend/src/types/service.ts` - Type definitions

**Type structure:**

```typescript
export type ServiceStatus = 'running' | 'stopped' | 'failed' | 'unknown';

export interface ServiceCurrentStatus {
  status: ServiceStatus;
  pid: number | null;
  memory_mb: number | null;
  cpu_percent: number | null;
  last_seen: string;
}

export interface ExpectedService {
  service_name: string;
  display_name: string | null;
  is_critical: boolean;
  enabled: boolean;
  current_status: ServiceCurrentStatus | null;
}

export interface ServicesResponse {
  services: ExpectedService[];
  total: number;
}
```

#### Step 1.2: Create API function

- [x] Create `frontend/src/api/services.ts`
- [x] Add getServerServices function

**Files to create:**
- `frontend/src/api/services.ts` - API function

### Phase 2: UI Components

**Goal:** Create reusable components for service display

#### Step 2.1: Create ServiceStatusLED component

- [x] Create `frontend/src/components/ServiceStatusLED.tsx`
- [x] Support statuses: running, stopped, failed, unknown
- [x] Use brand guide colours exactly
- [x] Add aria-label for accessibility

**Files to create:**
- `frontend/src/components/ServiceStatusLED.tsx`

**Colour mapping:**
- running: status-success (#4ADE80) with pulse animation
- stopped: status-error (#F87171) with glow
- failed: status-error (#F87171) with glow
- unknown: text-muted (#484F58)

#### Step 2.2: Create ServiceCard component

- [x] Create `frontend/src/components/ServiceCard.tsx`
- [x] Display service name (display_name or service_name)
- [x] Show ServiceStatusLED indicator
- [x] Display CRITICAL badge if is_critical
- [x] Show resources (PID, RAM, CPU) only when running
- [x] Add red left border when stopped/failed
- [x] Include restart button (disabled) for non-running services

**Files to create:**
- `frontend/src/components/ServiceCard.tsx`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ ● Service Name              [CRITICAL]        [↻ Restart]  │
│   Status: Running   PID: 12345   RAM: 512 MB   CPU: 2%    │
└────────────────────────────────────────────────────────────┘
```

**Styling details:**
- Card: `rounded-lg border border-border-default bg-bg-secondary p-4`
- Stopped: add `border-l-4 border-l-status-error`
- CRITICAL badge: `bg-status-error text-bg-primary text-xs font-mono px-2 py-0.5 rounded`
- Resource values: `font-mono text-sm text-text-secondary`

#### Step 2.3: Create ServicesPanel component

- [x] Create `frontend/src/components/ServicesPanel.tsx`
- [x] Fetch services on mount
- [x] Handle loading state
- [x] Handle error state
- [x] Handle empty state ("No services configured")
- [x] Render list of ServiceCard components
- [x] Align polling with parent (30s interval)

**Files to create:**
- `frontend/src/components/ServicesPanel.tsx`

**Empty state:**
```
┌───────────────────────────────────────────────────────────────────┐
│ Services                                                           │
│                                                                    │
│   No services configured for this server.                          │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

### Phase 3: Integration

**Goal:** Add ServicesPanel to ServerDetail page

#### Step 3.1: Update ServerDetail page

- [x] Import ServicesPanel component
- [x] Add ServicesPanel after Resource Utilisation section
- [x] Pass serverId prop

**Files to modify:**
- `frontend/src/pages/ServerDetail.tsx`

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Create component tests

- [x] Create `frontend/src/components/ServiceStatusLED.test.tsx`
- [x] Create `frontend/src/components/ServiceCard.test.tsx`
- [x] Create `frontend/src/components/ServicesPanel.test.tsx`

**Files to create:**
- `frontend/src/components/ServiceStatusLED.test.tsx`
- `frontend/src/components/ServiceCard.test.tsx`
- `frontend/src/components/ServicesPanel.test.tsx`

**Test cases:**
- ServiceStatusLED: renders correct colour for each status
- ServiceCard: displays name and status
- ServiceCard: shows resources only when running
- ServiceCard: shows CRITICAL badge when is_critical
- ServiceCard: shows restart button only when stopped/failed
- ServiceCard: has red border when stopped/failed
- ServicesPanel: shows loading state
- ServicesPanel: shows empty state when no services
- ServicesPanel: renders service cards

#### Step 4.2: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | ServicesPanel renders in ServerDetail | Done |
| AC2 | ServiceStatusLED shows correct colours | Done |
| AC3 | ServiceCard shows resources when running | Done |
| AC4 | ServiceCard has red border when stopped | Done |
| AC5 | ServiceCard shows disabled restart button | Done |
| AC6 | Colours match brand guide CSS variables | Done |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| No services configured | Show "No services configured" message |
| Service status unknown | Grey indicator, "Unknown" status text |
| Service disabled | Dimmed styling (opacity-50) |
| Many services (>10) | Scrollable list within panel |
| API error | Show error message, keep polling |
| current_status is null | Treat as unknown status |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| No data to display | Low | Ensure agents are configured to report services |
| Performance with many services | Low | Services are pre-filtered by server |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0006: Server Detail View | Story | Done |
| US0019: Expected Services API | Story | Done |

## Open Questions

None - all requirements clear from story.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing
- [x] Edge cases handled
- [x] Code follows existing patterns
- [x] Brand guide colours used correctly
- [x] Ready for code review

## Notes

- Restart button is a placeholder - actual functionality comes in EP0004
- ServicesPanel is self-contained and manages its own data fetching
- Colours must use CSS variables (status-success, status-error, etc.)
- JetBrains Mono for all data values (PID, RAM, CPU)
