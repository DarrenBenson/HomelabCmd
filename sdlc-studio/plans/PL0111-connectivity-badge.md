# PL0111: Connectivity Badge (Tailscale/SSH) - Implementation Plan

> **Status:** Complete
> **Story:** [US0111: Connectivity Badge (Tailscale/SSH)](../stories/US0111-connectivity-badge.md)
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-28
> **Language:** TypeScript (frontend only)

## Overview

Add a Tailscale connectivity badge to server cards for servers with `tailscale_hostname` configured. This is a frontend-only change as the backend already returns the `tailscale_hostname` field.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Tailscale badge on connected servers | Badge appears when tailscale_hostname is set |
| AC2 | Badge placement and styling | Small, subtle badge in card header |
| AC3 | Tooltip with hostname | Hover shows "Connected via Tailscale: {hostname}" |
| AC4 | No badge for non-Tailscale servers | No badge when tailscale_hostname is null/empty |

---

## Technical Context

### Language & Framework
- **Primary Language:** TypeScript
- **Framework:** React 18
- **Test Framework:** Vitest

### Discovery Finding
- Backend `ServerResponse` already includes `tailscale_hostname: str | None`
- Frontend `Server` interface is missing this field (only in `ServerDetail`)
- No backend changes required

---

## Implementation Tasks

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Add tailscale_hostname to Server interface | `frontend/src/types/server.ts` | [x] |
| 2 | Create TailscaleBadge component | `frontend/src/components/TailscaleBadge.tsx` | [x] |
| 3 | Add TailscaleBadge to ServerCard | `frontend/src/components/ServerCard.tsx` | [x] |
| 4 | Add tests for TailscaleBadge | `frontend/src/components/TailscaleBadge.test.tsx` | [x] |

---

## Implementation Details

### Task 1: Update Server Interface

Add `tailscale_hostname` field to the `Server` interface to match backend response.

### Task 2: TailscaleBadge Component

Create a simple badge component that:
- Returns null if no tailscale_hostname
- Shows Tailscale icon (Network from lucide-react)
- Shows "Tailscale" text
- Has tooltip with full hostname

### Task 3: ServerCard Integration

Add the badge in the header area, after the warning badge.

### Task 4: Unit Tests

Test scenarios from story:
- Server with tailscale_hostname shows badge
- Server without tailscale_hostname has no badge
- Badge tooltip shows correct hostname
- Empty string tailscale_hostname shows no badge

---

## Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| 1 | Empty string hostname | Treat as null, no badge |
| 2 | Very long hostname (>50 chars) | Truncate in tooltip |
| 3 | Icon fails to load | Use lucide-react Network icon |

---

## Definition of Done

- [ ] tailscale_hostname in Server interface
- [ ] TailscaleBadge component created
- [ ] Badge appears in ServerCard for Tailscale servers
- [ ] Tooltip shows hostname on hover
- [ ] Unit tests passing
- [ ] Dark mode styling works
