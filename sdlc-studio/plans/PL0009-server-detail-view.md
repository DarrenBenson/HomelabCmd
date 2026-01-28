# PL0009: Server Detail View - Implementation Plan

> **Status:** Complete
> **Story:** [US0006: Server Detail View](../stories/US0006-server-detail-view.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** TypeScript

## Overview

Implement a server detail page that displays comprehensive information about a single server, including current metrics with visual gauges, OS information, and network/load statistics. This requires adding React Router for navigation, creating a reusable Gauge component, extending TypeScript types, and building the detail page with brand-compliant styling.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Detail view displays server info | Server name, hostname, IP address, and status are displayed |
| AC2 | Detail view shows OS information | OS distribution, version, kernel, and architecture displayed |
| AC3 | Detail view shows current metrics | All metrics: CPU%, RAM, Disk, Network I/O, Load averages, Uptime |
| AC4 | Detail view shows metric gauges | Visual gauges with percentage and threshold-based colours |
| AC5 | Back navigation works | Back button returns to dashboard |
| AC6 | Brand guide compliance | Colours, typography, gauges match brand guide |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript
- **Framework:** React 19, Vite
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices

- Strict TypeScript with no `any` types
- Component tests using React Testing Library
- Accessibility: ARIA labels, roles, keyboard support
- Tailwind CSS with `cn()` helper for conditional classes
- Custom brand colour tokens defined in index.css

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| react-router-dom | /remix-run/react-router | useParams, useNavigate, Routes setup | TBD during implementation |
| Recharts | /recharts/recharts | SVG gauge/radial chart | TBD (may use custom SVG instead) |

### Existing Patterns

**Components to reference:**
- `ServerCard.tsx` - Card layout, metrics display, click handling
- `StatusLED.tsx` - Status indication, accessibility patterns
- `Dashboard.tsx` - Loading/error states, polling, grid layout

**API patterns:**
- `api/client.ts` - Generic fetch wrapper with error handling
- `api/servers.ts` - Endpoint wrappers returning typed responses

**Styling patterns:**
- Brand colours: `text-status-success`, `text-status-warning`, `text-status-error`
- Cards: `bg-bg-secondary`, `border-border-default`, rounded corners
- Fonts: `font-mono` for values, `font-sans` for labels

## Recommended Approach

**Strategy:** Test-After (with component-first for Gauge)
**Rationale:** The Gauge component benefits from visual iteration before testing. ServerDetail follows existing Dashboard patterns closely. API functions are simple wrappers.

### Test Priority

1. Gauge threshold colour changes (critical for UX)
2. formatBytes and formatUptime edge cases
3. ServerDetail loading/error/404 states
4. Back navigation functionality

### Documentation Updates Required

- [ ] None required for this story

## Implementation Steps

### Phase 1: Foundation (Types + Router + API)

**Goal:** Establish the infrastructure for the detail page

#### Step 1.1: Extend TypeScript Types

- [ ] Add `OSInfo` interface with distribution, version, kernel, architecture
- [ ] Add `FullMetrics` interface with all metrics fields
- [ ] Add `ServerDetail` interface extending Server with full data
- [ ] Keep existing `Server` interface for list view compatibility

**Files to modify:**
- `frontend/src/types/server.ts` - Add new interfaces

**Type definitions:**
```typescript
interface OSInfo {
  distribution: string | null;
  version: string | null;
  kernel: string | null;
  architecture: string | null;
}

interface FullMetrics {
  cpu_percent: number | null;
  memory_percent: number | null;
  memory_total_mb: number | null;
  memory_used_mb: number | null;
  disk_percent: number | null;
  disk_total_gb: number | null;
  disk_used_gb: number | null;
  network_rx_bytes: number | null;
  network_tx_bytes: number | null;
  load_1m: number | null;
  load_5m: number | null;
  load_15m: number | null;
  uptime_seconds: number | null;
}

interface ServerDetail {
  id: string;
  hostname: string;
  display_name: string | null;
  ip_address: string | null;
  status: ServerStatus;
  last_seen: string | null;
  os_info: OSInfo | null;
  latest_metrics: FullMetrics | null;
  tdp_watts: number | null;
  created_at: string;
  updated_at: string;
}
```

#### Step 1.2: Install and Configure React Router

- [ ] Install react-router-dom package
- [ ] Create router configuration in App.tsx
- [ ] Define routes: "/" for Dashboard, "/servers/:id" for ServerDetail

**Files to modify:**
- `frontend/package.json` - Add dependency
- `frontend/src/App.tsx` - Add BrowserRouter, Routes, Route

**Considerations:**
- React Router v6+ for React 19 compatibility
- Use createBrowserRouter or BrowserRouter wrapper

#### Step 1.3: Create API Function for Single Server

- [ ] Add `getServer(id: string)` function
- [ ] Return `ServerDetail` type
- [ ] Handle 404 errors

**Files to modify:**
- `frontend/src/api/servers.ts` - Add getServer function

### Phase 2: Components

**Goal:** Build the Gauge component and ServerDetail page

#### Step 2.1: Create Utility Formatters

- [ ] Create `formatBytes(bytes: number | null)` function
- [ ] Create `formatUptime(seconds: number | null)` function
- [ ] Handle null/undefined gracefully

**Files to create:**
- `frontend/src/lib/formatters.ts` - Utility functions

**Format specifications:**
- Bytes: Auto-scale to KB/MB/GB/TB with 2 decimal places
- Uptime: "Xd Yh Zm" format, handle >1 year as "Xy Xd"

#### Step 2.2: Create Gauge Component

- [ ] Create circular arc gauge using SVG
- [ ] Implement threshold-based colouring (0-70% green, 70-85% amber, 85-100% red)
- [ ] Display percentage in centre with JetBrains Mono font
- [ ] Support optional absolute value display below percentage
- [ ] Add accessibility attributes (aria-label, role="meter")

**Files to create:**
- `frontend/src/components/Gauge.tsx` - Gauge component

**Props interface:**
```typescript
interface GaugeProps {
  value: number | null;       // 0-100 percentage
  label: string;              // e.g., "CPU", "RAM", "Disk"
  size?: number;              // default 120px
  absoluteValue?: string;     // e.g., "11/16 GB"
  className?: string;
}
```

**Colour thresholds (from brand guide):**
- 0-70%: Phosphor Green (#4ADE80) - `text-status-success`
- 70-85%: Amber Alert (#FBBF24) - `text-status-warning`
- 85-100%: Red Alert (#F87171) - `text-status-error`

#### Step 2.3: Create ServerDetail Page

- [ ] Create page component with useParams for server ID
- [ ] Implement data fetching with useEffect
- [ ] Add loading spinner state
- [ ] Add error state with retry button
- [ ] Add 404 state for server not found
- [ ] Build layout with info cards
- [ ] Add 30-second auto-refresh
- [ ] Implement back button with useNavigate

**Files to create:**
- `frontend/src/pages/ServerDetail.tsx` - Detail page component

**Layout sections:**
1. Header: Back button, server name/display_name, refresh button
2. Server Information card: Status LED, hostname, IP, last seen
3. System card: OS distribution, version, kernel, architecture, uptime
4. Resource Utilisation card: 3 Gauge components (CPU, RAM, Disk)
5. Load Average card: 1m, 5m, 15m values
6. Network I/O card: Received/Sent bytes formatted

#### Step 2.4: Connect Dashboard Navigation

- [ ] Import useNavigate in Dashboard
- [ ] Update ServerCard onClick to navigate to /servers/{id}
- [ ] Remove console.log placeholder

**Files to modify:**
- `frontend/src/pages/Dashboard.tsx` - Add navigation

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 3.1: Unit Tests - Formatters

- [ ] Test formatBytes with various magnitudes (bytes, KB, MB, GB, TB)
- [ ] Test formatBytes with null input
- [ ] Test formatUptime with various durations
- [ ] Test formatUptime edge cases (0, very large, null)

**Files to create:**
- `frontend/src/lib/formatters.test.ts`

#### Step 3.2: Unit Tests - Gauge Component

- [ ] Test rendering with valid value
- [ ] Test threshold colour at 50% (green)
- [ ] Test threshold colour at 75% (amber)
- [ ] Test threshold colour at 90% (red)
- [ ] Test null value handling
- [ ] Test accessibility attributes

**Files to create:**
- `frontend/src/components/Gauge.test.tsx`

#### Step 3.3: Unit Tests - ServerDetail Page

- [ ] Test loading state displays spinner
- [ ] Test error state displays message and retry button
- [ ] Test 404 state displays not found message
- [ ] Test successful data display
- [ ] Test back button calls navigate
- [ ] Test refresh button refetches data

**Files to create:**
- `frontend/src/pages/ServerDetail.test.tsx`

#### Step 3.4: API Tests

- [ ] Test getServer returns ServerDetail
- [ ] Test getServer handles 404

**Files to modify:**
- `frontend/src/api/servers.test.ts` - Add getServer tests

#### Step 3.5: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Unit test + manual: server name, hostname, IP, status displayed | Pending |
| AC2 | Unit test + manual: OS info displayed | Pending |
| AC3 | Unit test + manual: all metrics displayed | Pending |
| AC4 | Unit test: gauge thresholds; manual: visual appearance | Pending |
| AC5 | Unit test: navigate called; manual: navigation works | Pending |
| AC6 | Manual: visual inspection against brand guide | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Server not found (404) | Display "Server not found" message with back button |
| Server has no metrics | Display "Awaiting metrics" placeholder in gauge areas |
| Server offline | Display last known metrics with "Offline since X" warning |
| API request fails | Show error message with retry button |
| Very long uptime (>1 year) | Format as "Xy Xd" |
| Network bytes very large | Auto-scale to appropriate unit (GB, TB) |
| Null metric values | Display "--" or "N/A" placeholder |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| react-router-dom React 19 compatibility | High | Check compatibility before installing; use latest v6.x |
| SVG gauge rendering complexity | Medium | Keep simple arc design; test across browsers |
| Polling causing memory leaks | Medium | Follow Dashboard cleanup pattern with ignore flag |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| react-router-dom | npm package | Must be installed |
| US0002: Server Registration API | Story | Done - API exists |
| US0005: Dashboard Server List | Story | Done - Pattern reference |

## Open Questions

None - all requirements are clear from the story.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices (strict TS, no any)
- [ ] No linting errors (eslint, tsc)
- [ ] Gauge component is reusable with configurable thresholds
- [ ] All values use JetBrains Mono font
- [ ] Status LED matches dashboard card
- [ ] Ready for code review

## Notes

**Files Summary:**

| Action | File |
|--------|------|
| Create | `frontend/src/types/server.ts` (extend) |
| Create | `frontend/src/lib/formatters.ts` |
| Create | `frontend/src/lib/formatters.test.ts` |
| Create | `frontend/src/components/Gauge.tsx` |
| Create | `frontend/src/components/Gauge.test.tsx` |
| Create | `frontend/src/pages/ServerDetail.tsx` |
| Create | `frontend/src/pages/ServerDetail.test.tsx` |
| Modify | `frontend/src/App.tsx` (router) |
| Modify | `frontend/src/pages/Dashboard.tsx` (navigation) |
| Modify | `frontend/src/api/servers.ts` (getServer) |
| Modify | `frontend/src/api/servers.test.ts` (tests) |
| Modify | `frontend/package.json` (react-router-dom) |

**Estimated file changes:** 6 new files, 6 modified files
