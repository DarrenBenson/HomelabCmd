# PL0046: Scan Results Display - Implementation Plan

> **Status:** Done
> **Story:** [US0039: Scan Results Display](../stories/US0039-scan-results-display.md)
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Created:** 2026-01-21
> **Language:** TypeScript/React

## Overview

Implement a scan results display page that shows the output of completed scans. The page displays system information (OS, hostname, uptime), disk and memory usage with progress bars, and for full scans, additional expandable sections for processes, network interfaces, and packages. The display follows brand guidelines with threshold-based colouring for usage indicators.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Quick scan results displayed | OS, hostname, uptime, disk, and memory are displayed |
| AC2 | Full scan results displayed | Quick scan data plus packages, processes, and network |
| AC3 | Disk usage visualised | Progress bars show usage percentage per mount |
| AC4 | Process list sortable | Processes can be sorted by memory or CPU |
| AC5 | Results persist after navigation | Results available via scan ID after nav away/return |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript
- **Framework:** React 18 with React Router v6
- **Styling:** Tailwind CSS with brand theme
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices

- Functional components with TypeScript interfaces
- useCallback for data fetching to prevent re-renders
- Error/loading/notFound state handling pattern
- Lazy loading for heavy components
- Accessibility: role, aria-labels, data-testid attributes
- Use cn() utility for conditional class merging

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| React | /facebook/react | useEffect cleanup and polling | TBD |
| React Router | /remix-run/react-router | useParams, useNavigate | TBD |
| Tailwind CSS | /tailwindlabs/tailwindcss | progress bar styling | TBD |

### Existing Patterns

**From ServerDetail.tsx:**
- Route params: `useParams<{ scanId: string }>()`
- Navigation: `useNavigate()`
- State groups: data, loading, error, notFound
- Polling with 5-30 second intervals and cleanup
- Grid layouts: `grid gap-6 lg:grid-cols-2`

**From Gauge.tsx:**
- Threshold colouring: Green < 70%, Amber 70-85%, Red > 85%
- SVG-based circular gauges
- Accessible with role="meter"

**From formatters.ts:**
- `formatBytes()` for disk sizes
- `formatUptime()` for uptime display
- `formatPercent()` for percentages

**Backend API Contract (ScanStatusResponse):**
```typescript
{
  scan_id: number
  status: "pending" | "running" | "completed" | "failed"
  hostname: string
  scan_type: "quick" | "full"
  progress: number
  current_step: string | null
  started_at: string | null
  completed_at: string | null
  results: ScanResults | null
  error: string | null
}
```

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI-heavy story with visual components. Design may evolve during implementation. Tests written after visual verification.

### Test Priority

1. Component renders correctly with mock scan data
2. Progress bars display correct values and colours
3. Process list sorting functionality
4. Error and loading states handled correctly
5. Navigation persistence (scan ID in URL)

### Documentation Updates Required

- [ ] None required (internal feature)

## Implementation Steps

### Phase 1: Types and API Client

**Goal:** Define TypeScript types matching backend schemas and create API client functions

#### Step 1.1: Create TypeScript Types

- [ ] Create `frontend/src/types/scan.ts`
- [ ] Define interfaces matching backend Pydantic schemas
- [ ] Export ScanResults, ScanStatusResponse, DiskInfo, etc.

**Files to create:**
- `frontend/src/types/scan.ts` - TypeScript interfaces for scan data

**Type definitions:**
```typescript
interface OSInfo {
  name: string | null
  version: string | null
  kernel: string | null
  pretty_name: string | null
  id: string | null
}

interface DiskInfo {
  mount: string
  total_gb: number
  used_gb: number
  percent: number
}

interface MemoryInfo {
  total_mb: number
  used_mb: number
  percent: number
}

interface ProcessInfo {
  user: string
  pid: number
  cpu_percent: number
  mem_percent: number
  command: string
}

interface NetworkAddress {
  type: string
  address: string
}

interface NetworkInterface {
  name: string
  state: string
  addresses: NetworkAddress[]
}

interface PackageInfo {
  count: number
  recent: string[]
}

interface ScanResults {
  os: OSInfo | null
  hostname: string | null
  uptime_seconds: number | null
  disk: DiskInfo[]
  memory: MemoryInfo | null
  packages: PackageInfo | null
  processes: ProcessInfo[]
  network_interfaces: NetworkInterface[]
  errors: string[] | null
}

interface ScanStatusResponse {
  scan_id: number
  status: "pending" | "running" | "completed" | "failed"
  hostname: string
  scan_type: "quick" | "full"
  progress: number
  current_step: string | null
  started_at: string | null
  completed_at: string | null
  results: ScanResults | null
  error: string | null
}
```

#### Step 1.2: Create API Client Functions

- [ ] Create `frontend/src/api/scans.ts`
- [ ] Add `getScan(scanId: number)` function
- [ ] Use existing fetchApi pattern from client.ts

**Files to create:**
- `frontend/src/api/scans.ts` - API client for scan endpoints

### Phase 2: Core Components

**Goal:** Create the main scan results display components

#### Step 2.1: Create UsageBar Component

- [ ] Create reusable progress bar component
- [ ] Implement threshold-based colouring (green/amber/red)
- [ ] Support label and value display
- [ ] Add aria attributes for accessibility

**Files to create:**
- `frontend/src/components/UsageBar.tsx` - Reusable progress bar

**Thresholds:**
- Green (#4ADE80): < 80%
- Amber (#FBBF24): 80-90%
- Red (#F87171): > 90%

#### Step 2.2: Create ScanSystemInfo Component

- [ ] Display OS info card (hostname, OS, kernel, uptime)
- [ ] Use formatUptime() for uptime display
- [ ] Handle null/missing values gracefully

**Files to create:**
- `frontend/src/components/ScanSystemInfo.tsx` - System information card

#### Step 2.3: Create ScanDiskUsage Component

- [ ] Display disk usage per mount point
- [ ] Use UsageBar for each disk
- [ ] Format sizes with formatBytes()

**Files to create:**
- `frontend/src/components/ScanDiskUsage.tsx` - Disk usage section

#### Step 2.4: Create ScanMemoryUsage Component

- [ ] Display memory usage with UsageBar
- [ ] Show total/used/percent values

**Files to create:**
- `frontend/src/components/ScanMemoryUsage.tsx` - Memory usage section

### Phase 3: Full Scan Components

**Goal:** Create components for full scan data (processes, network, packages)

#### Step 3.1: Create ScanProcessList Component

- [ ] Display process table with columns: PID, Name, Memory, CPU
- [ ] Implement sorting by memory (default) and CPU
- [ ] Limit display to top 50 processes
- [ ] Make section collapsible (default collapsed)

**Files to create:**
- `frontend/src/components/ScanProcessList.tsx` - Process list with sorting

**Sort implementation:**
- useState for sortField ('mem_percent' | 'cpu_percent')
- Sort processes array before rendering
- Click handlers on column headers

#### Step 3.2: Create ScanNetworkInterfaces Component

- [ ] Display network interfaces list
- [ ] Show name, state, and addresses
- [ ] Make section collapsible (default collapsed)

**Files to create:**
- `frontend/src/components/ScanNetworkInterfaces.tsx` - Network interfaces section

#### Step 3.3: Create ScanPackageList Component

- [ ] Display package count and recent packages
- [ ] Add search filter for packages
- [ ] Make section collapsible (default collapsed)

**Files to create:**
- `frontend/src/components/ScanPackageList.tsx` - Package list with search

### Phase 4: Page Integration

**Goal:** Create the main page component and wire up routing

#### Step 4.1: Create ScanResultsPage Component

- [ ] Create page wrapper with fetch logic
- [ ] Handle loading, error, not found states
- [ ] Poll for updates while status is pending/running
- [ ] Stop polling when completed/failed
- [ ] Compose all sub-components

**Files to create:**
- `frontend/src/pages/ScanResultsPage.tsx` - Main page component

**State structure:**
```typescript
const [scan, setScan] = useState<ScanStatusResponse | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [notFound, setNotFound] = useState(false)
```

**Polling logic:**
- Poll every 2 seconds while pending/running
- Stop polling when completed or failed
- Cleanup on unmount

#### Step 4.2: Add Route to App

- [ ] Add route `/scans/:scanId` to App.tsx
- [ ] Import ScanResultsPage

**Files to modify:**
- `frontend/src/App.tsx` - Add route for scan results

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 5.1: Unit Tests

- [ ] Test UsageBar renders with correct colours
- [ ] Test ScanSystemInfo displays all fields
- [ ] Test ScanDiskUsage renders multiple disks
- [ ] Test ScanProcessList sorting
- [ ] Test ScanPackageList search filter

#### Step 5.2: Integration Tests

- [ ] Test ScanResultsPage with mock API
- [ ] Test loading and error states
- [ ] Test polling behaviour
- [ ] Test navigation persistence

#### Step 5.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Manual: View quick scan results | Pending |
| AC2 | Manual: View full scan results | Pending |
| AC3 | Manual: Check progress bars | Pending |
| AC4 | Manual: Sort processes | Pending |
| AC5 | Manual: Navigate away/return | Pending |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Scan failed | Show error message in alert banner, no results section | Phase 4 | [ ] |
| 2 | Partial results | Show available data with "Some data unavailable" note | Phase 4 | [ ] |
| 3 | Very long process list | Limit to top 50 by memory, add "(showing top 50)" label | Phase 3 | [ ] |
| 4 | No packages found | Show "Package list not available" message | Phase 3 | [ ] |

### Coverage Summary

- Story edge cases: 4
- Handled in plan: 4
- Unhandled: 0

### Edge Case Implementation Notes

- Scan failed: Check `scan.status === 'failed'` and display `scan.error` in red banner
- Partial results: Check if `scan.results.errors` array has items, display warning banner
- Process list limit: Sort and slice to 50 items, display count with note
- No packages: Check `packages === null` or `packages.count === 0`

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backend schema changes | Types mismatch | Use strict TypeScript, add runtime validation |
| Large data sets (1000+ processes) | Performance | Virtual scrolling or pagination if needed |
| Polling frequency too high | Server load | Use 2-second interval, stop when complete |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0038: Scan Initiation | Story | Provides API endpoint - Done |
| Backend scan API | API | GET /api/v1/scans/{scan_id} available |

## Open Questions

- [x] Should packages be searchable? Yes, per UI mockup
- [x] Default sort order for processes? Memory descending
- [x] Collapse state for full scan sections? Default collapsed

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)
- [ ] Ready for code review

## Notes

- Brand colours from index.css: Success (#4ADE80), Warning (#FBBF24), Error (#F87171)
- Use JetBrains Mono for numeric values (font-mono class)
- Collapsible sections use existing pattern from other components
- Consider lazy loading ScanProcessList for performance
