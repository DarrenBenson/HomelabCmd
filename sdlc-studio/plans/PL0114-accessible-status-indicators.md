# PL0114: Accessible Status Indicators - Implementation Plan

> **Status:** Draft
> **Story:** [US0114: Accessible Status Indicators](../stories/US0114-accessible-status-indicators.md)
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (Frontend)

## Overview

Update the StatusLED component to use shape + colour + icon combinations for WCAG 2.1 AA compliance. This ensures server status is distinguishable without relying solely on colour.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Online indicator | Green filled circle with checkmark |
| AC2 | Offline indicator | Red filled circle with X |
| AC3 | Warning indicator | Yellow triangle with exclamation |
| AC4 | Paused indicator | Hollow amber circle with pause bars |
| AC5 | Screen reader | Appropriate aria-labels |
| AC6 | High contrast | 4.5:1 minimum contrast ratio |

---

## Technical Context

### Language & Framework
- **Primary Language:** TypeScript
- **Framework:** React 19
- **Test Framework:** Vitest + Testing Library
- **Icons:** lucide-react

### Existing Patterns
- StatusLED currently uses colour-only circles (2.5rem)
- lucide-react icons used throughout app
- Tailwind CSS for styling

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Visual component with clear acceptance criteria. Easier to validate visually first, then write tests.

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Rewrite StatusLED with icons | `StatusLED.tsx` | - | [ ] |
| 2 | Update StatusLED tests | `StatusLED.test.tsx` | 1 | [ ] |
| 3 | Visual verification | Manual | 1 | [ ] |

---

## Implementation Details

### Status Configuration

| Status | Shape | Colour | Icon | Background |
|--------|-------|--------|------|------------|
| online | Filled circle | Green | Check | bg-green-500 |
| offline | Filled circle | Red | X | bg-red-500 |
| warning | Triangle | Yellow | AlertTriangle | bg-yellow-500 |
| paused | Hollow circle | Amber | Pause | border-amber-500 |
| unknown | Filled circle | Grey | HelpCircle | bg-gray-400 |
| offline+workstation | Hollow circle | Grey | Circle | border-gray-400 |

### Component Structure

```tsx
<span className="indicator-container" aria-label="...">
  <span className="shape-background">
    <Icon className="icon" />
  </span>
</span>
```

### Size Considerations
- Current: 10px (w-2.5 h-2.5)
- New: 20px (w-5 h-5) to accommodate icon
- Icon size: 12px (w-3 h-3)

---

## Edge Case Handling

| # | Edge Case | Handling Strategy |
|---|-----------|-------------------|
| 1 | Unknown status | Grey circle with question mark |
| 2 | Offline workstation | Grey hollow circle (existing behaviour enhanced) |
| 3 | isPaused + offline | Paused takes precedence |
| 4 | Warning + paused | Paused takes precedence |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests updated and passing
- [ ] Visual verification complete
- [ ] No linting errors
- [ ] Icons distinguishable in greyscale
