# US0178: Per-Filesystem Metrics API

> **Status:** Done
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Owner:** Darren
> **Created:** 2026-01-29
> **Story Points:** 5
> **Plan:** [PL0178: Per-Filesystem Metrics API](../plans/PL0178-per-filesystem-metrics-api.md)
> **Test Spec:** [TS0178: Per-Filesystem Metrics API](../test-specs/TS0178-per-filesystem-metrics-api.md)

## User Story

**As a** Darren (Homelab Operator)
**I want** the API to provide per-filesystem disk metrics
**So that** the disk widget can show individual mount points

## Context

### Persona Reference
**Darren** - Technical professional managing a homelab. Needs detailed storage visibility for capacity planning.
[Full persona details](../personas.md#darren-homelab-operator)

### Background
US0168 (Disk Usage Widget) is partially implemented showing aggregate disk usage. This story provides the backend API needed for per-filesystem breakdown.

---

## Acceptance Criteria

### AC1: Agent collects per-filesystem data
- **Given** the agent runs on a machine
- **When** it collects metrics
- **Then** it reports data for each mounted filesystem

### AC2: Filesystem data structure
- **Given** filesystem data is collected
- **When** included in heartbeat/metrics
- **Then** each entry includes: mount_point, device, fs_type, total_bytes, used_bytes, available_bytes

### AC3: API endpoint returns filesystem list
- **Given** a machine has filesystem data
- **When** I request `GET /api/v1/servers/{id}` or metrics endpoint
- **Then** the response includes `filesystems` array

### AC4: Exclude virtual filesystems
- **Given** the agent collects filesystem data
- **When** processing mounts
- **Then** it excludes tmpfs, devtmpfs, squashfs, and similar virtual mounts

### AC5: Historical per-filesystem metrics
- **Given** filesystem data is collected over time
- **When** I request metrics history
- **Then** I can get per-filesystem trends

---

## Scope

### In Scope
- Agent enhancement: collect per-filesystem data
- Heartbeat schema update
- API response includes filesystems array
- Filter out virtual/system filesystems
- Store historical data per filesystem

### Out of Scope
- SMART disk health data
- Disk I/O metrics (read/write speeds)
- RAID status

---

## Technical Notes

### Agent Collection
```python
import shutil

def get_filesystem_metrics():
    filesystems = []
    seen_devices = set()

    with open('/proc/mounts', 'r') as f:
        for line in f:
            parts = line.split()
            device, mount_point, fs_type = parts[0], parts[1], parts[2]

            # Skip virtual filesystems
            if fs_type in ('tmpfs', 'devtmpfs', 'squashfs', 'overlay', 'proc', 'sysfs'):
                continue
            if mount_point.startswith(('/sys', '/proc', '/dev', '/run', '/snap')):
                continue
            if device in seen_devices:
                continue

            try:
                usage = shutil.disk_usage(mount_point)
                filesystems.append({
                    'mount_point': mount_point,
                    'device': device,
                    'fs_type': fs_type,
                    'total_bytes': usage.total,
                    'used_bytes': usage.used,
                    'available_bytes': usage.free,
                    'percent': round(usage.used / usage.total * 100, 1) if usage.total > 0 else 0
                })
                seen_devices.add(device)
            except (PermissionError, OSError):
                continue

    return filesystems
```

### Heartbeat Schema Addition
```python
class HeartbeatRequest(BaseModel):
    # ... existing fields
    filesystems: Optional[List[FilesystemMetric]] = None

class FilesystemMetric(BaseModel):
    mount_point: str
    device: str
    fs_type: str
    total_bytes: int
    used_bytes: int
    available_bytes: int
    percent: float
```

### API Response
```json
{
  "id": "mediaserver",
  "hostname": "mediaserver.local",
  "filesystems": [
    {
      "mount_point": "/",
      "device": "/dev/sda1",
      "fs_type": "ext4",
      "total_bytes": 107374182400,
      "used_bytes": 64424509440,
      "available_bytes": 42949672960,
      "percent": 60.0
    },
    {
      "mount_point": "/data",
      "device": "/dev/sdb1",
      "fs_type": "xfs",
      "total_bytes": 4000787030016,
      "used_bytes": 2800550921011,
      "available_bytes": 1200236108005,
      "percent": 70.0
    }
  ]
}
```

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | Mount point inaccessible | Skip with warning log |
| 2 | Network mount offline | Include with available_bytes: 0 |
| 3 | Very many filesystems (>20) | Include all, frontend handles display |
| 4 | Bind mounts | Deduplicate by device |

---

## Test Scenarios

- [ ] Agent collects data from /proc/mounts
- [ ] Virtual filesystems filtered out
- [ ] Heartbeat includes filesystems array
- [ ] API returns filesystems in server response
- [ ] Historical metrics stored per filesystem
- [ ] Bind mounts not duplicated

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0168](US0168-disk-usage-widget.md) | Enables | Disk widget per-filesystem display | Partial |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium - Agent enhancement, schema update, API modification

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation to enable US0168 completion |
| 2026-01-29 | Claude | Status: Draft → Planned, added plan (PL0178) and test-spec (TS0178) |
| 2026-01-29 | Claude | Status: In Progress → Done. All 5 ACs implemented. |
