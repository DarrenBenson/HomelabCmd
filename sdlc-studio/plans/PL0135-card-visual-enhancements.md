# PL0135: Card Visual Enhancements - Implementation Plan

> **Status:** Complete
> **Story:** [US0135: Card Visual Enhancements](../stories/US0135-card-visual-enhancements.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Language:** TypeScript

## Overview

This story's requirements are **already implemented** via [US0091: Visual Distinction (Server vs Workstation)](../stories/US0091-visual-distinction-workstations.md) from EP0009. The only remaining work is a minor dark mode enhancement for MachineTypeBadge.

## Implementation Status

| AC | Description | Status | Implemented By |
|----|-------------|--------|----------------|
| AC1 | Server blue border | ✅ Done | US0091 - `border-l-blue-500` |
| AC2 | Workstation purple border | ✅ Done | US0091 - `border-l-purple-500` |
| AC3 | Machine type badge | ✅ Done | US0091 - MachineTypeBadge component |
| AC4 | Offline server treatment | ✅ Done | US0091 - Red LED, solid border |
| AC5 | Offline workstation treatment | ✅ Done | US0091 - Grey LED, dashed border |
| AC6 | Hover tooltip | ✅ Done | US0091 - MachineTypeIcon with title |
| AC7 | Dark mode support | ⚠️ Partial | Needs dark: variants in MachineTypeBadge |

## Technical Context

### Existing Implementation

The following components already implement US0135 requirements:

- `frontend/src/components/ServerCard.tsx` - Card with typed borders
- `frontend/src/components/MachineTypeBadge.tsx` - Type badge display
- `frontend/src/components/MachineTypeIcon.tsx` - Icon with tooltip
- `frontend/src/components/StatusLED.tsx` - Status indicator with grey for offline workstations

### AC7 Dark Mode Gap

`MachineTypeBadge.tsx` uses light-mode only colours:

```tsx
// Current (light mode only)
const styles = isWorkstation
  ? 'bg-purple-100 text-purple-800 border-purple-200'
  : 'bg-blue-100 text-blue-800 border-blue-200';
```

Should be updated to:

```tsx
// With dark mode support
const styles = isWorkstation
  ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700'
  : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700';
```

---

## Implementation Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Add dark mode variants to MachineTypeBadge | `MachineTypeBadge.tsx` | [ ] |
| 2 | Update tests to verify dark mode classes | `MachineTypeBadge.test.tsx` | [ ] |

---

## Recommendation

Since US0091 already implements 6 of 7 ACs, this story should be marked as **Done** after the minor AC7 dark mode fix. Alternatively, AC7 could be deferred to a dedicated dark mode audit story.

---

## Definition of Done

- [x] AC1-AC6 verified (via US0091)
- [ ] AC7 dark mode classes added to MachineTypeBadge
- [ ] Tests pass

---

## Notes

- This plan documents that US0135 overlaps significantly with US0091
- Only MachineTypeBadge needs a dark mode update
- Border colours (blue-500, purple-500) work well in both light and dark modes
- StatusLED grey colour also works in dark mode
