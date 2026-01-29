# US0135: Card Visual Enhancements

> **Status:** Done
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3
> **Plan:** [PL0135](../plans/PL0135-card-visual-enhancements.md)
> **Test Spec:** [TS0135](../test-specs/TS0135-card-visual-enhancements.md)
> **Workflow:** [WF0021](../workflows/WF0021-card-visual-enhancements.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** server and workstation cards to look distinct
**So that** I can identify machine types at a glance

## Context

### Persona Reference

**Darren** - Technical professional managing 11+ servers and several workstations. Needs instant visual differentiation between machine types during quick dashboard scans.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With EP0009 (Workstation Management), HomelabCmd supports two machine types with different monitoring behaviour. Currently, both use the same card styling. Visual differentiation will help Darren immediately identify machine types and understand why workstations might be offline (expected) vs servers (problem).

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | Colour not sole indicator | Use border + icon + badge |
| PRD | UX | Consistent design system | Use existing Tailwind tokens |
| EP0009 | Data | machine_type field exists | Use "server"/"workstation" values |

---

## Acceptance Criteria

### AC1: Server card accent

- **Given** a machine has `machine_type: "server"`
- **When** the card renders
- **Then** the card has a blue left border (border-l-4 border-blue-500)
- **And** the card displays a server icon (lucide-react Server) in the header

### AC2: Workstation card accent

- **Given** a machine has `machine_type: "workstation"`
- **When** the card renders
- **Then** the card has a purple left border (border-l-4 border-purple-500)
- **And** the card displays a laptop icon (lucide-react Laptop) in the header

### AC3: Machine type badge

- **Given** a machine card renders
- **When** the card header is displayed
- **Then** a small badge shows "Server" or "Workstation" text
- **And** the badge uses the corresponding accent colour (blue/purple)
- **And** the badge is positioned near the machine name

### AC4: Offline server treatment

- **Given** a server is offline
- **When** the card renders
- **Then** the status LED shows red (existing)
- **And** the border remains solid blue
- **And** an alert indicator appears (triangle icon or badge)

### AC5: Offline workstation treatment

- **Given** a workstation is offline
- **When** the card renders
- **Then** the status LED shows grey (not red)
- **And** the border becomes dashed (border-dashed)
- **And** no alert indicator appears (offline is expected)

### AC6: Hover tooltip

- **Given** a machine card is displayed
- **When** the user hovers over the machine type icon
- **Then** a tooltip shows "Server" or "Workstation"
- **And** the tooltip appears within 200ms

### AC7: Dark mode support

- **Given** the user has dark mode enabled
- **When** machine cards render
- **Then** blue and purple accent colours are visible and accessible
- **And** the contrast meets WCAG AA standards
- **And** grey (offline workstation) is distinguishable from other states

---

## Scope

### In Scope

- Coloured left borders by machine type
- Machine type icons in card header
- Machine type badge text
- Differentiated offline treatment (server vs workstation)
- Hover tooltips on icons
- Dark mode colour adjustments

### Out of Scope

- Custom user-defined colours
- Per-machine colour overrides
- Animated borders or effects
- Machine type icons in other views (detail page, lists)

---

## Technical Notes

### Implementation Approach

```tsx
// frontend/src/components/ServerCard.tsx

const cardStyles = {
  server: {
    border: 'border-l-4 border-blue-500',
    icon: Server,
    badge: 'bg-blue-500/10 text-blue-500',
    badgeText: 'Server',
  },
  workstation: {
    border: 'border-l-4 border-purple-500',
    icon: Laptop,
    badge: 'bg-purple-500/10 text-purple-500',
    badgeText: 'Workstation',
  },
};

function ServerCard({ machine }: { machine: Machine }) {
  const style = cardStyles[machine.machine_type] || cardStyles.server;
  const Icon = style.icon;
  const isOfflineWorkstation = machine.machine_type === 'workstation' && machine.status === 'offline';

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        style.border,
        isOfflineWorkstation && "border-dashed opacity-75"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <StatusLED status={isOfflineWorkstation ? 'offline-expected' : machine.status} />
        <Tooltip content={style.badgeText}>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </Tooltip>
        <h3 className="font-semibold">{machine.server_id}</h3>
        <Badge className={cn("text-xs", style.badge)}>{style.badgeText}</Badge>
      </div>
      {/* rest of card content */}
    </div>
  );
}
```

### StatusLED Update

```tsx
// Add 'offline-expected' status variant
const ledColors = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  'offline-expected': 'bg-gray-400', // For workstations
  warning: 'bg-amber-500',
  paused: 'bg-amber-500',
};
```

### Files to Modify

- `frontend/src/components/ServerCard.tsx` - Add visual differentiation
- `frontend/src/components/StatusLED.tsx` - Add 'offline-expected' variant

### Data Requirements

- `machine_type` field already exists from EP0009
- No API changes required

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Unknown machine_type value | Default to server styling |
| 2 | Machine type changes | Card updates on next render |
| 3 | Workstation in warning state | Purple border, amber LED |
| 4 | Server paused (maintenance) | Blue border, amber glow (US0109) |
| 5 | Very long machine name | Name truncates, badge still visible |
| 6 | Icon library fails to load | Show text "S" or "W" as fallback |
| 7 | Badge text in non-English locale | Use localised strings if i18n |
| 8 | High contrast mode | Ensure borders visible at 4.5:1 ratio |

---

## Test Scenarios

- [ ] Server cards have blue left border
- [ ] Workstation cards have purple left border
- [ ] Server icon appears on server cards
- [ ] Laptop icon appears on workstation cards
- [ ] Badge shows "Server" text for servers
- [ ] Badge shows "Workstation" text for workstations
- [ ] Offline server shows red LED
- [ ] Offline workstation shows grey LED
- [ ] Offline workstation has dashed border
- [ ] Tooltip appears on icon hover
- [ ] Dark mode colours are visible
- [ ] Colours accessible (contrast check)

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| EP0009 | Requires | machine_type field | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| lucide-react Server icon | Library | Available |
| lucide-react Laptop icon | Library | Available |
| Tailwind border utilities | Framework | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low - CSS styling and conditional rendering

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0011 |
| 2026-01-28 | Claude | Status: Draft -> Planned (note: AC1-AC6 already done via US0091) |
| 2026-01-28 | Claude | Status: Planned -> In Progress (WF0021 created) |
| 2026-01-28 | Claude | Status: In Progress -> Done (AC7 dark mode added, all ACs verified) |
