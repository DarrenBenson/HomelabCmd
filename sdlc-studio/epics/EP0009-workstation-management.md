# EP0009: Workstation Management

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-26
> **Target Release:** Phase 1 (Alpha)
> **Story Points:** 27

---

## Overview

Extend HomelabCmd to distinguish between servers (24/7 uptime expected) and workstations (intermittent availability). This enables appropriate alerting behavior, UI presentation, and cost tracking for machines that are not always online.

**Key Concept:** Servers are "always on" - offline is an alert. Workstations are "sometimes on" - offline is normal.

---

## Goals

### Primary Goals
- Differentiate machine types (server vs workstation)
- Implement workstation-aware alerting (no offline alerts for workstations)
- Track "last seen" for workstations instead of "offline since"
- Support cost tracking for intermittent machines (based on actual uptime)
- Visual distinction in UI between server and workstation cards

### Success Criteria
- Can register workstations with `machine_type='workstation'`
- No offline alerts generated for workstations
- Workstation cards show "Last seen: 3 hours ago" instead of "OFFLINE"
- Cost calculations accurate for intermittent uptime
- Server behavior unchanged (offline alerts still work)

---

## User Stories

### US0082: Machine Type Field and Migration
**Story Points:** 3
**Priority:** P0
**Dependencies:** None

**As a** system administrator
**I want** machines to have a type (server or workstation)
**So that** the system can handle them appropriately

**Acceptance Criteria:**
- [ ] Database migration adds `machine_type` ENUM field ('server', 'workstation')
- [ ] All existing machines default to `machine_type='server'`
- [ ] `expected_online` BOOLEAN field added (default TRUE)
- [ ] Workstations automatically set `expected_online=FALSE`
- [ ] Migration reversible (rollback support)
- [ ] API schemas updated to include `machine_type`
- [ ] Machine creation requires `machine_type` parameter
- [ ] Machine update allows changing `machine_type`

**Technical Notes:**
- Alembic migration:
  ```python
  # Add column with default
  op.add_column('machine', sa.Column('machine_type',
      sa.Enum('server', 'workstation', name='machine_type_enum'),
      nullable=False,
      server_default='server'
  ))

  op.add_column('machine', sa.Column('expected_online',
      sa.Boolean(),
      nullable=False,
      server_default=sa.text('true')
  ))
  ```

**API Schema Update:**
```python
class MachineCreate(BaseModel):
    display_name: str
    tailscale_hostname: str
    machine_type: Literal["server", "workstation"]  # Required
    tdp_watts: Optional[int] = None
    ...

class MachineResponse(BaseModel):
    id: UUID
    machine_type: str
    expected_online: bool
    ...
```

---

### US0083: Workstation Registration Workflow
**Story Points:** 4
**Priority:** P0
**Dependencies:** US0082

**As a** system administrator
**I want** to register workstations separately from servers
**So that** they are treated appropriately by the system

**Acceptance Criteria:**
- [ ] Machine registration form has machine type selector (radio buttons)
- [ ] Default selection based on context (Tailscale discovery hints OS type)
- [ ] Workstation registration pre-fills `expected_online=false`
- [ ] Workstation registration suggests lower TDP values
- [ ] Validation: servers require TDP, workstations optional
- [ ] Import from Tailscale suggests type based on OS/hostname patterns
- [ ] Confirmation message distinguishes types ("Server registered" vs "Workstation registered")

**Technical Notes:**
- Heuristics for auto-suggestion:
  - Hostname contains "server", "nas", "omv" → suggest server
  - Hostname contains "pc", "laptop", "workstation" → suggest workstation
  - OS is "OpenMediaVault", "Debian" (no desktop) → suggest server
  - OS is "Ubuntu Desktop", "Fedora Workstation" → suggest workstation

**Registration Form:**
```
┌────────────────────────────────────────┐
│ Register New Machine                   │
├────────────────────────────────────────┤
│ Display Name: *                        │
│ [StudyPC                          ]    │
│                                        │
│ Hostname:                              │
│ [studypc.tail-abc123.ts.net      ]    │
│                                        │
│ Machine Type: *                        │
│ ○ Server (24/7 uptime expected)       │
│ ● Workstation (Intermittent)          │
│                                        │
│ TDP (Watts):                           │
│ [100                             ]    │
│ ℹ️  Optional for workstations          │
│                                        │
│ Track Costs: ☑                        │
│                                        │
│        [Cancel]  [Register Machine]    │
└────────────────────────────────────────┘
```

---

### US0084: Workstation-Aware Alerting
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0082

**As a** system administrator
**I want** workstations to NOT generate offline alerts
**So that** I'm not spammed when they're normally shut down

**Acceptance Criteria:**
- [ ] Offline detection checks `machine.expected_online` field
- [ ] If `expected_online=false` (workstation), skip offline alert generation
- [ ] Existing offline alerts for workstations auto-resolve on migration
- [ ] Server offline detection unchanged (still generates alerts)
- [ ] Manual override: can force offline alerts for specific workstation
- [ ] Alert generation logs reason for skipping (audit trail)
- [ ] Test coverage for server vs workstation alert paths

**Technical Notes:**
- Update `check_offline_machines()` scheduler:
  ```python
  for machine in machines:
      if is_offline(machine):
          if machine.expected_online:
              # Server: generate alert
              create_alert(machine, "server_offline")
          else:
              # Workstation: skip alert, just mark status
              machine.status = "offline"
              # Log: "Skipping offline alert for workstation {machine.id}"
  ```

**Alert Generation Logic:**
```
Machine offline detected
    ↓
Check machine.expected_online
    ↓
├─ TRUE (server) → Generate alert
│                 → Send Slack notification
│                 → Mark status offline
│
└─ FALSE (workstation) → Skip alert
                        → Mark status offline
                        → Update last_seen
```

---

### US0085: Last Seen UI for Workstations
**Story Points:** 4
**Priority:** P0
**Dependencies:** US0082, US0083

**As a** system administrator
**I want** workstations to show "Last seen" instead of "OFFLINE"
**So that** the UI reflects normal intermittent usage

**Acceptance Criteria:**
- [ ] Workstation cards show "Last seen: 3 hours ago" when offline
- [ ] Server cards show "OFFLINE" status when offline (unchanged)
- [ ] Last seen calculated from `machine.last_seen` timestamp
- [ ] Relative time formatting: "2 minutes ago", "3 hours ago", "2 days ago"
- [ ] Green dot for online workstations, grey dot for offline (not red)
- [ ] Tooltip explains: "Workstation - intermittent availability expected"
- [ ] Dashboard filter: "Show only online" vs "Show all"

**Technical Notes:**
- Time formatting library:
  ```typescript
  import { formatDistanceToNow } from 'date-fns';

  const lastSeenText = machine.machine_type === 'workstation' && machine.status === 'offline'
    ? `Last seen: ${formatDistanceToNow(machine.last_seen, { addSuffix: true })}`
    : machine.status.toUpperCase();
  ```

**UI Comparison:**
```
Server Card (Offline):
┌─────────────────────┐
│ 🔴 HOMESERVER       │
│ OFFLINE             │
│ Last seen: 5m ago   │
│ ⚠️ Alert generated   │
└─────────────────────┘

Workstation Card (Offline):
┌─────────────────────┐
│ ⚪ StudyPC           │
│ Last seen: 3h ago   │
│ (No alert)          │
└─────────────────────┘
```

---

### US0086: Visual Distinction (Server vs Workstation)
**Story Points:** 3
**Priority:** P1
**Dependencies:** US0085

**As a** system administrator
**I want** visual cues to distinguish servers from workstations
**So that** I can quickly identify machine types on dashboard

**Acceptance Criteria:**
- [ ] Workstation cards have distinct icon (desktop/laptop vs server rack)
- [ ] Server cards: "🖥️ Server" badge
- [ ] Workstation cards: "💻 Workstation" badge
- [ ] Color scheme: servers blue accent, workstations purple accent
- [ ] Card border style: servers solid, workstations dashed (when offline)
- [ ] Hover tooltip shows machine type
- [ ] Settings allow hiding type badges (if user prefers minimal)

**Technical Notes:**
- Icon library: Lucide React icons
  - Server: `Server` icon
  - Workstation: `Monitor` or `Laptop` icon based on category
- CSS classes:
  ```css
  .machine-card.server { border-left: 4px solid #3b82f6; }
  .machine-card.workstation { border-left: 4px solid #a855f7; }
  .machine-card.workstation.offline { border-style: dashed; }
  ```

**Dashboard View:**
```
┌────────────────────────────────────────────────┐
│  HomelabCmd                    [+ Add Machine] │
├────────────────────────────────────────────────┤
│                                                │
│  🖥️  Servers (8 online, 1 offline)             │
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │🟢 Server │ │🟢 Server │ │🔴 Server │      │
│  │HOMESERVER│ │MEDIASERVER│ │BACKUPSVR │      │
│  └──────────┘ └──────────┘ └──────────┘      │
│                                                │
│  💻 Workstations (1 online, 2 offline)         │
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │🟢 Wrkst  │ │⚪ Wrkst  │ │⚪ Wrkst  │      │
│  │StudyPC   │ │LaptopPro │ │GamingPC  │      │
│  │Online    │ │Last: 3h  │ │Last: 2d  │      │
│  └──────────┘ └──────────┘ └──────────┘      │
└────────────────────────────────────────────────┘
```

---

### US0087: Workstation Cost Tracking
**Story Points:** 5
**Priority:** P1
**Dependencies:** US0082, EP0001 (Cost tracking infrastructure)

**As a** system administrator
**I want** workstation costs calculated based on actual uptime
**So that** I know how much each workstation costs me

**Acceptance Criteria:**
- [ ] Agent reports `boot_time` in heartbeat (existing field)
- [ ] Hub calculates uptime between heartbeats: `current_time - boot_time`
- [ ] If boot_time changes, machine was rebooted (reset uptime calculation)
- [ ] Cost calculation: `(TDP_watts * actual_hours * electricity_rate) / 1000`
- [ ] Cost displayed per day/week/month for workstations
- [ ] Cost summary includes both servers and workstations
- [ ] Workstation costs marked as "based on actual usage"
- [ ] Dashboard shows total server costs vs total workstation costs

**Technical Notes:**
- Uptime calculation:
  ```python
  def calculate_uptime_hours(machine, heartbeat):
      if heartbeat.boot_time != machine.last_boot_time:
          # Machine rebooted, reset tracking
          machine.last_boot_time = heartbeat.boot_time
          machine.uptime_start = heartbeat.timestamp

      uptime_seconds = (heartbeat.timestamp - heartbeat.boot_time).total_seconds()
      return uptime_seconds / 3600  # Convert to hours

  def calculate_cost(machine, period_hours):
      if not machine.tdp_watts:
          return 0

      kwh = (machine.tdp_watts * period_hours) / 1000
      cost = kwh * electricity_rate
      return cost
  ```

**Cost Dashboard Widget:**
```
┌────────────────────────────────────────┐
│ Power Costs (This Month)               │
├────────────────────────────────────────┤
│ Servers (24/7):           £85.54       │
│   11 machines @ avg 495W               │
│                                        │
│ Workstations (on-demand): £12.30      │
│   StudyPC: £8.50 (170h)               │
│   LaptopPro: £2.40 (48h)               │
│   GamingPC: £1.40 (28h)                │
│                                        │
│ Total:                    £97.84       │
└────────────────────────────────────────┘
```

---

### US0088: Workstation Metrics Collection
**Story Points:** 2
**Priority:** P0
**Dependencies:** US0082

**As a** system administrator
**I want** workstation metrics collected when online
**So that** I have visibility into workstation health

**Acceptance Criteria:**
- [ ] Workstation agents push metrics same as servers (60s heartbeat)
- [ ] Agent behavior identical for servers and workstations
- [ ] Hub accepts metrics from both types
- [ ] Metrics stored with same retention (30 days)
- [ ] Historical charts available for workstations (when data exists)
- [ ] Gap handling: charts show gaps when workstation offline
- [ ] No changes needed to agent code (type determined by hub registration)

**Technical Notes:**
- Agent doesn't know machine type (hub-side concept)
- Agent just pushes metrics normally
- Hub marks machine offline after 3 missed heartbeats (180s)
- Difference: hub skips alert generation for workstations

**Metrics Chart (Workstation):**
```
CPU Usage (Last 24h)
┌────────────────────────────────────────┐
│ 100%│                                  │
│  75%│  ████                            │
│  50%│  ████                            │
│  25%│  ████                            │
│   0%├──────────────────────────────────┤
│     0h   6h  12h  18h  24h             │
│     └────┘    (gap: offline)           │
│     Online 6h, Offline 18h             │
└────────────────────────────────────────┘
```

---

## Technical Architecture

### Data Model Changes

**Machine Table:**
```sql
ALTER TABLE machine ADD COLUMN machine_type VARCHAR(20) NOT NULL DEFAULT 'server';
ALTER TABLE machine ADD COLUMN expected_online BOOLEAN NOT NULL DEFAULT true;

-- Update workstations
UPDATE machine SET expected_online = false WHERE machine_type = 'workstation';
```

**Machine Model (SQLAlchemy):**
```python
class Machine(Base):
    __tablename__ = "machine"

    id = Column(UUID, primary_key=True)
    machine_type = Column(Enum("server", "workstation"), nullable=False)
    expected_online = Column(Boolean, nullable=False, default=True)
    display_name = Column(String)
    tailscale_hostname = Column(String)
    status = Column(Enum("online", "offline", "unknown"))
    last_seen = Column(DateTime)
    last_boot_time = Column(DateTime)  # NEW: for uptime tracking
    ...
```

### Alert Logic Changes

**Before (v1.0):**
```python
def check_offline_machines():
    for machine in get_all_machines():
        if is_offline(machine):
            create_alert(machine, "server_offline")
```

**After (v2.0):**
```python
def check_offline_machines():
    for machine in get_all_machines():
        if is_offline(machine):
            if machine.expected_online:
                # Server: alert
                create_alert(machine, "server_offline")
            else:
                # Workstation: just mark offline, no alert
                machine.status = "offline"
                logger.info(f"Workstation {machine.id} offline (expected)")
```

---

## Dependencies

**Backend:**
- No new libraries (uses existing SQLAlchemy, Pydantic)
- Alembic migration for schema changes

**Frontend:**
- `date-fns` (already have) - for relative time formatting
- Lucide React icons (already have) - for machine type icons

---

## Testing Strategy

### Unit Tests
- Machine type validation
- `expected_online` flag logic
- Alert generation skip for workstations
- Cost calculation with intermittent uptime
- Last seen time formatting

### Integration Tests
- Register server → offline alert generated
- Register workstation → no offline alert
- Workstation comes online → metrics collected
- Workstation goes offline → graceful handling
- Cost calculation over multiple uptime cycles

### E2E Tests
- Register workstation via UI → correct type shown
- Workstation offline → "Last seen" displayed (not "OFFLINE")
- Workstation online → metrics chart shows data
- Server offline → alert shown (unchanged behavior)

---

## Migration Considerations

### Data Migration
1. Add `machine_type` and `expected_online` columns
2. Default all existing machines to `machine_type='server'`
3. User manually updates workstations after migration (or via import)
4. Resolve any open offline alerts for machines marked as workstations

### Rollback Plan
- Migration is reversible (drop columns)
- If rolled back, all machines treated as servers (v1.0 behavior)

---

## Future Enhancements (Deferred)

- Auto-detect machine type based on uptime patterns
- "Hybrid" machine type (sometimes on, alerts after 24h)
- Workstation sleep/wake detection (differentiate shutdown vs sleep)
- Scheduled expected availability (e.g., "StudyPC expected online 6pm-11pm weekdays")

---

## Story Breakdown

| Story | Description | Points | Status | Phase |
|-------|-------------|--------|--------|-------|
| US0082 | Machine Type Field and Migration | 3 | ✅ Done | 1 |
| US0083 | Workstation Registration Workflow | 4 | ✅ Done | 1 |
| [US0089](../stories/US0089-workstation-aware-alerting.md) | Workstation-Aware Alerting | 5 | ✅ Done | 1 |
| [US0090](../stories/US0090-last-seen-ui-workstations.md) | Last Seen UI for Workstations | 3 | ✅ Done | 1 |
| [US0091](../stories/US0091-visual-distinction-workstations.md) | Visual Distinction (Server vs Workstation) | 5 | ✅ Done | 1 |
| [US0092](../stories/US0092-workstation-cost-tracking.md) | Workstation Cost Tracking | 5 | ✅ Done | 1 |
| US0088 | Workstation Metrics Collection | 2 | ✅ Done | 1 |
| **Total** | | **27** | **27/27 pts (100%)** | |

**Note:** Stories renumbered to avoid ID conflicts with EP0015: US0084→US0089, US0085→US0090, US0086→US0091, US0087→US0092.

---

**Created:** 2026-01-25
**Last Updated:** 2026-01-27
**Epic Owner:** Darren

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-25 | Claude | Initial epic creation with 7 stories, 26 points |
| 2026-01-27 | Claude | Epic review: 9/26 pts (35%) complete. US0082, US0083, US0088 done. **Critical gap:** US0084 (workstation-aware alerting) not implemented - workstations still generate false offline alerts. |
| 2026-01-27 | Claude | US0089 (Workstation-Aware Alerting) implemented via TDD. Epic now 54% complete (14/26 pts). |
| 2026-01-27 | Claude | Generated story files for remaining work: US0090 (Last Seen UI), US0091 (Visual Distinction), US0092 (Cost Tracking). Renumbered from US0085-87 to avoid EP0015 conflict. |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
| 2026-01-28 | Claude | Epic review: All 7 stories complete (27/27 pts, 100%). US0090, US0091, US0092 implemented via TDD. |
