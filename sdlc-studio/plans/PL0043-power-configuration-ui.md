# PL0043: Power Configuration UI - Implementation Plan

> **Status:** Complete
> **Story:** [US0056: Power Configuration UI](../stories/US0056-power-configuration-ui.md)
> **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
> **Created:** 2026-01-21
> **Language:** TypeScript (React)

## Overview

Update the frontend to display machine categories, estimated power, and CPU usage in the costs UI. Refactor TdpEditModal to PowerEditModal with category dropdown. Update ServerDetail to show CPU info and category.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Cost breakdown shows new columns | Table includes: Server, Category, Avg CPU%, Est. Power, Daily, Monthly |
| AC2 | Category badge shows source | Badge shows "Mini PC (auto)" or "Workstation (user)" |
| AC3 | Power configuration modal | Modal shows category dropdown, idle/max watts, CPU model |
| AC4 | Category dropdown options | All 9 categories available with labels |
| AC5 | Override saves with source="user" | Changing category sets machine_category_source to "user" |
| AC6 | Server detail shows CPU and category | System card displays CPU model, cores, category |
| AC7 | Unconfigured servers section | Servers without config appear in separate section |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript
- **Framework:** React with Tailwind CSS
- **Test Framework:** Vitest (frontend tests exist in frontend/src/)

### Relevant Best Practices

From `~/.claude/best-practices/typescript.md`:
- Use strict TypeScript with proper null checks
- Prefer interface over type for object shapes
- Use `as const` for literal types
- Keep components small and focused

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| React | /facebook/react | useState, useEffect patterns | Hooks for state management |
| Tailwind CSS | /tailwindlabs/tailwindcss | Class utilities | Existing design tokens |

### Existing Patterns

**Modal Pattern** (from TdpEditModal.tsx):
- Fixed backdrop overlay (z-50, bg-black/50)
- Modal container with border, bg-bg-primary
- Header with title and X close button
- Body content
- Footer with Cancel/Save buttons
- Keyboard handlers (Enter, Escape)

**Table Pattern** (from CostsPage.tsx):
- Sortable headers with ArrowUpDown icon
- Row hover highlighting
- Total row with bg-bg-tertiary
- Monospace font for numbers

**Badge Pattern:**
- Compact inline with icon
- Source indicator text (auto/user)

## Recommended Approach

**Strategy:** Test-After
**Rationale:** UI-heavy story with visual components. Visual feedback helps validate implementation before writing tests.

### Test Priority

1. TypeScript types match backend API schema
2. Category dropdown renders all 9 options
3. Save sends correct payload to API

### Documentation Updates Required

- [ ] No documentation updates required

## Implementation Steps

### Phase 1: Update TypeScript Types

**Goal:** Align frontend types with backend API schema

#### Step 1.1: Update cost.ts types

- [ ] Add MachineCategory type enum
- [ ] Add MACHINE_CATEGORIES constant with all 9 categories
- [ ] Update ServerCostItem interface with new fields
- [ ] Update CostTotals interface with new fields
- [ ] Update CostSummary interface with new fields

**Files to modify:**
- `frontend/src/types/cost.ts` - Add MachineCategory type and update interfaces

**New types to add:**
```typescript
export type MachineCategory =
  | 'sbc'
  | 'mini_pc'
  | 'nas'
  | 'office_desktop'
  | 'gaming_desktop'
  | 'workstation'
  | 'office_laptop'
  | 'gaming_laptop'
  | 'rack_server';

export interface MachineCategoryOption {
  value: MachineCategory;
  label: string;
  idleWatts: number;
  maxWatts: number;
}

export const MACHINE_CATEGORIES: MachineCategoryOption[] = [
  { value: 'sbc', label: 'Single Board Computer', idleWatts: 2, maxWatts: 6 },
  { value: 'mini_pc', label: 'Mini PC', idleWatts: 10, maxWatts: 25 },
  { value: 'nas', label: 'NAS/Home Server', idleWatts: 15, maxWatts: 35 },
  { value: 'office_desktop', label: 'Office Desktop', idleWatts: 40, maxWatts: 100 },
  { value: 'gaming_desktop', label: 'Gaming Desktop', idleWatts: 75, maxWatts: 300 },
  { value: 'workstation', label: 'Workstation', idleWatts: 100, maxWatts: 350 },
  { value: 'office_laptop', label: 'Office Laptop', idleWatts: 10, maxWatts: 30 },
  { value: 'gaming_laptop', label: 'Gaming Laptop', idleWatts: 30, maxWatts: 100 },
  { value: 'rack_server', label: 'Rack Server', idleWatts: 100, maxWatts: 300 },
];
```

### Phase 2: Refactor TdpEditModal to PowerEditModal

**Goal:** Enhanced modal with category dropdown and power settings

#### Step 2.1: Create PowerEditModal component

- [ ] Copy TdpEditModal as base
- [ ] Add category dropdown with all 9 options
- [ ] Add idle_watts input field
- [ ] Show detected CPU model (read-only)
- [ ] Show average CPU % (read-only)
- [ ] Show calculated estimated power (read-only preview)
- [ ] Auto-populate idle/max from category defaults
- [ ] Allow user override of idle/max values

**Files to modify:**
- `frontend/src/components/TdpEditModal.tsx` → rename/refactor to `PowerEditModal.tsx`
- Keep TdpEditModal for backwards compatibility or delete if unused

**Props interface:**
```typescript
interface PowerEditModalProps {
  serverName: string;
  cpuModel: string | null;
  avgCpuPercent: number | null;
  currentCategory: MachineCategory | null;
  currentCategorySource: 'auto' | 'user' | null;
  currentIdleWatts: number | null;
  currentMaxWatts: number | null;
  onSave: (config: PowerConfigUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface PowerConfigUpdate {
  machine_category: MachineCategory | null;
  idle_watts: number | null;
  tdp_watts: number | null;
}
```

### Phase 3: Update CostsPage Table

**Goal:** Display new columns and category badges

#### Step 3.1: Update table columns

- [ ] Add "Category" column with source badge
- [ ] Add "Avg CPU" column (percentage)
- [ ] Rename "TDP" column to "Est. Power" (estimated_watts)
- [ ] Update totals row with total_estimated_watts

**Files to modify:**
- `frontend/src/pages/CostsPage.tsx` - Update table structure

#### Step 3.2: Create CategoryBadge component

- [ ] Display category label
- [ ] Show source indicator: "(auto)" or gear icon for user-set
- [ ] Handle null category gracefully

**Files to create:**
- `frontend/src/components/CategoryBadge.tsx`

#### Step 3.3: Update sorting logic

- [ ] Add sorting for category column
- [ ] Add sorting for avg_cpu_percent column
- [ ] Update sortField type union

### Phase 4: Update ServerDetail System Card

**Goal:** Show CPU info and category in server detail view

#### Step 4.1: Update System Information section

- [ ] Add CPU model display
- [ ] Add CPU core count display
- [ ] Add machine category with source badge
- [ ] Add "Change" button to edit category
- [ ] Show estimated cost per day

**Files to modify:**
- `frontend/src/pages/ServerDetail.tsx` - Update System Information card

#### Step 4.2: Integrate PowerEditModal

- [ ] Add state for editing category
- [ ] Open PowerEditModal on "Change" click
- [ ] Handle save and refresh server data

### Phase 5: Handle Unconfigured Servers

**Goal:** Show unconfigured servers in separate section

#### Step 5.1: Update CostsPage layout

- [ ] Filter configured vs unconfigured servers
- [ ] Render unconfigured servers below main table
- [ ] Show "Configure" button for each unconfigured server
- [ ] Open PowerEditModal on Configure click

### Phase 6: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 6.1: Manual Testing

- [ ] Verify cost table shows all new columns
- [ ] Verify category badges show correct source
- [ ] Verify PowerEditModal opens and closes properly
- [ ] Verify category dropdown has all 9 options
- [ ] Verify saving category updates source to "user"
- [ ] Verify ServerDetail shows CPU and category
- [ ] Verify unconfigured servers section works

#### Step 6.2: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Visual check of costs table columns | Pending |
| AC2 | Check badge text shows (auto) or gear | Pending |
| AC3 | Open modal and verify all fields present | Pending |
| AC4 | Count dropdown options = 9 | Pending |
| AC5 | Save category, verify API payload has source | Pending |
| AC6 | Check ServerDetail System card | Pending |
| AC7 | Check unconfigured servers section | Pending |

## Edge Case Handling Plan

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | No category, no TDP | Show "Not configured" with Configure button | Phase 5 |
| 2 | Category but no metrics | Show estimated power based on 50% CPU | Phase 3 |
| 3 | Very long CPU model | Truncate with ellipsis, title attribute for full | Phase 4 |
| 4 | User clears category | Send null category, allow auto-detection | Phase 2 |
| 5 | Save with invalid watts | Validate min 0, max 2000, show error | Phase 2 |
| 6 | Offline server | Show last known values, grey out row | Phase 3 |
| 7 | Zero servers configured | Show helpful empty state message | Phase 5 |
| 8 | Category dropdown with auto-detected | Show "(auto-detected)" suffix on current | Phase 2 |

### Coverage Summary

- Story edge cases: 8
- Handled in plan: 8
- Unhandled: 0

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API schema mismatch | Types fail at runtime | Verify against actual API response first |
| Breaking existing TDP functionality | Users lose cost data | Keep backwards compatibility |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Backend API (US0055) | API | Already implemented, provides new fields |
| Server update endpoint | API | Must support machine_category field |

## Open Questions

- [x] Keep TdpEditModal or replace entirely? → Replace with PowerEditModal

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] TypeScript types match backend schema
- [ ] Edge cases handled
- [ ] Code follows existing patterns
- [ ] No TypeScript errors
- [ ] Manual testing complete
- [ ] Ready for code review

## Notes

The backend already returns the new fields (machine_category, machine_category_label, etc.) but the frontend types are outdated. Primary work is updating types and UI components to use the new data.
