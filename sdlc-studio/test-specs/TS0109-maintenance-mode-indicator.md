# TS0109: Enhanced Maintenance Mode Indicator

> **Status:** Complete
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Created:** 2026-01-28
> **Last Updated:** 2026-01-28

## Overview

Test specification for the enhanced maintenance mode indicator feature. Covers visual styling changes to ServerCard and StatusLED components when a server has `is_paused: true`.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0109](../stories/US0109-maintenance-mode-indicator.md) | Enhanced Maintenance Mode Indicator | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0109 | AC1 | Border glow when paused | TC01, TC02 | Pending |
| US0109 | AC2 | Wrench icon when paused | TC03, TC04 | Pending |
| US0109 | AC3 | Tooltip on icon hover | TC05 | Pending |
| US0109 | AC4 | Status LED neutral colour | TC06, TC07 | Pending |

**Coverage:** 4/4 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Component rendering and conditional logic |
| Integration | No | No API or cross-component state changes |
| E2E | No | Visual styling; unit tests sufficient |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Node.js 18+, npm install completed |
| External Services | None |
| Test Data | Mock Server objects with `is_paused: boolean` |

---

## Test Cases

### TC01: Paused server shows amber border glow

**Type:** Unit | **Priority:** High | **Story:** US0109 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with `is_paused: true` and `is_inactive: false` | Server object created |
| When | ServerCard component renders | Component mounted |
| Then | Card has `ring-2 ring-amber-500/50 border-amber-500` classes | Classes present in className |

**Assertions:**
- [ ] Card container has class `ring-2`
- [ ] Card container has class `ring-amber-500/50`
- [ ] Card container has class `border-amber-500`

---

### TC02: Non-paused server has no maintenance border

**Type:** Unit | **Priority:** High | **Story:** US0109 AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with `is_paused: false` | Server object created |
| When | ServerCard component renders | Component mounted |
| Then | Card does not have amber ring classes | Classes absent from className |

**Assertions:**
- [ ] Card container does not have class `ring-amber-500/50`
- [ ] Card container does not have class `border-amber-500`

---

### TC03: Paused server shows Wrench icon

**Type:** Unit | **Priority:** High | **Story:** US0109 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with `is_paused: true` and `is_inactive: false` | Server object created |
| When | ServerCard component renders | Component mounted |
| Then | Wrench icon is rendered with amber colour | Icon visible with text-amber-500 class |

**Assertions:**
- [ ] Element with Wrench icon is present in DOM
- [ ] Wrench icon has class `text-amber-500`
- [ ] Wrench icon has `aria-hidden="true"` for accessibility

---

### TC04: Non-paused server has no Wrench icon

**Type:** Unit | **Priority:** High | **Story:** US0109 AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with `is_paused: false` | Server object created |
| When | ServerCard component renders | Component mounted |
| Then | No Wrench icon is rendered | Icon not in DOM |

**Assertions:**
- [ ] No element matching Wrench icon in DOM

---

### TC05: Wrench icon has tooltip

**Type:** Unit | **Priority:** Medium | **Story:** US0109 AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with `is_paused: true` | Server object created |
| When | ServerCard component renders | Component mounted |
| Then | Wrench icon has title attribute | Tooltip text present |

**Assertions:**
- [ ] Wrench icon element has `title` attribute
- [ ] Title value is "Maintenance mode - monitoring paused"

---

### TC06: StatusLED shows neutral colour when paused

**Type:** Unit | **Priority:** High | **Story:** US0109 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | StatusLED with `isPaused: true` | Props configured |
| When | Component renders | Component mounted |
| Then | LED has amber/grey background class | Neutral colour displayed |

**Assertions:**
- [ ] LED element has class `bg-amber-500/50` OR `bg-text-muted`
- [ ] LED element does NOT have class `bg-status-success`
- [ ] LED element does NOT have class `bg-status-error`

---

### TC07: StatusLED tooltip shows "Paused" when paused

**Type:** Unit | **Priority:** Medium | **Story:** US0109 AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | StatusLED with `isPaused: true` | Props configured |
| When | Component renders | Component mounted |
| Then | LED has title "Paused" | Tooltip text correct |

**Assertions:**
- [ ] LED element has `title` attribute value "Paused"
- [ ] aria-label includes "paused"

---

### TC08: Paused and offline shows maintenance styling (Edge Case 1)

**Type:** Unit | **Priority:** Medium | **Story:** US0109

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with `is_paused: true` AND `status: 'offline'` | Server object created |
| When | ServerCard component renders | Component mounted |
| Then | Maintenance indicators shown, not offline styling | Amber border and Wrench icon present |

**Assertions:**
- [ ] Card has amber ring classes
- [ ] Wrench icon is present
- [ ] StatusLED does NOT have `bg-status-error` class

---

### TC09: Paused and inactive shows inactive styling only (Edge Case)

**Type:** Unit | **Priority:** Medium | **Story:** US0109

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | A server with `is_paused: true` AND `is_inactive: true` | Server object created |
| When | ServerCard component renders | Component mounted |
| Then | Inactive styling takes precedence | No maintenance border, grayscale applied |

**Assertions:**
- [ ] Card does NOT have amber ring classes
- [ ] Wrench icon is NOT present
- [ ] Card has `opacity-50 grayscale` classes

---

## Fixtures

```yaml
pausedServer:
  id: "test-paused-server"
  hostname: "paused-host"
  display_name: "Paused Server"
  status: "online"
  is_paused: true
  is_inactive: false
  machine_type: "server"
  latest_metrics:
    cpu_percent: 25
    memory_percent: 50
    disk_percent: 30
    uptime_seconds: 86400

nonPausedServer:
  id: "test-active-server"
  hostname: "active-host"
  display_name: "Active Server"
  status: "online"
  is_paused: false
  is_inactive: false
  machine_type: "server"
  latest_metrics:
    cpu_percent: 45
    memory_percent: 60
    disk_percent: 40
    uptime_seconds: 172800

pausedOfflineServer:
  id: "test-paused-offline"
  hostname: "paused-offline-host"
  display_name: "Paused Offline Server"
  status: "offline"
  is_paused: true
  is_inactive: false
  machine_type: "server"
  latest_metrics: null

inactivePausedServer:
  id: "test-inactive-paused"
  hostname: "inactive-host"
  display_name: "Inactive Server"
  status: "offline"
  is_paused: true
  is_inactive: true
  machine_type: "server"
  latest_metrics: null
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC01 | Paused server shows amber border glow | Pending | - |
| TC02 | Non-paused server has no maintenance border | Pending | - |
| TC03 | Paused server shows Wrench icon | Pending | - |
| TC04 | Non-paused server has no Wrench icon | Pending | - |
| TC05 | Wrench icon has tooltip | Pending | - |
| TC06 | StatusLED shows neutral colour when paused | Pending | - |
| TC07 | StatusLED tooltip shows "Paused" when paused | Pending | - |
| TC08 | Paused and offline shows maintenance styling | Pending | - |
| TC09 | Paused and inactive shows inactive styling only | Pending | - |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0017](../epics/EP0017-desktop-ux-improvements.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0109](../plans/PL0109-maintenance-mode-indicator.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial spec |
