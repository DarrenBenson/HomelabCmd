# TS0135: Card Visual Enhancements

> **Status:** Complete
> **Story:** [US0135: Card Visual Enhancements](../stories/US0135-card-visual-enhancements.md)
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Last Updated:** 2026-01-28

## Overview

Test specification for card visual enhancements. Most test cases are already implemented via US0091 in `ServerCard.test.tsx` and `MachineTypeBadge.test.tsx`.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0135](../stories/US0135-card-visual-enhancements.md) | Card Visual Enhancements | P1 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0135 | AC1 | Server blue border | TC01 | Done (US0091) |
| US0135 | AC2 | Workstation purple border | TC02 | Done (US0091) |
| US0135 | AC3 | Machine type badge | TC03, TC04 | Done (US0091) |
| US0135 | AC4 | Offline server treatment | TC05 | Done (US0091) |
| US0135 | AC5 | Offline workstation treatment | TC06, TC07 | Done (US0091) |
| US0135 | AC6 | Hover tooltip | TC08 | Done (US0091) |
| US0135 | AC7 | Dark mode support | TC09, TC10 | Done |

**Coverage:** 7/7 ACs covered

---

## Test Cases

### TC01: Server card has blue left border

**Type:** Unit | **Priority:** P0 | **Story:** US0135 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server card renders | Card visible |
| When | Checking border styles | Border class present |
| Then | Card has `border-l-blue-500` class | Blue left border visible |

**Status:** Done - `ServerCard.test.tsx:563`

---

### TC02: Workstation card has purple left border

**Type:** Unit | **Priority:** P0 | **Story:** US0135 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstation card renders | Card visible |
| When | Checking border styles | Border class present |
| Then | Card has `border-l-purple-500` class | Purple left border visible |

**Status:** Done - `ServerCard.test.tsx:575`

---

### TC03: Server badge shows "Server" text

**Type:** Unit | **Priority:** P0 | **Story:** US0135 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server card renders | Badge visible |
| When | Checking badge text | Text present |
| Then | Badge shows "Server" | Correct label |

**Status:** Done - `MachineTypeBadge.test.tsx:28`

---

### TC04: Workstation badge shows "Workstation" text

**Type:** Unit | **Priority:** P0 | **Story:** US0135 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstation card renders | Badge visible |
| When | Checking badge text | Text present |
| Then | Badge shows "Workstation" | Correct label |

**Status:** Done - `MachineTypeBadge.test.tsx:37`

---

### TC05: Offline server shows red LED with solid border

**Type:** Unit | **Priority:** P0 | **Story:** US0135 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server with status="offline" | Card renders |
| When | Checking LED and border | Styles applied |
| Then | LED is red, border is solid | Alert state visible |

**Status:** Done - `ServerCard.test.tsx:530`

---

### TC06: Offline workstation shows grey LED

**Type:** Unit | **Priority:** P0 | **Story:** US0135 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstation with status="offline" | Card renders |
| When | Checking LED colour | Grey LED |
| Then | LED has grey/neutral colour | Expected state |

**Status:** Done - `StatusLED.test.tsx:85` (offline-expected variant)

---

### TC07: Offline workstation has dashed border

**Type:** Unit | **Priority:** P0 | **Story:** US0135 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstation with status="offline" | Card renders |
| When | Checking border style | Dashed border |
| Then | Card has `border-dashed` class | Visual distinction |

**Status:** Done - `ServerCard.test.tsx:551`

---

### TC08: Machine type icon shows tooltip on hover

**Type:** Unit | **Priority:** P1 | **Story:** US0135 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Card renders with machine type icon | Icon visible |
| When | Icon has title attribute | Tooltip content set |
| Then | Title shows "Server" or "Workstation" | Accessible tooltip |

**Status:** Done - `MachineTypeIcon.test.tsx` (title prop)

---

### TC09: Server badge has dark mode colours

**Type:** Unit | **Priority:** P1 | **Story:** US0135 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server badge renders | Badge visible |
| When | Checking class list | Dark mode classes |
| Then | Badge has `dark:bg-blue-900/30 dark:text-blue-300` | Dark mode support |

**Status:** Done

**Assertions:**
- [x] Badge has `dark:bg-blue-900/30` class
- [x] Badge has `dark:text-blue-300` class
- [x] Badge has `dark:border-blue-700` class

---

### TC10: Workstation badge has dark mode colours

**Type:** Unit | **Priority:** P1 | **Story:** US0135 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstation badge renders | Badge visible |
| When | Checking class list | Dark mode classes |
| Then | Badge has `dark:bg-purple-900/30 dark:text-purple-300` | Dark mode support |

**Status:** Done

**Assertions:**
- [x] Badge has `dark:bg-purple-900/30` class
- [x] Badge has `dark:text-purple-300` class
- [x] Badge has `dark:border-purple-700` class

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Server blue border | Done | ServerCard.test.tsx |
| TC02 | Workstation purple border | Done | ServerCard.test.tsx |
| TC03 | Server badge text | Done | MachineTypeBadge.test.tsx |
| TC04 | Workstation badge text | Done | MachineTypeBadge.test.tsx |
| TC05 | Offline server red LED | Done | ServerCard.test.tsx |
| TC06 | Offline workstation grey LED | Done | StatusLED.test.tsx |
| TC07 | Offline workstation dashed border | Done | ServerCard.test.tsx |
| TC08 | Icon tooltip | Done | MachineTypeIcon.test.tsx |
| TC09 | Server badge dark mode | Done | MachineTypeBadge.test.tsx |
| TC10 | Workstation badge dark mode | Done | MachineTypeBadge.test.tsx |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md) |
| Related | [US0091: Visual Distinction](../stories/US0091-visual-distinction-workstations.md) |
| Plan | [PL0135](../plans/PL0135-card-visual-enhancements.md) |

---

## Notes

- 8 of 10 test cases already implemented via US0091
- Only TC09 and TC10 (dark mode badge colours) need implementation
- Existing tests in ServerCard.test.tsx, MachineTypeBadge.test.tsx, StatusLED.test.tsx

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial spec - 8/10 tests already exist |
