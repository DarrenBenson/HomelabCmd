# US0038: Scan Initiation

> **Status:** Done
> **Plan:** [PL0045: Scan Initiation](../plans/PL0045-scan-initiation.md)
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to initiate a scan by entering a hostname or IP
**So that** I can gather system information from transient devices

## Context

### Persona Reference

**Darren** - Needs to quickly check what's running on a laptop or desktop without installing an agent.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Scans are initiated from the dashboard by entering a hostname or IP address. Two scan types are available: quick (basic info) and full (detailed). The scan runs synchronously (or with status polling for longer scans).

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key auth only | Scan requests must use key-based auth, no password option |
| Scope | Ad-hoc scanning | Single device per scan request, no batch scanning |
| Tech Stack | Python/paramiko | SSH commands executed via paramiko library |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Architecture | LAN-only | Scan targets must be on local network |
| UX | On-demand visibility | Quick scan returns in < 10 seconds |
| Data Model | SQLite storage | Scan results stored as JSON in scans table |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Initiate quick scan

- **Given** a valid hostname "192.168.1.100"
- **When** POST `/api/v1/scans` with type="quick"
- **Then** a quick scan is initiated and results returned

### AC2: Initiate full scan

- **Given** a valid hostname "192.168.1.100"
- **When** POST `/api/v1/scans` with type="full"
- **Then** a full scan is initiated and results returned

### AC3: Quick scan data

- **Given** a quick scan completes
- **When** viewing results
- **Then** OS, hostname, uptime, disk usage, and memory usage are shown

### AC4: Full scan data

- **Given** a full scan completes
- **When** viewing results
- **Then** quick scan data plus installed packages, running processes, and network interfaces are shown

### AC5: Scan progress tracking

- **Given** a scan is in progress
- **When** checking status
- **Then** progress percentage and current step are returned

## Scope

### In Scope

- POST /api/v1/scans endpoint
- Quick scan implementation
- Full scan implementation
- SSH command execution
- Results parsing
- Progress tracking

### Out of Scope

- Scan results display (US0039)
- Scan history (US0040)
- Network discovery (US0041)

## Technical Notes

### API Contracts

**POST /api/v1/scans**
```json
Request:
{
  "hostname": "192.168.1.100",
  "port": 22,
  "username": "darren",
  "scan_type": "quick"  // or "full"
}

Response 202:
{
  "scan_id": 15,
  "status": "running",
  "hostname": "192.168.1.100",
  "scan_type": "quick",
  "started_at": "2026-01-18T10:30:00Z"
}
```

**GET /api/v1/scans/{scan_id}**
```json
Response 200 (in progress):
{
  "scan_id": 15,
  "status": "running",
  "progress": 60,
  "current_step": "Collecting disk usage"
}

Response 200 (complete):
{
  "scan_id": 15,
  "status": "completed",
  "hostname": "192.168.1.100",
  "scan_type": "quick",
  "started_at": "2026-01-18T10:30:00Z",
  "completed_at": "2026-01-18T10:30:05Z",
  "results": {
    "os": {
      "name": "Ubuntu",
      "version": "22.04",
      "kernel": "5.15.0-91-generic"
    },
    "hostname": "dazzbook",
    "uptime_seconds": 345600,
    "disk": [
      {
        "mount": "/",
        "total_gb": 500,
        "used_gb": 120,
        "percent": 24
      }
    ],
    "memory": {
      "total_mb": 16384,
      "used_mb": 8192,
      "percent": 50
    }
  }
}
```

### Scan Commands

**Quick Scan:**
```bash
# OS info
cat /etc/os-release
uname -r

# Hostname
hostname

# Uptime
cat /proc/uptime

# Disk usage
df -h --output=target,size,used,pcent

# Memory
free -m
```

**Full Scan (additional):**
```bash
# Installed packages (Debian/Ubuntu)
dpkg -l | wc -l
dpkg -l | head -100

# Running processes
ps aux --sort=-pmem | head -20

# Network interfaces
ip addr show
```

**TRD Reference:** [§4 API Contracts - Scans](../trd.md#4-api-contracts)

### Data Requirements

**Scan Table:**
```sql
CREATE TABLE scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostname TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT NOT NULL,
    scan_type TEXT NOT NULL,  -- 'quick' or 'full'
    status TEXT NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    results TEXT,  -- JSON
    error TEXT
);
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Connection refused | status="failed", error="Connection refused" |
| Timeout | status="failed", error="Connection timed out" |
| Command fails | Partial results returned with error note |
| Non-Linux OS | Limited results, error for unsupported commands |
| SSH key rejected | status="failed", error="Authentication failed" |

## Test Scenarios

- [ ] Quick scan returns expected fields
- [ ] Full scan returns additional fields
- [ ] Scan progress updates correctly
- [ ] Connection failure handled gracefully
- [ ] Timeout handled gracefully
- [ ] Partial results on command failure
- [ ] Scan stored in database

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0038-01 | Quick scan returns OS, hostname, uptime, disk, memory | AC1, AC3 | API | Pending |
| TC-US0038-02 | Full scan returns additional packages, processes, network | AC2, AC4 | API | Pending |
| TC-US0038-03 | Scan progress updates with percentage and step | AC5 | API | Pending |
| TC-US0038-04 | Connection refused returns failed status with error | Edge | API | Pending |
| TC-US0038-05 | SSH auth failure returns appropriate error | Edge | API | Pending |
| TC-US0038-06 | Scan results stored in database | AC1, AC2 | Unit | Pending |

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 5/8 minimum documented
- [x] Test scenarios: 7/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 0/0 resolved
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0037: SSH Key Configuration | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium-High - SSH command execution and result parsing

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-21 | Claude | Story review: marked Ready |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
