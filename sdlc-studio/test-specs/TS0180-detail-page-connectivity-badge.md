# TS0180: Detail Page Connectivity Badge

> **Status:** Complete
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for the TailscaleBadge addition to the ServerDetail page header. Validates that the badge appears correctly for Tailscale-connected servers and is hidden for others.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0180](../stories/US0180-detail-page-connectivity-badge.md) | Detail Page Connectivity Badge | P2 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0180 | AC1 | Badge in detail page header | TC01 | Pending |
| US0180 | AC2 | Badge not shown for non-Tailscale servers | TC02 | Pending |
| US0180 | AC3 | Tooltip works consistently | TC03 | Pending |

**Coverage:** 3/3 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Test component rendering with mock server data |
| Integration | No | No API changes, component already tested |
| E2E | No | Visual change only, covered by unit tests |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js 18+, Vitest, React Testing Library |
| External Services | None |
| Test Data | Mock server objects with/without tailscale_hostname |

---

## Test Cases

### TC01: Badge renders for Tailscale server

**Type:** Unit | **Priority:** P0 | **Story:** US0180/AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with tailscale_hostname "my-server.tail12345.ts.net" | Server data includes hostname |
| When | ServerDetail page renders | Component mounts |
| Then | TailscaleBadge is visible in the header | Badge appears next to server name |

**Assertions:**
- [ ] Element with data-testid="tailscale-badge" exists
- [ ] Badge is within the header section
- [ ] Badge text contains "Tailscale"

---

### TC02: Badge hidden for non-Tailscale server

**Type:** Unit | **Priority:** P0 | **Story:** US0180/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with tailscale_hostname as null | Server data has no Tailscale |
| When | ServerDetail page renders | Component mounts |
| Then | TailscaleBadge is not rendered | No badge in header |

**Assertions:**
- [ ] Element with data-testid="tailscale-badge" does not exist
- [ ] Header still renders correctly without badge

---

### TC03: Tooltip displays hostname on hover

**Type:** Unit | **Priority:** P1 | **Story:** US0180/AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with tailscale_hostname "my-server.tail12345.ts.net" | Server has Tailscale |
| When | User hovers over the badge | Tooltip triggered |
| Then | Tooltip shows "Connected via Tailscale: my-server.tail12345.ts.net" | Full hostname in tooltip |

**Assertions:**
- [ ] Badge element has title attribute
- [ ] Title contains "Connected via Tailscale:"
- [ ] Title contains the hostname

---

### TC04: Badge hidden for empty string hostname

**Type:** Unit | **Priority:** P1 | **Story:** US0180/AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with tailscale_hostname as empty string "" | Edge case |
| When | ServerDetail page renders | Component mounts |
| Then | TailscaleBadge is not rendered | Treated same as null |

**Assertions:**
- [ ] Element with data-testid="tailscale-badge" does not exist

---

## Fixtures

```typescript
// Mock server with Tailscale
const serverWithTailscale = {
  id: '123',
  hostname: 'test-server',
  display_name: 'Test Server',
  status: 'online',
  tailscale_hostname: 'test-server.tail12345.ts.net',
  // ... other required fields
};

// Mock server without Tailscale
const serverWithoutTailscale = {
  id: '456',
  hostname: 'local-server',
  display_name: 'Local Server',
  status: 'online',
  tailscale_hostname: null,
  // ... other required fields
};

// Mock server with empty Tailscale hostname
const serverEmptyTailscale = {
  id: '789',
  hostname: 'empty-server',
  display_name: 'Empty Server',
  status: 'online',
  tailscale_hostname: '',
  // ... other required fields
};
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Badge renders for Tailscale server | Complete | `ServerDetail.test.tsx` |
| TC02 | Badge hidden for non-Tailscale server | Complete | `ServerDetail.test.tsx` |
| TC03 | Tooltip displays hostname | Complete | `ServerDetail.test.tsx` |
| TC04 | Badge hidden for empty string | Complete | `ServerDetail.test.tsx` |

**4/4 test cases automated (100%)**

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0180: Detail Page Connectivity Badge](../plans/PL0180-detail-page-connectivity-badge.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
| 2026-01-29 | Claude | All 4 test cases automated and passing |
