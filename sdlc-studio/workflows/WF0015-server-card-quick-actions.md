# WF0015: Server Card Quick Actions

> **Status:** Done
> **Story:** [US0115: Server Card Quick Actions](../stories/US0115-server-card-quick-actions.md)
> **Plan:** [PL0115: Server Card Quick Actions](../plans/PL0115-server-card-quick-actions.md)
> **Created:** 2026-01-28
> **Approach:** Test-After

## Current Phase

**Phase 8: Review** (Complete)

## Phase Progress

| Phase | Name | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | Plan | Done | 2026-01-28 | 2026-01-28 |
| 2 | Test Spec | Skipped | - | - |
| 3 | Implementation | Done | 2026-01-28 | 2026-01-28 |
| 4 | Tests | Done | 2026-01-28 | 2026-01-28 |
| 5 | Test | Done | 2026-01-28 | 2026-01-28 |
| 6 | Verify | Done | 2026-01-28 | 2026-01-28 |
| 7 | Check | Done | 2026-01-28 | 2026-01-28 |
| 8 | Review | Done | 2026-01-28 | 2026-01-28 |

## Session Log

### Session 1 - 2026-01-28

- Created workflow WF0015 and plan PL0115
- Initial implementation with hover-based action bar (CardQuickActions)
- User feedback: simpler approach preferred
- Refactored to inline pause/play button in footer
- Removed CardQuickActions component
- Updated Dashboard with message handling
- All 66 ServerCard tests passing
- Built and deployed locally

## Implementation Summary

### Final Approach

Simple inline pause/play toggle button in the card footer, next to uptime. No hover popout needed since:
- Clicking the card navigates to details (AC4 covered)
- SSH copy removed (not essential for quick access)
- Single action button is cleaner UX

### Files Modified
- `frontend/src/components/ServerCard.tsx` - Added pause/play button in footer
- `frontend/src/pages/Dashboard.tsx` - Added message state and refresh handler

### Files Removed
- `frontend/src/components/CardQuickActions.tsx` - Not needed
- `frontend/src/components/CardQuickActions.test.tsx` - Not needed

### Acceptance Criteria Coverage

| AC | Description | Status |
|----|-------------|--------|
| AC1 | Quick actions appear on hover | Simplified: inline button always visible |
| AC2 | Toggle pause action | Done (button in footer) |
| AC3 | SSH action (Tailscale) | Removed (navigate to detail for SSH) |
| AC4 | View details action | Done (card click) |
| AC5 | Keyboard accessibility | Done (button focusable) |
| AC6 | Non-Tailscale SSH handling | N/A (SSH removed) |

## Technical Notes

### Button Location

Footer layout: `[Play/Pause] ↑ 5d 2h | updates info`

- Pause icon (grey) when server is running
- Play icon (green) when server is paused
- Hidden for inactive servers
- Stops event propagation to prevent card click
