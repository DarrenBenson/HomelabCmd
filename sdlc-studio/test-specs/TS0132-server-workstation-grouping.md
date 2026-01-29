# TS0132: Server and Workstation Grouping

> **Status:** Draft
> **Epic:** [EP0011: Advanced Dashboard UI](../epics/EP0011-advanced-dashboard-ui.md)
> **Created:** 2026-01-28
> **Last Updated:** 2026-01-28

## Overview

Test specification for server and workstation grouping on the dashboard. Covers section headers with counts, per-section drag-and-drop, collapsible sections with persistence, empty section messaging, and fixed section ordering.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0132](../stories/US0132-server-workstation-grouping.md) | Server and Workstation Grouping | P0 |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0132 | AC1 | Section headers displayed | TC01, TC02 | Pending |
| US0132 | AC2 | Section counts in headers | TC03, TC04, TC05 | Pending |
| US0132 | AC3 | Reorder within section only | TC06, TC07, TC08 | Pending |
| US0132 | AC4 | Collapsible sections | TC09, TC10, TC11 | Pending |
| US0132 | AC5 | Collapse state persisted | TC12, TC13, TC14 | Pending |
| US0132 | AC6 | Empty section message | TC15, TC16 | Pending |
| US0132 | AC7 | Section order fixed | TC17 | Pending |

**Coverage:** 7/7 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | MachineSection component, API client |
| Integration | Yes | Dashboard with sections, API endpoints |
| E2E | Optional | Full collapse-persist-refresh flow |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js 18+, Python 3.11+, npm/pip install completed |
| External Services | None |
| Test Data | Mock Server objects with machine_type field |
| Database | SQLite test database (backend) |

---

## Test Cases

### TC01: Servers section header displayed

**Type:** Unit | **Priority:** High | **Story:** US0132 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with servers and workstations | Data loaded |
| When | Dashboard renders | Component mounts |
| Then | "Servers" section header is visible | Header displayed |
| And | Header has Server icon | Icon rendered |

**Assertions:**
- [ ] Section header contains text "Servers"
- [ ] Server icon (lucide-react Server) is displayed
- [ ] Header is clickable (button element)
- [ ] data-testid="section-header-servers" exists

---

### TC02: Workstations section header displayed

**Type:** Unit | **Priority:** High | **Story:** US0132 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with servers and workstations | Data loaded |
| When | Dashboard renders | Component mounts |
| Then | "Workstations" section header is visible | Header displayed |
| And | Header has Monitor icon | Icon rendered |

**Assertions:**
- [ ] Section header contains text "Workstations"
- [ ] Monitor icon (lucide-react Monitor) is displayed
- [ ] Header is clickable (button element)
- [ ] data-testid="section-header-workstations" exists

---

### TC03: Section counts show online and offline

**Type:** Unit | **Priority:** High | **Story:** US0132 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 8 servers (7 online, 1 offline) | Server data set |
| And | 3 workstations (1 online, 2 offline) | Workstation data set |
| When | Dashboard renders | Component mounts |
| Then | Servers header shows "(7 online, 1 offline)" | Counts correct |
| And | Workstations header shows "(1 online, 2 offline)" | Counts correct |

**Assertions:**
- [ ] Server count text matches exactly "(7 online, 1 offline)"
- [ ] Workstation count text matches exactly "(1 online, 2 offline)"
- [ ] Counts rendered in text-tertiary colour

---

### TC04: Counts update on status change

**Type:** Integration | **Priority:** Medium | **Story:** US0132 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Servers section shows "(3 online, 0 offline)" | Initial state |
| When | Server status changes from online to offline | Data update |
| Then | Header updates to "(2 online, 1 offline)" | Count reflects change |

**Assertions:**
- [ ] Count updates without page refresh
- [ ] Animation or transition is smooth
- [ ] No flicker during update

---

### TC05: Zero counts display correctly

**Type:** Unit | **Priority:** Medium | **Story:** US0132 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | 0 servers registered | Empty server list |
| When | Dashboard renders | Component mounts |
| Then | Servers header shows "(0 online, 0 offline)" | Zero counts displayed |

**Assertions:**
- [ ] Text shows "(0 online, 0 offline)" not "()" or blank
- [ ] Section header still visible
- [ ] Empty message shown in section body

---

### TC06: Drag within server section works

**Type:** Integration | **Priority:** High | **Story:** US0132 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Servers section with cards A, B, C | Cards in order |
| When | User drags card A to position after B | Drag operation |
| Then | Cards reorder to B, A, C | Order updated |
| And | Save is triggered with new order | API called |

**Assertions:**
- [ ] Cards visually reorder during drag
- [ ] Drop zone highlights in valid position
- [ ] onReorder callback called with ["B", "A", "C"]
- [ ] No cross-section movement possible

---

### TC07: Drag within workstation section works

**Type:** Integration | **Priority:** High | **Story:** US0132 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstations section with cards X, Y | Cards in order |
| When | User drags card Y to position before X | Drag operation |
| Then | Cards reorder to Y, X | Order updated |

**Assertions:**
- [ ] Cards visually reorder
- [ ] onReorder callback called with ["Y", "X"]
- [ ] Separate from server section order

---

### TC08: Cross-section drag prevented

**Type:** Integration | **Priority:** High | **Story:** US0132 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server card being dragged | Drag in progress |
| When | User moves towards Workstations section | Drag continues |
| Then | No drop zone appears in Workstations | Drop blocked |
| And | Card returns to original position on release | Reset position |

**Assertions:**
- [ ] Separate DndContext per section (natural prevention)
- [ ] No visual indication of valid drop in other section
- [ ] Card order unchanged if dropped outside section

---

### TC09: Section collapses on header click

**Type:** Unit | **Priority:** High | **Story:** US0132 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstations section expanded | Cards visible |
| When | User clicks section header | Click event |
| Then | Section collapses | Cards hidden |
| And | Chevron rotates to right | Icon animates |

**Assertions:**
- [ ] Cards no longer visible after collapse
- [ ] Chevron has class rotate-0 (or no rotate-90)
- [ ] aria-expanded="false" on button
- [ ] Transition is 200ms

---

### TC10: Section expands on second header click

**Type:** Unit | **Priority:** High | **Story:** US0132 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstations section collapsed | Cards hidden |
| When | User clicks section header again | Click event |
| Then | Section expands | Cards visible |
| And | Chevron rotates to down | Icon animates |

**Assertions:**
- [ ] Cards visible after expand
- [ ] Chevron has class rotate-90
- [ ] aria-expanded="true" on button
- [ ] Smooth transition

---

### TC11: Keyboard accessibility for collapse

**Type:** Unit | **Priority:** Medium | **Story:** US0132 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Focus on section header button | Keyboard navigation |
| When | User presses Enter or Space | Key event |
| Then | Section toggles collapsed state | State changes |

**Assertions:**
- [ ] Enter key toggles collapse
- [ ] Space key toggles collapse
- [ ] Focus remains on header after toggle

---

### TC12: PUT collapsed-sections saves state

**Type:** Unit (Backend) | **Priority:** High | **Story:** US0132 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Valid API key | Authenticated |
| When | PUT /api/v1/preferences/collapsed-sections called | Request sent |
| And | Body: { "collapsed": ["workstations"] } | Payload provided |
| Then | Response status 200 | Success |
| And | Response contains timestamp | Confirmation |

**Assertions:**
- [ ] HTTP 200 returned
- [ ] Response contains "status": "saved"
- [ ] Config table updated with collapsed state
- [ ] GET returns same collapsed list

---

### TC13: GET collapsed-sections returns saved state

**Type:** Unit (Backend) | **Priority:** High | **Story:** US0132 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Saved state: ["workstations"] | State in database |
| When | GET /api/v1/preferences/collapsed-sections | Request sent |
| Then | Response: { "collapsed": ["workstations"] } | State returned |

**Assertions:**
- [ ] HTTP 200 returned
- [ ] Response contains "collapsed" array
- [ ] Array matches saved value

---

### TC14: Collapse state restored on page load

**Type:** Integration | **Priority:** High | **Story:** US0132 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Workstations section collapsed and saved | State persisted |
| When | User refreshes page | Page reload |
| Then | Workstations section renders collapsed | State restored |
| And | Servers section state also preserved | Both sections correct |

**Assertions:**
- [ ] getCollapsedSections called on mount
- [ ] Workstations section has collapsed=true
- [ ] Servers section has collapsed=false (if not saved)
- [ ] No flash of expanded content before collapse

---

### TC15: Empty section shows message

**Type:** Unit | **Priority:** High | **Story:** US0132 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No workstations registered | Empty workstation list |
| When | Dashboard renders | Component mounts |
| Then | Workstations section shows "No workstations registered" | Message displayed |

**Assertions:**
- [ ] Message text exact: "No workstations registered."
- [ ] data-testid="empty-section-workstations" exists
- [ ] Section header still shows count "(0 online, 0 offline)"

---

### TC16: Empty section has discovery link

**Type:** Unit | **Priority:** Medium | **Story:** US0132 AC6

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Empty workstations section displayed | Message visible |
| When | User views message | UI rendered |
| Then | "Discover devices" link is visible | Link displayed |
| And | Link navigates to /discovery | Correct href |

**Assertions:**
- [ ] Link text is "Discover devices"
- [ ] Link href is "/discovery"
- [ ] Link has hover styling (text-status-info)

---

### TC17: Servers section appears before Workstations

**Type:** Integration | **Priority:** High | **Story:** US0132 AC7

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Dashboard with both machine types | Data loaded |
| When | Dashboard renders | Component mounts |
| Then | Servers section DOM node precedes Workstations | Order fixed |

**Assertions:**
- [ ] Servers section appears first in DOM order
- [ ] Visual order matches DOM order
- [ ] Order is not affected by data order
- [ ] No user configuration to change section order

---

### TC18: PUT section-order saves per-section orders

**Type:** Unit (Backend) | **Priority:** High | **Story:** US0132 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Valid API key | Authenticated |
| When | PUT /api/v1/preferences/section-order called | Request sent |
| And | Body: { "servers": ["s1", "s2"], "workstations": ["w1"] } | Payload |
| Then | Response status 200 | Success |

**Assertions:**
- [ ] HTTP 200 returned
- [ ] Both sections stored separately
- [ ] GET returns same structure

---

### TC19: GET section-order returns per-section orders

**Type:** Unit (Backend) | **Priority:** High | **Story:** US0132 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Saved section orders | Data in database |
| When | GET /api/v1/preferences/section-order | Request sent |
| Then | Response contains servers and workstations arrays | Structure correct |

**Assertions:**
- [ ] HTTP 200 returned
- [ ] Response has "servers" array
- [ ] Response has "workstations" array
- [ ] Empty arrays if no order saved

---

### TC20: Auth required for preferences endpoints

**Type:** Unit (Backend) | **Priority:** High | **Story:** US0132 AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | No API key provided | Missing auth |
| When | PUT /api/v1/preferences/collapsed-sections | Request sent |
| Then | Response status 401 | Unauthorised |

**Assertions:**
- [ ] HTTP 401 for PUT section-order without auth
- [ ] HTTP 401 for GET section-order without auth
- [ ] HTTP 401 for PUT collapsed-sections without auth
- [ ] HTTP 401 for GET collapsed-sections without auth

---

## Fixtures

```yaml
mockServers:
  - id: "server-a"
    hostname: "alpha"
    display_name: "Alpha Server"
    status: "online"
    machine_type: "server"
    is_inactive: false
    active_alert_count: 0

  - id: "server-b"
    hostname: "beta"
    display_name: "Beta Server"
    status: "online"
    machine_type: "server"
    is_inactive: false
    active_alert_count: 0

  - id: "server-c"
    hostname: "gamma"
    display_name: "Gamma Server"
    status: "offline"
    machine_type: "server"
    is_inactive: false
    active_alert_count: 0

  - id: "workstation-1"
    hostname: "desktop-1"
    display_name: "Study PC"
    status: "online"
    machine_type: "workstation"
    is_inactive: false
    active_alert_count: 0

  - id: "workstation-2"
    hostname: "laptop-1"
    display_name: "Work Laptop"
    status: "offline"
    machine_type: "workstation"
    is_inactive: false
    active_alert_count: 0

sectionOrders:
  default:
    servers: ["server-a", "server-b", "server-c"]
    workstations: ["workstation-1", "workstation-2"]
  reordered:
    servers: ["server-c", "server-a", "server-b"]
    workstations: ["workstation-2", "workstation-1"]
  empty:
    servers: []
    workstations: []

collapsedStates:
  none: { collapsed: [] }
  workstations: { collapsed: ["workstations"] }
  both: { collapsed: ["servers", "workstations"] }
```

---

## Mock Setup

### Backend Test Setup

```python
import pytest
from httpx import AsyncClient, ASGITransport
from homelab_cmd.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.fixture
def auth_headers():
    return {"X-API-Key": "test-api-key"}
```

### Frontend API Mock

```typescript
import { vi } from 'vitest';
import * as preferencesApi from '../api/preferences';

vi.mock('../api/preferences', () => ({
  getSectionOrder: vi.fn(),
  saveSectionOrder: vi.fn(),
  getCollapsedSections: vi.fn(),
  saveCollapsedSections: vi.fn(),
}));

// Setup for success
vi.mocked(preferencesApi.getSectionOrder).mockResolvedValue({
  servers: ['server-a', 'server-b'],
  workstations: ['workstation-1'],
});
vi.mocked(preferencesApi.getCollapsedSections).mockResolvedValue({
  collapsed: ['workstations'],
});
```

### MachineSection Component Mock

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MachineSection } from './MachineSection';
import { MemoryRouter } from 'react-router-dom';

const mockServers = [
  { id: 'server-a', hostname: 'alpha', status: 'online', machine_type: 'server' },
  { id: 'server-b', hostname: 'beta', status: 'offline', machine_type: 'server' },
];

function renderSection(props = {}) {
  return render(
    <MemoryRouter>
      <MachineSection
        title="Servers"
        type="server"
        machines={mockServers}
        collapsed={false}
        onToggleCollapse={vi.fn()}
        onReorder={vi.fn()}
        onCardClick={vi.fn()}
        onPauseToggle={vi.fn()}
        onMessage={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Servers section header displayed | Pending | - |
| TC02 | Workstations section header displayed | Pending | - |
| TC03 | Section counts show online and offline | Pending | - |
| TC04 | Counts update on status change | Pending | - |
| TC05 | Zero counts display correctly | Pending | - |
| TC06 | Drag within server section works | Pending | - |
| TC07 | Drag within workstation section works | Pending | - |
| TC08 | Cross-section drag prevented | Pending | - |
| TC09 | Section collapses on header click | Pending | - |
| TC10 | Section expands on second header click | Pending | - |
| TC11 | Keyboard accessibility for collapse | Pending | - |
| TC12 | PUT collapsed-sections saves state | Pending | - |
| TC13 | GET collapsed-sections returns saved state | Pending | - |
| TC14 | Collapse state restored on page load | Pending | - |
| TC15 | Empty section shows message | Pending | - |
| TC16 | Empty section has discovery link | Pending | - |
| TC17 | Servers section appears before Workstations | Pending | - |
| TC18 | PUT section-order saves per-section orders | Pending | - |
| TC19 | GET section-order returns per-section orders | Pending | - |
| TC20 | Auth required for preferences endpoints | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0011](../epics/EP0011-advanced-dashboard-ui.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0132](../plans/PL0132-server-workstation-grouping.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial spec |
