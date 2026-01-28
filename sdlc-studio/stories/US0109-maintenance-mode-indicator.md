# US0109: Enhanced Maintenance Mode Indicator

> **Status:** Done
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** a clearly visible maintenance mode indicator on server cards
**So that** I can instantly distinguish paused servers from offline ones

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers. Expects quick visual identification of server states without reading details.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, servers in maintenance mode (paused) have only a subtle indicator that can be missed at a glance. This causes confusion between "server is down" (problem) and "server is paused for maintenance" (intentional). Market leaders like Uptime Kuma use distinct visual treatments (colour, icon, border) to differentiate maintenance states.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | Colour not sole indicator | Must include icon alongside colour |
| PRD | Performance | Dashboard load <3s | Badge rendering must be efficient |
| TRD | Architecture | React + Tailwind CSS | Use existing design system tokens |

---

## Acceptance Criteria

### AC1: Maintenance mode border glow

- **Given** a server has `is_paused: true`
- **When** the dashboard renders the server card
- **Then** the card displays an amber/orange glow border (ring-2 ring-amber-500)
- **And** the border is visible in both light and dark themes

### AC2: Maintenance mode icon

- **Given** a server has `is_paused: true`
- **When** the dashboard renders the server card
- **Then** a wrench icon (lucide-react Wrench) appears next to the server name
- **And** the icon is amber/orange coloured (text-amber-500)

### AC3: Tooltip explanation

- **Given** a server has `is_paused: true`
- **When** the user hovers over the wrench icon
- **Then** a tooltip displays "Maintenance mode - monitoring paused"
- **And** the tooltip appears within 200ms of hover

### AC4: Combined with status LED

- **Given** a server has `is_paused: true`
- **When** the dashboard renders the server card
- **Then** the status LED shows a neutral colour (grey/amber) instead of green/red
- **And** the LED tooltip shows "Paused" instead of "Online"/"Offline"

---

## Scope

### In Scope

- Amber/orange glow border on paused server cards
- Wrench icon next to server name when paused
- Tooltip on hover explaining maintenance mode
- Status LED colour change for paused state
- Dark mode support for all visual changes

### Out of Scope

- Toggle pause functionality (existing, not changing)
- Maintenance scheduling UI (future feature)
- Bulk pause operations
- Maintenance history/audit log

---

## Technical Notes

### Implementation Approach

1. **ServerCard component update:**
   - Add conditional classes for `is_paused` state
   - Import Wrench icon from lucide-react
   - Add Tooltip component wrapping the icon

2. **CSS classes (Tailwind):**
   ```tsx
   // Border glow when paused
   className={cn(
     "rounded-lg border p-4",
     server.is_paused && "ring-2 ring-amber-500/50 border-amber-500"
   )}
   ```

3. **StatusLED component update:**
   - Add "paused" as a valid status value
   - Map to grey/amber colour

### Files to Modify

- `frontend/src/components/ServerCard.tsx` - Add maintenance indicator
- `frontend/src/components/StatusLED.tsx` - Add paused state handling

### Data Requirements

- Server model already has `is_paused: boolean` field
- No API changes required

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Server paused AND offline | Show maintenance indicator, not offline styling |
| 2 | Server paused AND has alerts | Show both maintenance indicator and alert badge |
| 3 | Pause state changes while viewing | Card updates immediately (React state) |
| 4 | Multiple paused servers | Each card shows indicator independently |
| 5 | Icon library fails to load | Graceful fallback to text "[M]" |

---

## Test Scenarios

- [ ] Paused server shows amber glow border
- [ ] Paused server shows wrench icon
- [ ] Tooltip appears on icon hover
- [ ] Status LED shows grey/amber when paused
- [ ] Non-paused server has no maintenance indicators
- [ ] Dark mode renders correctly
- [ ] Border visible against various card backgrounds

---

## Dependencies

### Story Dependencies

None - frontend only, uses existing data.

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| lucide-react Wrench icon | Library | Available |
| Tailwind ring utilities | Framework | Available |
| Server `is_paused` field | Data | Done |

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
| 2026-01-28 | Claude | Initial story creation from EP0017 |
