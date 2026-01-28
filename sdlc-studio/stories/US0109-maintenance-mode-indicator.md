# US0109: Enhanced Maintenance Mode Indicator

> **Status:** Ready
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** system administrator
**I want** maintenance mode to be visually prominent on server cards
**So that** I can immediately identify which servers are paused without reading text

## Context

### Persona Reference
**System Administrator** - Manages homelab infrastructure, needs quick visual status assessment
[Full persona details](../personas.md#system-administrator)

### Background

The current maintenance mode indicator is a small "Maintenance" text badge that blends with other card elements. When scanning a dashboard with many cards, it's easy to miss servers in maintenance mode. A more prominent visual treatment (border glow, icon) will make maintenance status immediately visible.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | WCAG 2.1 AA | Must use icon + colour, not colour alone |
| PRD | Performance | Dashboard <3s load | No heavy animations |

---

## Acceptance Criteria

### AC1: Amber Border Glow
- **Given** a server with `is_paused: true`
- **When** the ServerCard is rendered
- **Then** the card displays an amber/orange glow effect around the border using `shadow-[0_0_8px_rgba(245,158,11,0.5)]` or similar Tailwind shadow

### AC2: Wrench Icon in Header
- **Given** a server with `is_paused: true`
- **When** the ServerCard is rendered
- **Then** a wrench icon (🔧 or Lucide `Wrench`) appears in the card header before the status LED

### AC3: Tooltip on Hover
- **Given** a server with `is_paused: true`
- **When** the user hovers over the maintenance indicator (icon or badge)
- **Then** a tooltip displays "Server is in maintenance mode - alerts are paused"

### AC4: Existing Badge Retained
- **Given** a server with `is_paused: true`
- **When** the ServerCard is rendered
- **Then** the existing "Maintenance" text badge remains visible (in addition to glow and icon)

### AC5: No Conflict with Other States
- **Given** a server with `is_paused: true` and `status: offline`
- **When** the ServerCard is rendered
- **Then** both the maintenance glow AND the offline status LED are visible (amber glow around card, red LED)

---

## Scope

### In Scope
- Amber/orange border glow effect
- Wrench icon added to header
- Tooltip for maintenance indicators
- Works alongside existing maintenance badge

### Out of Scope
- Changing server detail page (just cards)
- Alert behaviour changes (already pauses alerts)
- API changes (uses existing `is_paused` field)

---

## Technical Notes

### Implementation Approach

Update `ServerCard.tsx` to add conditional styling:

```tsx
// Maintenance mode visual enhancements
const maintenanceStyles = server.is_paused
  ? 'shadow-[0_0_8px_rgba(245,158,11,0.5)] ring-1 ring-amber-500/30'
  : '';

// In JSX
<div className={`... ${maintenanceStyles}`}>
  {/* Header */}
  <div className="flex items-center gap-2 mb-3">
    {server.is_paused && (
      <Wrench
        size={16}
        className="text-amber-500"
        title="Server is in maintenance mode - alerts are paused"
      />
    )}
    <MachineTypeIcon ... />
    <StatusLED ... />
    ...
  </div>
</div>
```

### Dependencies
- Lucide React (already installed) - `Wrench` icon

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server enters maintenance mode while dashboard open | Card updates on next poll cycle with glow and icon |
| Server exits maintenance mode | Glow and icon removed immediately on state change |
| Maintenance + inactive server | Show both maintenance glow and inactive (greyed) styling |
| Maintenance + offline server | Show maintenance glow with red status LED |
| Maintenance + workstation offline | Show maintenance glow with grey status LED |
| Touch device (no hover) | Tooltip shows on long-press or tap |

---

## Test Scenarios

- [ ] Verify amber glow appears on paused server card
- [ ] Verify wrench icon appears before status LED
- [ ] Verify tooltip text on hover
- [ ] Verify existing "Maintenance" badge still visible
- [ ] Verify glow + offline LED combination
- [ ] Verify glow + inactive styling combination
- [ ] Verify accessibility: icon has aria-label

---

## Dependencies

### Story Dependencies

None - uses existing `is_paused` field

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Lucide React icons | Library | Available |
| `is_paused` field in Server | Data | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Low

---

## Open Questions

None

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
