# US0044: Package Update Display

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to see available package updates for each server
**So that** I know which servers need updating and can prioritise security patches

## Context

### Persona Reference

**Darren** - Wants visibility into server maintenance status. Security updates are high priority.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The TRD heartbeat schema includes `updates_available` and `security_updates` fields. This story implements collection of this data by the agent and display in the dashboard. Security updates are highlighted to draw attention to critical patches.

## Acceptance Criteria

### AC1: Agent collects update count

- **Given** the agent is running on a Debian-based server
- **When** collecting metrics for heartbeat
- **Then** the number of available updates and security updates is included

### AC2: Update count displayed on server card

- **Given** a server has 12 updates available (3 security)
- **When** viewing the dashboard
- **Then** the server card shows an update indicator (e.g., "12 updates (3 security)")

### AC3: Security updates highlighted

- **Given** a server has security updates pending
- **When** viewing the dashboard
- **Then** the security count is displayed in a warning colour

### AC4: Update details in server detail view

- **Given** viewing the server detail page
- **When** the server has pending updates
- **Then** an Updates section shows total count, security count, and last check time

### AC5: No updates shows clean state

- **Given** a server has zero pending updates
- **When** viewing the dashboard
- **Then** no update indicator is shown (or shows "Up to date")

## Scope

### In Scope

- Agent collection of update counts (`apt list --upgradable`)
- Heartbeat schema extension (already defined in TRD)
- Server card update indicator
- Server detail update section
- Security update highlighting
- Database storage of update counts per server

### Out of Scope

- List of individual package names
- Triggering updates from dashboard (EP0004 handles this)
- Update history/trends
- Non-Debian package managers (yum, dnf)

## UI/UX Requirements

### Server Card Update Indicator

```
┌─────────────────────────────────────────┐
│ 🟢 OMV MediaServer                      │
│ CPU: 45%  RAM: 62%  Disk: 82% ⚠️         │
│ ↑ 12d                                   │
│ 📦 12 updates (3 security)              │
└─────────────────────────────────────────┘
```

### Server Detail Updates Section

```
┌─────────────────────────────────────────────────────────────────────────┐
│ System Updates                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Available Updates:     12                                               │
│  Security Updates:      3  ⚠️                                             │
│  Last Checked:          2026-01-18 10:30 UTC                            │
│                                                                          │
│  [Apply Updates]  (queues action for approval)                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Colour Coding

| State | Indicator |
|-------|-----------|
| No updates | No indicator or "Up to date" in grey |
| Updates available (no security) | Grey/blue text |
| Security updates pending | Amber/warning colour |

## Technical Notes

### Agent Implementation

```python
import subprocess

def get_update_counts() -> dict:
    """Get available update counts on Debian-based systems."""
    try:
        # Update package lists (quiet mode)
        subprocess.run(['apt', 'update', '-qq'], capture_output=True, timeout=60)

        # Count upgradable packages
        result = subprocess.run(
            ['apt', 'list', '--upgradable'],
            capture_output=True,
            text=True,
            timeout=30
        )

        lines = result.stdout.strip().split('\n')[1:]  # Skip header
        total = len([l for l in lines if l])

        # Count security updates
        security = len([l for l in lines if 'security' in l.lower()])

        return {
            'updates_available': total,
            'security_updates': security
        }
    except Exception as e:
        logger.warning(f"Failed to check updates: {e}")
        return {
            'updates_available': None,
            'security_updates': None
        }
```

### Heartbeat Schema (from TRD)

```json
{
  "server_id": "omv-mediaserver",
  "timestamp": "...",
  "metrics": { ... },
  "updates_available": 12,
  "security_updates": 3
}
```

**TRD Reference:** [§4 API Contracts - Agent Heartbeat](../trd.md#4-api-contracts)

### Data Requirements

- `updates_available` and `security_updates` stored in Server table
- Updated on each heartbeat
- Null indicates update check not available/failed

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| apt not available (non-Debian) | Return null, display "N/A" |
| apt update times out | Log warning, return null |
| Permission denied | Return null, log error |
| Very large update count (100+) | Display as "99+" |

## Test Scenarios

- [ ] Agent collects update count on Debian
- [ ] Agent handles missing apt gracefully
- [ ] Heartbeat includes update fields
- [ ] Server card shows update count
- [ ] Security updates highlighted
- [ ] Zero updates shows clean state
- [ ] Null values show "N/A"

## Definition of Done


**Story-specific additions:**

- [ ] Agent tested on OMV and Raspberry Pi OS
- [ ] Update count refresh documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0003: Agent Heartbeat Endpoint | Story | Draft |
| US0004: Agent Script | Story | Draft |
| US0005: Dashboard Server List | Story | Draft |
| US0006: Server Detail View | Story | Draft |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - data collection and display

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation (QA gap analysis) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
