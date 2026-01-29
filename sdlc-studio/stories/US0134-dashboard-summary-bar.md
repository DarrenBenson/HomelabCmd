# US0134: Dashboard Summary Bar

> **Status:** Done
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3
> **Plan:** [PL0134](../plans/PL0134-dashboard-summary-bar.md)
> **Test Spec:** [TS0134](../test-specs/TS0134-dashboard-summary-bar.md)
> **Workflow:** [WF0020](../workflows/WF0020-dashboard-summary-bar.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** to see a summary of all machine status at a glance
**So that** I immediately know the overall health

## Context

### Persona Reference

**Darren** - Technical professional who wants to spend 2-5 minutes daily knowing everything is fine. Needs instant visual feedback on fleet health.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The current dashboard shows individual cards but lacks a high-level summary. Darren must mentally count online/offline servers to assess overall health. A summary bar provides instant awareness of fleet status, with clear distinction between server issues (critical) and workstation offline (expected).

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | Colour not sole indicator | Use icons + text with colour |
| PRD | Performance | Dashboard load <3s | Summary computed from already-loaded data |
| EP0009 | UX | Workstations offline is normal | Distinguish from server offline in summary |

---

## Acceptance Criteria

### AC1: Summary bar position

- **Given** the dashboard page loads
- **When** the page renders
- **Then** a summary bar appears at the top (below navigation, above sections)
- **And** the bar spans the full width of the content area
- **And** the bar has a subtle background (e.g., bg-muted/50)

### AC2: Total machines count

- **Given** 13 machines are registered (9 servers + 4 workstations)
- **When** the summary bar renders
- **Then** it displays a "Machines" stat showing "13"
- **And** the stat includes a computer icon

### AC3: Online count

- **Given** 10 machines are online
- **When** the summary bar renders
- **Then** it displays an "Online" stat showing "10"
- **And** the stat has green colour coding (text-green-500)
- **And** the stat includes a check/online icon

### AC4: Offline servers count (critical)

- **Given** 1 server is offline
- **When** the summary bar renders
- **Then** it displays "Servers Offline" stat showing "1"
- **And** the stat has red colour coding (text-red-500)
- **And** the stat includes an alert triangle icon
- **And** this stat only appears when > 0

### AC5: Workstation status

- **Given** 2 of 4 workstations are online
- **When** the summary bar renders
- **Then** it displays "Workstations" stat showing "2/4"
- **And** the stat has neutral/blue colour coding
- **And** no alert icon (workstations offline is expected)

### AC6: Click to filter

- **Given** the summary bar shows "Servers Offline: 1"
- **When** the user clicks on the "Servers Offline" stat
- **Then** the dashboard filters to show only offline servers
- **And** the URL updates with filter query param (e.g., ?filter=offline-servers)
- **And** a "Clear filter" button appears

### AC7: Refresh button

- **Given** the summary bar is displayed
- **When** the user clicks the "Refresh" button
- **Then** all machine data is refreshed from the API
- **And** a loading spinner appears during refresh
- **And** counts update when refresh completes

### AC8: All healthy state

- **Given** all servers are online (no servers offline)
- **When** the summary bar renders
- **Then** the "Servers Offline" stat is hidden
- **And** a subtle "All systems operational" message or green checkmark appears

---

## Scope

### In Scope

- Summary bar component at top of dashboard
- Counts: total, online, offline servers, workstations
- Colour coding with icons for accessibility
- Click-to-filter functionality
- Refresh button
- Real-time count updates

### Out of Scope

- Historical comparison ("3 more than yesterday")
- Alert count in summary bar (shown in nav already)
- Cost summary (separate widget consideration)
- Custom summary stats configuration

---

## Technical Notes

### Component Design

```tsx
// frontend/src/components/SummaryBar.tsx
interface SummaryBarProps {
  machines: Machine[];
  onFilter: (filter: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function SummaryBar({ machines, onFilter, onRefresh, isRefreshing }: SummaryBarProps) {
  const servers = machines.filter(m => m.machine_type === 'server');
  const workstations = machines.filter(m => m.machine_type === 'workstation');

  const offlineServers = servers.filter(m => m.status === 'offline').length;
  const onlineTotal = machines.filter(m => m.status === 'online').length;
  const onlineWorkstations = workstations.filter(m => m.status === 'online').length;

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg mb-6">
      <Stat icon={Monitor} label="Machines" value={machines.length} />
      <Stat icon={CheckCircle} label="Online" value={onlineTotal} color="green" />
      {offlineServers > 0 && (
        <Stat
          icon={AlertTriangle}
          label="Servers Offline"
          value={offlineServers}
          color="red"
          onClick={() => onFilter('offline-servers')}
        />
      )}
      <Stat
        icon={Laptop}
        label="Workstations"
        value={`${onlineWorkstations}/${workstations.length}`}
        color="blue"
      />
      <div className="ml-auto">
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color, onClick }) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 px-3 py-1 rounded",
        onClick && "hover:bg-muted cursor-pointer",
        color === 'green' && "text-green-600",
        color === 'red' && "text-red-600",
        color === 'blue' && "text-blue-600"
      )}
      onClick={onClick}
      disabled={!onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </button>
  );
}
```

### Files to Create/Modify

- `frontend/src/components/SummaryBar.tsx` - New component
- `frontend/src/pages/Dashboard.tsx` - Integrate SummaryBar
- `frontend/src/types/dashboard.ts` - Add filter types if needed

### Data Requirements

- Uses existing machine data (no new API calls)
- Filtering uses URL query params for shareability

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | No machines registered | Show "0 Machines" with link to add first |
| 2 | All machines online | Hide "Servers Offline", show success indicator |
| 3 | All servers offline | "Servers Offline" shows with high prominence |
| 4 | No workstations | Hide workstations stat entirely |
| 5 | Refresh fails | Show error toast, keep existing counts |
| 6 | Click stat while filtered | Clears existing filter, applies new one |
| 7 | 0 workstations online | Show "0/4" (not highlighted as error) |
| 8 | Very long refresh time (>5s) | Show loading state, allow cancel |

---

## Test Scenarios

- [ ] Summary bar renders at top of dashboard
- [ ] Total machines count is accurate
- [ ] Online count shows correct number
- [ ] Offline servers stat appears when > 0
- [ ] Offline servers stat hidden when 0
- [ ] Workstations shows X/Y format
- [ ] Clicking stat filters dashboard
- [ ] Filter clears with "Clear filter" button
- [ ] Refresh button fetches new data
- [ ] Spinner shows during refresh
- [ ] Counts update after machine status change
- [ ] All green indicator when fleet healthy
- [ ] Bar wraps correctly on mobile (US0133)

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| EP0009 | Requires | machine_type distinction | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| lucide-react icons | Library | Available |
| Machine data API | Backend | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - Frontend component using existing data

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0011 |
| 2026-01-28 | Claude | Status: Draft -> Planned (PL0134, TS0134 created) |
| 2026-01-28 | Claude | Status: Planned -> In Progress (WF0020 created) |
| 2026-01-28 | Claude | Status: In Progress -> Done (all ACs verified, 33 tests) |
