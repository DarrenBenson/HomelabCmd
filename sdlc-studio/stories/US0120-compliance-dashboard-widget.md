# US0120: Compliance Dashboard Widget

> **Status:** Done
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** to see compliance status for all machines on the dashboard
**So that** I have quick visibility into configuration health

## Context

### Persona Reference
**System Administrator** - Needs at-a-glance visibility into fleet configuration health
[Full persona details](../personas.md#system-administrator)

### Background

Once compliance checking is implemented (US0117), users need a dashboard widget that summarises the compliance status across all machines. This provides quick visibility into which machines need attention without navigating to individual machine pages.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| TRD | Frontend | React + Tailwind | Match existing widget design |
| PRD | Performance | Dashboard <2s load | Widget data must be cached |

---

## Acceptance Criteria

### AC1: Compliance Summary Endpoint
- **Given** `GET /api/v1/config/compliance`
- **When** called
- **Then** returns summary with:
  - Compliant machine count
  - Non-compliant machine count
  - Never-checked machine count
  - Per-machine status array

### AC2: Dashboard Widget Display
- **Given** the dashboard
- **When** loaded
- **Then** shows compliance widget with:
  - Title "Configuration Compliance"
  - Summary counts (compliant/non-compliant/never checked)
  - List of non-compliant machines

### AC3: Widget Colour Coding
- **Given** compliance status
- **When** widget rendered
- **Then** uses colours:
  - Green border if all compliant
  - Amber border if some non-compliant
  - Grey border if all never checked

### AC4: Machine List in Widget
- **Given** non-compliant machines exist
- **When** widget displayed
- **Then** shows list with:
  - Machine name
  - Mismatch count
  - Last checked timestamp

### AC5: Navigation Links
- **Given** widget displayed
- **When** "View Details" clicked
- **Then** navigates to configuration management page
- **When** machine name clicked
- **Then** navigates to that machine's diff view

### AC6: Refresh Button
- **Given** widget displayed
- **When** "Check All" clicked
- **Then** triggers compliance check for all machines
- **And** shows progress during check

---

## Scope

### In Scope
- `GET /api/v1/config/compliance` endpoint
- Dashboard widget component
- Summary counts and colour coding
- Non-compliant machine list
- Navigation to detail pages
- Refresh/check all functionality

### Out of Scope
- Widget customisation/resizing
- Historical compliance trends
- Compliance percentage over time

---

## Technical Notes

### API Response Format

```json
GET /api/v1/config/compliance

{
  "summary": {
    "compliant": 8,
    "non_compliant": 3,
    "never_checked": 2,
    "total": 13
  },
  "machines": [
    {
      "id": "homeserver",
      "display_name": "HomeServer",
      "status": "compliant",
      "pack": "base",
      "checked_at": "2026-01-28T06:00:00Z"
    },
    {
      "id": "studypc",
      "display_name": "StudyPC",
      "status": "non_compliant",
      "pack": "developer_max",
      "mismatch_count": 3,
      "checked_at": "2026-01-28T06:00:00Z"
    },
    {
      "id": "laptoppro",
      "display_name": "LaptopPro",
      "status": "never_checked",
      "pack": null,
      "checked_at": null
    }
  ]
}
```

### Widget Component

```tsx
// ComplianceWidget.tsx
export function ComplianceWidget() {
  const { data, isLoading, refetch } = useComplianceSummary();
  const navigate = useNavigate();

  const borderColour = data?.summary.non_compliant > 0
    ? 'border-amber-500'
    : data?.summary.compliant > 0
      ? 'border-green-500'
      : 'border-gray-500';

  const nonCompliantMachines = data?.machines.filter(m => m.status === 'non_compliant') || [];

  return (
    <div className={`rounded-lg border-l-4 ${borderColour} bg-bg-secondary p-4`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Configuration Compliance</h3>
        <Button size="sm" onClick={refetch}>Check All</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">{data?.summary.compliant}</div>
          <div className="text-xs text-text-secondary">Compliant</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-500">{data?.summary.non_compliant}</div>
          <div className="text-xs text-text-secondary">Non-compliant</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-500">{data?.summary.never_checked}</div>
          <div className="text-xs text-text-secondary">Never checked</div>
        </div>
      </div>

      {/* Non-compliant list */}
      {nonCompliantMachines.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-text-secondary">Needs Attention:</div>
          {nonCompliantMachines.slice(0, 5).map(machine => (
            <div
              key={machine.id}
              className="flex justify-between items-center text-sm cursor-pointer hover:bg-bg-tertiary p-1 rounded"
              onClick={() => navigate(`/servers/${machine.id}/config`)}
            >
              <span>{machine.display_name}</span>
              <span className="text-amber-500">{machine.mismatch_count} items</span>
            </div>
          ))}
        </div>
      )}

      {/* View all link */}
      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" onClick={() => navigate('/config')}>
          View Details
        </Button>
      </div>
    </div>
  );
}
```

### Widget Visual

```
┌────────────────────────────────────────┐
│ Configuration Compliance    [Check All] │
├────────────────────────────────────────┤
│                                        │
│    8           3           2           │
│ Compliant  Non-compliant  Never checked│
│    ✅          ⚠️           ⚪          │
│                                        │
│ Needs Attention:                       │
│   StudyPC              3 items         │
│   LaptopPro            1 item          │
│   GamingPC             5 items         │
│                                        │
│           [View Details]               │
└────────────────────────────────────────┘
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No machines have packs assigned | Show "No packs configured" message |
| All machines compliant | Show green success state |
| Check All fails for some machines | Show partial results with errors |
| API timeout | Show error with retry button |
| >5 non-compliant machines | Show first 5 with "+X more" link |

---

## Test Scenarios

- [x] Verify endpoint returns correct summary counts
- [x] Verify widget shows all three status counts
- [x] Verify green border when all compliant
- [x] Verify amber border when some non-compliant
- [x] Verify non-compliant machines listed
- [x] Verify clicking machine navigates to diff
- [x] Verify "Check All" triggers checks
- [x] Verify "View Details" navigates to config page

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0117 | Data | Compliance check results | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Dashboard page | Frontend | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium (API aggregation, widget component)

---

## Open Questions

None

---

## Implementation Artefacts

| Artefact | Link | Status |
|----------|------|--------|
| Plan | [PL0185](../plans/PL0185-compliance-dashboard-widget.md) | Complete |
| Test Spec | [TS0185](../test-specs/TS0185-compliance-dashboard-widget.md) | Complete |
| Workflow | [WF0185](../workflows/WF0185-compliance-dashboard-widget.md) | Complete |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0098) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
| 2026-01-29 | Claude | Status: Draft → Planned. Plan PL0185 and Test Spec TS0185 created |
| 2026-01-29 | Claude | Status: Planned → In Progress → Done. Implementation complete |
