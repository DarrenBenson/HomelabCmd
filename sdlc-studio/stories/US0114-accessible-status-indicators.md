# US0114: Accessible Status Indicators

> **Status:** Ready
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 2

## User Story

**As a** colour-blind user
**I want** status to be indicated with more than colour
**So that** I can distinguish server states regardless of colour perception

## Context

### Persona Reference
**System Administrator** - May have colour vision deficiency (affects ~8% of males)
[Full persona details](../personas.md#system-administrator)

### Background

The current `StatusLED` component uses colour alone to indicate server status:
- Green circle = online
- Red circle = offline
- Grey circle = unknown

This is problematic for users with colour vision deficiency (CVD), particularly red-green colour blindness (deuteranopia/protanopia) which affects approximately 8% of males. WCAG 2.1 Success Criterion 1.4.1 states "Color is not used as the only visual means of conveying information."

Adding shape and text indicators alongside colour ensures all users can distinguish server states.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | WCAG 2.1 AA | Colour must not be sole indicator |
| PRD | Performance | Dashboard <3s load | No heavy icon loading |
| TRD | Architecture | Lucide icons | Use existing icon library |

---

## Acceptance Criteria

### AC1: Online Status Indicator
- **Given** a server with `status: online`
- **When** the StatusLED is rendered
- **Then** it displays a green filled circle (●)
- **And** uses Lucide `CheckCircle2` or filled circle icon

### AC2: Offline Status Indicator
- **Given** a server with `status: offline`
- **When** the StatusLED is rendered
- **Then** it displays a red outlined/hollow circle (○)
- **And** uses Lucide `Circle` (stroke only) or `XCircle` icon

### AC3: Warning Status Indicator
- **Given** a server with `status: warning` or active alerts
- **When** the StatusLED is rendered
- **Then** it displays a yellow/amber triangle (▲)
- **And** uses Lucide `AlertTriangle` icon

### AC4: Unknown Status Indicator
- **Given** a server with `status: unknown`
- **When** the StatusLED is rendered
- **Then** it displays a grey square (■)
- **And** uses Lucide `HelpCircle` or `Square` icon

### AC5: Screen Reader Accessibility
- **Given** any status indicator
- **When** a screen reader reads the element
- **Then** it announces the status text: "Online", "Offline", "Warning", "Unknown"
- **And** uses `aria-label` attribute

### AC6: Contrast Ratio
- **Given** all status indicators
- **When** checked against WCAG contrast tools
- **Then** all indicators have at least 4.5:1 contrast ratio against the card background

---

## Scope

### In Scope
- Update StatusLED component with shape differentiation
- Add aria-labels for screen readers
- Ensure WCAG AA contrast compliance
- Update all usages of StatusLED across the app

### Out of Scope
- High contrast mode toggle
- Custom colour themes
- Animation changes (pulse for online)

---

## Technical Notes

### Implementation Approach

Update `StatusLED.tsx`:

```tsx
import { CheckCircle2, Circle, AlertTriangle, HelpCircle } from 'lucide-react';

interface StatusLEDProps {
  status: 'online' | 'offline' | 'warning' | 'unknown';
  size?: number;
}

const statusConfig = {
  online: {
    icon: CheckCircle2,
    className: 'text-green-500 fill-green-500',
    label: 'Online',
  },
  offline: {
    icon: Circle,
    className: 'text-red-500',  // stroke only, no fill
    label: 'Offline',
  },
  warning: {
    icon: AlertTriangle,
    className: 'text-yellow-500 fill-yellow-500',
    label: 'Warning',
  },
  unknown: {
    icon: HelpCircle,
    className: 'text-gray-400',
    label: 'Unknown',
  },
};

export function StatusLED({ status, size = 16 }: StatusLEDProps) {
  const config = statusConfig[status] ?? statusConfig.unknown;
  const Icon = config.icon;

  return (
    <Icon
      size={size}
      className={config.className}
      aria-label={config.label}
      role="img"
    />
  );
}
```

### Shape Differentiation Summary

| Status | Colour | Shape | Icon | Visual |
|--------|--------|-------|------|--------|
| Online | Green | Filled circle | `CheckCircle2` | ● |
| Offline | Red | Hollow circle | `Circle` | ○ |
| Warning | Yellow | Triangle | `AlertTriangle` | ▲ |
| Unknown | Grey | Circle with ? | `HelpCircle` | ? |

### Contrast Verification

Test against card backgrounds:
- Light mode: bg-white (#ffffff) or bg-gray-50 (#f9fafb)
- Dark mode: bg-gray-800 (#1f2937) or bg-gray-900 (#111827)

Lucide default colours should meet 4.5:1, but verify:
- Green-500 (#22c55e) on white: 3.4:1 - **needs adjustment to green-600**
- Red-500 (#ef4444) on white: 4.0:1 - **borderline, consider red-600**
- Yellow-500 (#eab308) on white: 2.6:1 - **needs amber-600 or text stroke**

Recommended adjustments:
```tsx
const statusConfig = {
  online: {
    className: 'text-green-600 fill-green-600',  // green-600 for contrast
    // ...
  },
  offline: {
    className: 'text-red-600',  // red-600 for contrast
    // ...
  },
  warning: {
    className: 'text-amber-600 fill-amber-600',  // amber-600 for contrast
    // ...
  },
};
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Status value not in enum | Fall back to "unknown" indicator |
| Very small size (< 12px) | Shapes may not be distinguishable - enforce min size |
| Icon fails to load | Fall back to text abbreviation (ON, OFF, WARN, ?) |
| High contrast mode OS | Ensure icons respect system contrast preference |
| Reduced motion preference | No animation changes (already static) |

---

## Test Scenarios

- [ ] Verify online status shows green filled circle
- [ ] Verify offline status shows red hollow circle
- [ ] Verify warning status shows yellow/amber triangle
- [ ] Verify unknown status shows grey help circle
- [ ] Verify aria-label contains status text
- [ ] Verify screen reader announces status correctly
- [ ] Verify 4.5:1 contrast ratio on light background
- [ ] Verify 4.5:1 contrast ratio on dark background
- [ ] Verify shapes are distinguishable in grayscale
- [ ] Verify fallback for unknown status value

---

## Dependencies

### Story Dependencies

None - updates existing component

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Lucide React icons | Library | Available |

---

## Estimation

**Story Points:** 2
**Complexity:** Low (component update with accessibility focus)

---

## Open Questions

None

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
