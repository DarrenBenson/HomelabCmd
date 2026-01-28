# US0110: Warning State Visual Treatment

> **Status:** Ready
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** system administrator
**I want** warning states to be visually distinct from offline states
**So that** I can differentiate between "needs attention" and "completely down"

## Context

### Persona Reference
**System Administrator** - Manages homelab infrastructure, needs quick visual status assessment
[Full persona details](../personas.md#system-administrator)

### Background

Currently the ServerStatus type only has `online`, `offline`, and `unknown`. There is no visual distinction for warning states (e.g., high CPU, low disk space, pending security updates). The status LED shows red for offline, but warnings use the same treatment or no treatment at all.

This story adds a warning state visual treatment to the card border, making it easy to identify servers that need attention but are still operational.

**Note:** This story focuses on the **visual treatment** when a warning condition exists. The logic for determining what constitutes a "warning" (thresholds) is already implemented in the alerting system.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | WCAG 2.1 AA | Must use icon + colour, not colour alone |
| PRD | Performance | Dashboard <3s load | Efficient status calculation |

---

## Acceptance Criteria

### AC1: Warning Border Treatment
- **Given** a server with active alerts of severity "warning" or higher
- **When** the ServerCard is rendered
- **Then** the card displays a yellow/amber left border (instead of default blue for servers)

### AC2: Alert Triangle Icon
- **Given** a server with active alerts
- **When** the ServerCard is rendered
- **Then** an alert triangle icon (⚠️ or Lucide `AlertTriangle`) appears in the header

### AC3: Alert Count Badge
- **Given** a server with 3 active alerts
- **When** the ServerCard is rendered
- **Then** a small badge shows "3" next to the alert icon

### AC4: Tooltip with Alert Summary
- **Given** a server with active alerts
- **When** the user hovers over the alert indicator
- **Then** a tooltip shows brief alert summary: "3 active alerts: CPU high, Disk low, 2 security updates"

### AC5: Warning Visual Distinct from Offline
- **Given** a server with `status: offline`
- **When** the ServerCard is rendered
- **Then** the card shows red status LED (not yellow border) - warning treatment only applies to online servers with alerts

### AC6: Priority: Offline > Warning > Normal
- **Given** a server with `status: offline` AND active alerts
- **When** the ServerCard is rendered
- **Then** the offline state takes visual priority (red LED, standard border)

---

## Scope

### In Scope
- Yellow/amber border for servers with active alerts
- Alert triangle icon with count badge
- Tooltip showing alert summary
- Visual priority handling (offline > warning)

### Out of Scope
- Changing alert threshold logic
- Adding new alert types
- Server detail page changes
- Mobile-specific layouts

---

## Technical Notes

### Data Requirements

Need to fetch active alert count for each server. Options:

1. **Add to Server list response** (preferred) - Add `active_alert_count` field
2. **Separate API call** - Fetch alerts and join client-side

Recommended: Add `active_alert_count: int` to `ServerResponse` schema.

### Implementation Approach

Update `ServerCard.tsx`:

```tsx
// Warning state (has active alerts but online)
const hasWarning = server.status === 'online' && server.active_alert_count > 0;

// Border colour priority: offline red > warning yellow > type-based (server blue / workstation purple)
const getBorderColour = () => {
  if (server.status === 'offline' && !isWorkstation) return 'border-l-red-500';
  if (hasWarning) return 'border-l-yellow-500';
  return isWorkstation ? 'border-l-purple-500' : 'border-l-blue-500';
};

// In JSX header
{hasWarning && (
  <div className="flex items-center gap-1" title={`${server.active_alert_count} active alerts`}>
    <AlertTriangle size={16} className="text-yellow-500" />
    <span className="text-xs bg-yellow-500/20 text-yellow-500 px-1 rounded">
      {server.active_alert_count}
    </span>
  </div>
)}
```

### Backend Changes

Add to `ServerResponse` schema:

```python
active_alert_count: int = Field(
    default=0,
    description="Number of active (unresolved) alerts for this server"
)
```

Add to server list query:

```python
# Count active alerts per server
from sqlalchemy import func
alert_counts = (
    select(Alert.server_id, func.count(Alert.id).label('count'))
    .where(Alert.status == 'active')
    .group_by(Alert.server_id)
    .subquery()
)
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server online with 0 alerts | Normal border colour (blue/purple based on type) |
| Server online with 1+ alerts | Yellow border, alert icon with count |
| Server offline with alerts | Red LED, normal border (offline priority) |
| Server in maintenance with alerts | Maintenance glow takes priority, no warning border |
| Workstation offline with alerts | Grey LED (workstation offline), no warning treatment |
| Alert count > 99 | Show "99+" badge |
| Alert count loading | Don't show icon until count loaded |

---

## Test Scenarios

- [ ] Verify yellow border appears on server with active alerts
- [ ] Verify alert triangle icon with count badge
- [ ] Verify tooltip shows alert summary
- [ ] Verify offline server shows red LED not yellow border
- [ ] Verify maintenance mode takes visual priority
- [ ] Verify workstation offline not treated as warning
- [ ] Verify "99+" for large alert counts
- [ ] Verify accessibility: icon has aria-label

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0014 | Data | Alert API for fetching active alerts | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Lucide React icons | Library | Available |
| Alert model with `status` field | Data | Done |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium (requires backend change for alert count)

---

## Open Questions

- [ ] Should clicking the alert indicator navigate to filtered alert list? - Owner: Darren

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
