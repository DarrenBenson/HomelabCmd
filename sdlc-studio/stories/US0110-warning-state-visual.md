# US0110: Warning State Visual Treatment

> **Status:** Done
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** warning states to look visually distinct from offline states
**So that** I can quickly triage servers needing attention vs servers that are down

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers. Needs to quickly identify severity levels at a glance without clicking into each card.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, servers with active alerts (warnings) may not be visually distinct from offline servers. Market leaders use distinct colour hierarchies: green (healthy) > yellow/amber (warning) > red (critical/offline). This story adds visual treatment for the warning state.

The warning state is triggered when a server has active alerts but is still online and responding.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | Colour not sole indicator | Add warning icon alongside colour |
| PRD | Performance | Dashboard load <3s | Alert count must be efficiently fetched |
| TRD | API | Extend server list response | Add active_alert_count field |

---

## Acceptance Criteria

### AC1: Warning state border

- **Given** a server has `status: "online"` AND `active_alert_count > 0`
- **When** the dashboard renders the server card
- **Then** the card displays a yellow/amber border (border-yellow-500)
- **And** the border is distinct from offline red and healthy green

### AC2: Warning badge with count

- **Given** a server has `active_alert_count > 0`
- **When** the dashboard renders the server card
- **Then** a warning badge appears showing the count (e.g., "3 alerts")
- **And** the badge uses yellow/amber background (bg-yellow-500)

### AC3: Status LED for warning

- **Given** a server has `status: "online"` AND `active_alert_count > 0`
- **When** the dashboard renders the server card
- **Then** the status LED shows yellow/amber colour
- **And** the LED tooltip shows "Warning - {count} active alerts"

### AC4: Backend provides alert count

- **Given** a request to `GET /api/v1/servers`
- **When** the response is returned
- **Then** each server object includes `active_alert_count: number`
- **And** the count reflects alerts with `status: "active"` for that server

### AC5: Tooltip with alert summary

- **Given** a server has `active_alert_count > 0`
- **When** the user hovers over the warning badge
- **Then** a tooltip shows summary: "3 active alerts: CPU high, Memory high, Disk warning"
- **And** maximum 3 alerts shown, with "+N more" if exceeded

---

## Scope

### In Scope

- Yellow/amber border for warning state cards
- Warning badge showing alert count
- Status LED yellow colour for warning state
- Backend endpoint enhancement to include alert count
- Tooltip showing alert summary on hover

### Out of Scope

- Alert management from dashboard (existing feature)
- Alert severity breakdown in badge
- Alert auto-resolution
- Warning state for workstations (follow-on from EP0009)

---

## Technical Notes

### Implementation Approach

1. **Backend (servers.py):**
   - Add `active_alert_count` to server serialisation
   - Query alerts table for count per server
   - Optionally include alert summaries (type + message)

2. **API Response Enhancement:**
   ```python
   class ServerResponse(BaseModel):
       # ... existing fields ...
       active_alert_count: int = 0
       active_alert_summaries: list[str] = []  # For tooltip
   ```

3. **Frontend (ServerCard.tsx):**
   - Derive warning state from `active_alert_count > 0`
   - Add conditional border class
   - Add warning badge component

4. **StatusLED update:**
   - Add "warning" as valid status
   - Map to yellow colour

### API Contracts

**Request:** `GET /api/v1/servers`

**Response (updated):**
```json
{
  "servers": [
    {
      "id": "uuid",
      "server_id": "homeserver",
      "status": "online",
      "active_alert_count": 3,
      "active_alert_summaries": ["CPU usage high", "Memory above 80%", "Disk space low"]
    }
  ]
}
```

### Files to Modify

- `backend/src/homelab_cmd/api/routes/servers.py` - Add alert count
- `backend/src/homelab_cmd/api/schemas/servers.py` - Update response schema
- `frontend/src/components/ServerCard.tsx` - Add warning visual
- `frontend/src/components/StatusLED.tsx` - Add warning state
- `frontend/src/types/server.ts` - Update type definition

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Server offline with alerts | Show offline (red) not warning (yellow) |
| 2 | Alert resolved while viewing | Card updates on next refresh/poll |
| 3 | 0 active alerts | No warning styling, normal green |
| 4 | 100+ active alerts | Show "99+" in badge |
| 5 | Alert query fails | Log error, return count as 0 |
| 6 | Server paused with alerts | Show maintenance styling, not warning |

---

## Test Scenarios

- [x] Server with active alerts shows yellow border
- [x] Warning badge displays correct count
- [x] Status LED shows yellow for warning state
- [x] API returns active_alert_count
- [x] Offline server with alerts shows red (not yellow)
- [x] Paused server with alerts shows amber maintenance
- [x] Tooltip shows alert summaries
- [x] Dark mode renders correctly

---

## Dependencies

### Story Dependencies

None - can be implemented independently.

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Alert model with status field | Data | Done |
| Server-Alert relationship | Data | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - requires backend change + frontend update

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0017 |
