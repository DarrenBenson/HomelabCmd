# PL0115: Server Card Quick Actions - Implementation Plan

> **Status:** Draft
> **Story:** [US0115: Server Card Quick Actions](../stories/US0115-server-card-quick-actions.md)
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (Frontend)

## Overview

Add a quick action bar to server cards that appears on hover. Contains toggle pause, SSH (for Tailscale servers), and view details buttons with keyboard accessibility.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Hover visibility | Action bar appears on card hover |
| AC2 | Toggle pause | Pause/unpause with API call and notification |
| AC3 | SSH action | Copy SSH command to clipboard (Tailscale only) |
| AC4 | View details | Navigate to server detail page |
| AC5 | Keyboard accessibility | Tab navigation, Enter activation, Escape hide |
| AC6 | Non-Tailscale handling | SSH disabled/hidden without Tailscale |

---

## Technical Context

### Language & Framework
- **Primary Language:** TypeScript
- **Framework:** React 19
- **Test Framework:** Vitest + Testing Library
- **Icons:** lucide-react

### Existing Patterns
- `pauseServer`/`unpauseServer` API functions exist
- Dashboard uses `restartMessage` state for notifications
- Server cards have onClick for navigation

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create CardQuickActions component | `CardQuickActions.tsx` | - | [ ] |
| 2 | Integrate into ServerCard with hover | `ServerCard.tsx` | 1 | [ ] |
| 3 | Add pause toggle handler in Dashboard | `Dashboard.tsx` | 2 | [ ] |
| 4 | Add tests | `CardQuickActions.test.tsx` | 1 | [ ] |

---

## Implementation Details

### CardQuickActions Props

```typescript
interface CardQuickActionsProps {
  server: Server;
  onPauseToggle: (serverId: string, isPaused: boolean) => void;
  onNavigate: (path: string) => void;
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
  visible: boolean;
}
```

### Button Configuration

| Action | Icon | Label | Condition | Handler |
|--------|------|-------|-----------|---------|
| Toggle pause | Pause/Play | Pause/Resume | Always | API + callback |
| SSH | Terminal | SSH | tailscale_hostname set | Copy to clipboard |
| Details | ChevronRight | Details | Always | Navigate |

---

## Edge Case Handling

| # | Edge Case | Strategy |
|---|-----------|----------|
| 1 | API failure on toggle | Show error notification, no state change |
| 2 | Clipboard unavailable | Show fallback with manual copy |
| 3 | Rapid toggle clicks | Disable button during API call |

---

## Definition of Done

- [ ] Action bar appears on hover
- [ ] Toggle pause works with notification
- [ ] SSH copies command (Tailscale only)
- [ ] Details navigates correctly
- [ ] Keyboard navigation works
- [ ] Tests passing
