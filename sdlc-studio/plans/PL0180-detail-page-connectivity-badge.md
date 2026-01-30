# PL0180: Detail Page Connectivity Badge - Implementation Plan

> **Status:** Complete
> **Story:** [US0180: Detail Page Connectivity Badge](../stories/US0180-detail-page-connectivity-badge.md)
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-29
> **Completed:** 2026-01-29
> **Language:** TypeScript (React)

## Overview

Add the existing TailscaleBadge component to the ServerDetail page header, next to the server name. This provides visual consistency with the dashboard server cards (US0111) and allows users to see Tailscale connectivity status when viewing server details.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Badge in detail page header | TailscaleBadge appears next to server name when tailscale_hostname is set |
| AC2 | Badge not shown for non-Tailscale servers | No badge when tailscale_hostname is null/empty |
| AC3 | Tooltip works consistently | Hover shows "Connected via Tailscale: {hostname}" |

---

## Technical Context

### Language & Framework
- **Primary Language:** TypeScript
- **Framework:** React 18
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices
- Reuse existing components
- Maintain visual consistency across pages
- Keep changes minimal and focused

### Existing Patterns

**TailscaleBadge Component:** `frontend/src/components/TailscaleBadge.tsx`
- Accepts `tailscaleHostname?: string | null`
- Returns null if hostname is null/empty
- Includes tooltip with hostname
- Uses Lucide `Network` icon

**ServerDetail Page:** `frontend/src/pages/ServerDetail.tsx`
- Line 402: `displayName = server.display_name || server.hostname`
- Lines 408-506: Header section with back button, server name, and action buttons
- Server data has `tailscale_hostname` property

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is a trivial 1 SP story reusing an existing component. The implementation is a single-line addition with clear placement.

### Test Priority
1. Unit test: Badge renders when tailscale_hostname present
2. Unit test: Badge not rendered when tailscale_hostname absent
3. Snapshot comparison with existing dashboard badge styling

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add TailscaleBadge import | `pages/ServerDetail.tsx` | - | [ ] |
| 2 | Add badge to header next to server name | `pages/ServerDetail.tsx` | 1 | [ ] |
| 3 | Write unit tests | `__tests__/pages/ServerDetail.test.tsx` | 2 | [ ] |

---

## Implementation Phases

### Phase 1: Add Badge to Header
**Goal:** Display TailscaleBadge in server detail page header

- [ ] Add import for TailscaleBadge component
- [ ] Wrap server name `<h1>` and badge in flex container
- [ ] Pass `server.tailscale_hostname` to badge

**Files:**
- `frontend/src/pages/ServerDetail.tsx` - Add import and badge

**Code Changes:**

1. Add import (around line 32):
```tsx
import { TailscaleBadge } from '../components/TailscaleBadge';
```

2. Update header section (around line 431-433):
```tsx
// Before:
<h1 className="text-2xl font-bold text-text-primary">
  {displayName}
</h1>

// After:
<div className="flex items-center gap-2">
  <h1 className="text-2xl font-bold text-text-primary">
    {displayName}
  </h1>
  <TailscaleBadge tailscaleHostname={server.tailscale_hostname} />
</div>
```

### Phase 2: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Unit test with tailscale_hostname set | Pending |
| AC2 | Unit test with tailscale_hostname null | Pending |
| AC3 | Manual verification of tooltip | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | tailscale_hostname empty string | TailscaleBadge returns null | Handled by component |
| 2 | Very long hostname | TailscaleBadge truncates in tooltip | Handled by component |

**Coverage:** 2/2 edge cases handled by existing TailscaleBadge component

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Badge styling inconsistent | Low | Using same component as dashboard |
| Layout shift with long names | Low | Use flex with gap, badge has flex-shrink-0 |

---

## Definition of Done

- [ ] Badge appears next to server name for Tailscale servers
- [ ] Badge hidden for non-Tailscale servers
- [ ] Tooltip displays hostname on hover
- [ ] Unit tests passing
- [ ] Visual consistency with dashboard cards

---

## Notes

**Design Decisions:**
1. Badge placed after server name (same pattern as dashboard cards)
2. Reuse TailscaleBadge component unchanged
3. Wrap in flex container for alignment

**Not in this story:**
- SSH badge (future enhancement)
- Badge in widget view header (separate consideration)
