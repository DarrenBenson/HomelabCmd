# US0114: Accessible Status Indicators

> **Status:** Done
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Completed:** 2026-01-28
> **Story Points:** 2

## User Story

**As a** Darren (Homelab Operator)
**I want** status indicators to use shape and colour together
**So that** I can identify server status even with colour vision deficiency

## Context

### Persona Reference

**Darren** - Technical professional running a homelab. Values inclusive design that works for all users.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The current StatusLED component uses only colour (green/red/yellow) to indicate server status. This fails WCAG 2.1 AA compliance which requires that colour not be the sole means of conveying information. Market leaders use shape + colour combinations (e.g., filled circle vs hollow circle, checkmark vs X).

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | WCAG 2.1 AA compliant | Shape must differentiate states |
| PRD | Accessibility | Colour not sole indicator | Icons or patterns required |
| TRD | Architecture | lucide-react icons | Use existing icon library |

---

## Acceptance Criteria

### AC1: Online status indicator

- **Given** a server has `status: "online"`
- **When** the status indicator renders
- **Then** it shows a filled green circle with a checkmark icon inside
- **And** the shape is distinguishable without colour (filled vs hollow)

### AC2: Offline status indicator

- **Given** a server has `status: "offline"`
- **When** the status indicator renders
- **Then** it shows a filled red circle with an X icon inside
- **And** the icon is clearly visible against the background

### AC3: Warning status indicator

- **Given** a server has `status: "warning"`
- **When** the status indicator renders
- **Then** it shows a yellow/amber triangle with exclamation mark
- **And** the triangle shape distinguishes from circle (online/offline)

### AC4: Paused status indicator

- **Given** a server has `is_paused: true`
- **When** the status indicator renders
- **Then** it shows a grey/amber hollow circle with pause bars icon
- **And** the hollow shape indicates non-critical state

### AC5: Screen reader accessibility

- **Given** a status indicator is rendered
- **When** a screen reader reads the element
- **Then** it announces the status (e.g., "Server status: online")
- **And** the indicator has appropriate aria-label

### AC6: High contrast support

- **Given** the user has high contrast mode enabled
- **When** viewing status indicators
- **Then** indicators remain visible and distinguishable
- **And** icons have sufficient contrast ratio (4.5:1 minimum)

---

## Scope

### In Scope

- Update StatusLED component with shape + colour
- Online: filled circle + checkmark
- Offline: filled circle + X
- Warning: triangle + exclamation
- Paused: hollow circle + pause bars
- Screen reader labels
- High contrast mode support

### Out of Scope

- Colourblind simulation testing tool
- User preference for indicator style
- Animation on status change
- Status indicator size customisation

---

## Technical Notes

### Implementation Approach

1. **Update StatusLED component:**
   ```tsx
   function StatusLED({ status, isPaused }: { status: ServerStatus; isPaused?: boolean }) {
     if (isPaused) {
       return (
         <span
           className="inline-flex items-center justify-center w-5 h-5 rounded-full border-2 border-amber-500 text-amber-500"
           aria-label="Server status: paused"
         >
           <Pause className="w-3 h-3" />
         </span>
       );
     }

     const config = {
       online: {
         bg: "bg-green-500",
         icon: Check,
         shape: "rounded-full",
         label: "online"
       },
       offline: {
         bg: "bg-red-500",
         icon: X,
         shape: "rounded-full",
         label: "offline"
       },
       warning: {
         bg: "bg-yellow-500",
         icon: AlertTriangle,
         shape: "triangle",  // Custom CSS clip-path
         label: "warning"
       },
     }[status];

     return (
       <span
         className={cn("inline-flex items-center justify-center w-5 h-5", config.bg, config.shape)}
         aria-label={`Server status: ${config.label}`}
       >
         <config.icon className="w-3 h-3 text-white" />
       </span>
     );
   }
   ```

2. **Triangle shape CSS:**
   ```css
   .triangle {
     clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
   }
   ```

3. **Lucide icons to use:**
   - Online: `Check` or `CheckCircle`
   - Offline: `X` or `XCircle`
   - Warning: `AlertTriangle`
   - Paused: `Pause` or `PauseCircle`

### Files to Modify

- `frontend/src/components/StatusLED.tsx` - Complete rewrite
- `frontend/src/styles/globals.css` - Add triangle clip-path if needed

### Data Requirements

- Uses existing `status` field on Server model
- Uses existing `is_paused` field on Server model

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Unknown status value | Show grey circle with question mark |
| 2 | Icon fails to load | Show shape with colour only (graceful degradation) |
| 3 | Very small viewport | Icons remain visible at minimum 16x16px |
| 4 | Status + paused conflict | Paused takes precedence |
| 5 | Print stylesheet | Icons render as shapes (no colour dependency) |

---

## Test Scenarios

- [x] Online server shows green circle with checkmark
- [x] Offline server shows red circle with X
- [x] Warning server shows yellow triangle with exclamation
- [x] Paused server shows hollow circle with pause bars
- [x] Screen reader announces correct status
- [x] Indicators visible in high contrast mode
- [x] Shapes distinguishable in greyscale
- [x] Icons visible in dark mode

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0109 | Coordination | Both update StatusLED | Ready |
| US0110 | Coordination | Warning state handling | Ready |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| lucide-react icons | Library | Available |

---

## Estimation

**Story Points:** 2
**Complexity:** Low - component update with icon changes

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0017 |
