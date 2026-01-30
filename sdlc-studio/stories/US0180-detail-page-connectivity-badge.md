# US0180: Detail Page Connectivity Badge

> **Status:** Done
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 1

## User Story

**As a** Darren (Homelab Operator)
**I want** the Tailscale connectivity badge to appear in the server detail page header
**So that** I can see at a glance whether a server supports remote SSH access

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers on Tailscale. Uses Tailscale for secure remote access and SSH operations.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

US0111 implemented the TailscaleBadge component for server cards on the dashboard. The same badge should appear on the detail page header for consistency, allowing users to see Tailscale connectivity status when viewing server details.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| US0111 | Component | TailscaleBadge already exists | Reuse existing component |
| EP0012 | Layout | Widget-based detail view | Badge goes in page header, not widget |
| PRD | UX | Consistent UI | Same styling as dashboard badge |

---

## Acceptance Criteria

### AC1: Badge in detail page header

- **Given** a server has `tailscale_hostname` set
- **When** I view the server detail page
- **Then** the TailscaleBadge appears next to the server name in the page header
- **And** the badge uses the same styling as on the dashboard

### AC2: Badge not shown for non-Tailscale servers

- **Given** a server has no `tailscale_hostname`
- **When** I view the server detail page
- **Then** no Tailscale badge appears in the header

### AC3: Tooltip works consistently

- **Given** the badge is shown in the header
- **When** I hover over it
- **Then** the tooltip shows "Connected via Tailscale: {hostname}"

---

## Scope

### In Scope

- Add TailscaleBadge to ServerDetail page header
- Same placement pattern as other badges (status, machine type)

### Out of Scope

- New badge styling (reuse US0111 component)
- SSH badge (future enhancement)

---

## Technical Notes

### Implementation

```tsx
// In ServerDetail.tsx header section
import { TailscaleBadge } from '../components/TailscaleBadge';

// Add next to server name/status badges
<div className="flex items-center gap-2">
  <h1>{server.display_name}</h1>
  <StatusBadge status={server.status} />
  <TailscaleBadge tailscaleHostname={server.tailscale_hostname} />
</div>
```

### Files to Modify

- `frontend/src/pages/ServerDetail.tsx` - Add badge to header

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | tailscale_hostname empty string | No badge shown |
| 2 | Very long hostname | Truncated in tooltip (handled by TailscaleBadge) |

---

## Test Scenarios

- [ ] Server with tailscale_hostname shows badge in header
- [ ] Server without tailscale_hostname has no badge
- [ ] Tooltip displays correctly on hover
- [ ] Badge styling matches dashboard cards

---

## Dependencies

### Story Dependencies

| Story | Relationship | Status |
|-------|--------------|--------|
| US0111 | TailscaleBadge component | Done |

---

## Estimation

**Story Points:** 1
**Complexity:** Trivial - reuse existing component

---

## Open Questions

None.

---

## Implementation Artefacts

| Artefact | Link | Status |
|----------|------|--------|
| Plan | [PL0180](../plans/PL0180-detail-page-connectivity-badge.md) | Complete |
| Test Spec | [TS0180](../test-specs/TS0180-detail-page-connectivity-badge.md) | Complete |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation from resolved EP0017 open question |
| 2026-01-29 | Claude | Implementation complete, all tests passing |
