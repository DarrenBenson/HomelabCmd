# TS0178: Per-Filesystem Metrics API

> **Status:** Draft
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Created:** 2026-01-29
> **Last Updated:** 2026-01-29

## Overview

Test specification for per-filesystem disk metrics collection, storage, and API delivery. Covers agent-side collection from /proc/mounts, backend schema validation, API responses, and historical metrics storage.

## Scope

### Stories Covered

| Story | Title | Priority |
|-------|-------|----------|
| [US0178](../stories/US0178-per-filesystem-metrics-api.md) | Per-Filesystem Metrics API | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
|-------|-----|-------------|------------|--------|
| US0178 | AC1 | Agent collects per-filesystem data | TC001-TC004 | Pending |
| US0178 | AC2 | Filesystem data structure | TC005-TC007 | Pending |
| US0178 | AC3 | API endpoint returns filesystem list | TC008-TC011 | Pending |
| US0178 | AC4 | Exclude virtual filesystems | TC012-TC015 | Pending |
| US0178 | AC5 | Historical per-filesystem metrics | TC016-TC018 | Pending |

**Coverage:** 5/5 ACs covered

### Test Types Required

| Type | Required | Rationale |
|------|----------|-----------|
| Unit | Yes | Agent collection logic, schema validation, filtering |
| Integration | Yes | Heartbeat processing, database storage |
| API | Yes | Server endpoint responses with filesystems |
| E2E | No | Frontend widget update out of scope for this story |

---

## Environment

| Requirement | Details |
|-------------|---------|
| Prerequisites | Python 3.11+, pytest, test database |
| External Services | None (mocks /proc/mounts) |
| Test Data | Mock filesystem entries, mock disk_usage responses |

---

## Test Cases

### TC001: Agent collects filesystem data from /proc/mounts

**Type:** Unit | **Priority:** Critical | **Story:** US0178-AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/mounts contains valid ext4 and xfs entries | Mocked /proc/mounts content |
| When | get_filesystem_metrics() is called | Function executes |
| Then | Returns list with 2 filesystem entries | List length == 2 |

**Assertions:**
- [ ] Return type is list
- [ ] Each entry has mount_point, device, fs_type, total_bytes, used_bytes, available_bytes, percent
- [ ] Entries match expected mount points (/, /data)

---

### TC002: Agent handles empty /proc/mounts

**Type:** Unit | **Priority:** Medium | **Story:** US0178-AC1

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/mounts is empty | Mocked empty file |
| When | get_filesystem_metrics() is called | Function executes |
| Then | Returns empty list | List length == 0 |

**Assertions:**
- [ ] Return type is list
- [ ] List is empty
- [ ] No exceptions raised

---

### TC003: Agent handles inaccessible mount point

**Type:** Unit | **Priority:** High | **Story:** US0178-AC1 (Edge Case 1)

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Mount point /restricted raises PermissionError | Mocked disk_usage raises |
| When | get_filesystem_metrics() is called | Function executes |
| Then | Skips inaccessible mount, continues with others | Accessible mounts returned |

**Assertions:**
- [ ] PermissionError is caught and logged
- [ ] Other filesystems still returned
- [ ] No exception propagates

---

### TC004: Agent handles OSError for offline network mount

**Type:** Unit | **Priority:** High | **Story:** US0178-AC1 (Edge Case 2)

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | NFS mount /nfs raises OSError | Mocked disk_usage raises OSError |
| When | get_filesystem_metrics() is called | Function executes |
| Then | Skips offline mount or includes with zeros | Mount handled gracefully |

**Assertions:**
- [ ] OSError is caught and logged
- [ ] Function completes successfully
- [ ] Other filesystems still returned

---

### TC005: FilesystemMetric schema validates complete entry

**Type:** Unit | **Priority:** Critical | **Story:** US0178-AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Complete filesystem data dict | All required fields present |
| When | FilesystemMetric schema validates | Pydantic validation |
| Then | Schema accepts valid data | No validation errors |

**Assertions:**
- [ ] mount_point is string
- [ ] device is string
- [ ] fs_type is string
- [ ] total_bytes is int (positive)
- [ ] used_bytes is int (>= 0)
- [ ] available_bytes is int (>= 0)
- [ ] percent is float (0-100)

---

### TC006: FilesystemMetric schema rejects missing fields

**Type:** Unit | **Priority:** High | **Story:** US0178-AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Filesystem data missing mount_point | Incomplete dict |
| When | FilesystemMetric schema validates | Pydantic validation |
| Then | Raises ValidationError | Error message indicates missing field |

**Assertions:**
- [ ] ValidationError raised
- [ ] Error identifies 'mount_point' as missing
- [ ] Other fields validated if present

---

### TC007: FilesystemMetric schema rejects invalid types

**Type:** Unit | **Priority:** Medium | **Story:** US0178-AC2

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | total_bytes is string "invalid" | Wrong type |
| When | FilesystemMetric schema validates | Pydantic validation |
| Then | Raises ValidationError | Error indicates type mismatch |

**Assertions:**
- [ ] ValidationError raised
- [ ] Error identifies type issue for total_bytes
- [ ] Message is descriptive

---

### TC008: Server API returns filesystems array

**Type:** API | **Priority:** Critical | **Story:** US0178-AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has filesystem data stored | Test server with filesystems |
| When | GET /api/v1/servers/{id} | API request |
| Then | Response includes filesystems array | JSON contains filesystems key |

**Assertions:**
- [ ] Response status is 200
- [ ] Response JSON has 'filesystems' key
- [ ] filesystems is array (may be empty or populated)
- [ ] Each entry has required fields

---

### TC009: Server API returns empty filesystems for new server

**Type:** API | **Priority:** High | **Story:** US0178-AC3 (Edge Case 8)

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has no filesystem data yet | Newly registered server |
| When | GET /api/v1/servers/{id} | API request |
| Then | Response includes filesystems as null or empty array | Graceful handling |

**Assertions:**
- [ ] Response status is 200
- [ ] filesystems is null or []
- [ ] No error raised

---

### TC010: Server API returns multiple filesystems

**Type:** API | **Priority:** High | **Story:** US0178-AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has 5 filesystems stored | Multiple mounts |
| When | GET /api/v1/servers/{id} | API request |
| Then | Response includes all 5 filesystems | All entries present |

**Assertions:**
- [ ] Response status is 200
- [ ] filesystems array length is 5
- [ ] Each filesystem has unique mount_point
- [ ] Data matches stored values

---

### TC011: Heartbeat with filesystems stores data

**Type:** Integration | **Priority:** Critical | **Story:** US0178-AC3

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Valid heartbeat payload with filesystems | Complete request body |
| When | POST /api/v1/servers/heartbeat | API request |
| Then | Server's filesystems field is updated | Database updated |

**Assertions:**
- [ ] Response status is 200
- [ ] Server record updated in database
- [ ] Server.filesystems contains submitted data
- [ ] FilesystemMetrics historical records created

---

### TC012: Agent excludes tmpfs filesystem

**Type:** Unit | **Priority:** Critical | **Story:** US0178-AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/mounts contains tmpfs entry | tmpfs /tmp tmpfs ... |
| When | get_filesystem_metrics() is called | Function executes |
| Then | tmpfs entry not in results | Filtered out |

**Assertions:**
- [ ] No entry with fs_type == 'tmpfs'
- [ ] No entry with mount_point == '/tmp' (if tmpfs)

---

### TC013: Agent excludes devtmpfs filesystem

**Type:** Unit | **Priority:** High | **Story:** US0178-AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/mounts contains devtmpfs /dev | devtmpfs /dev devtmpfs ... |
| When | get_filesystem_metrics() is called | Function executes |
| Then | devtmpfs entry not in results | Filtered out |

**Assertions:**
- [ ] No entry with fs_type == 'devtmpfs'
- [ ] /dev mount point excluded

---

### TC014: Agent excludes squashfs (snap) filesystem

**Type:** Unit | **Priority:** High | **Story:** US0178-AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/mounts contains squashfs snap mount | /dev/loopX /snap/... squashfs |
| When | get_filesystem_metrics() is called | Function executes |
| Then | squashfs entry not in results | Filtered out |

**Assertions:**
- [ ] No entry with fs_type == 'squashfs'
- [ ] /snap/* mount points excluded

---

### TC015: Agent excludes system paths (/sys, /proc, /run)

**Type:** Unit | **Priority:** High | **Story:** US0178-AC4

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | /proc/mounts contains /sys, /proc, /run entries | System virtual mounts |
| When | get_filesystem_metrics() is called | Function executes |
| Then | System path entries not in results | Filtered out |

**Assertions:**
- [ ] No entry with mount_point starting with /sys
- [ ] No entry with mount_point starting with /proc
- [ ] No entry with mount_point starting with /run
- [ ] No entry with mount_point starting with /dev (except device paths)

---

### TC016: Historical filesystem metrics stored

**Type:** Integration | **Priority:** High | **Story:** US0178-AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Heartbeat submitted with filesystems | Valid payload |
| When | Heartbeat processed | Backend saves data |
| Then | FilesystemMetrics records created | Database records exist |

**Assertions:**
- [ ] FilesystemMetrics table has new records
- [ ] Records match submitted filesystem data
- [ ] Each filesystem has separate record
- [ ] Timestamps are correct

---

### TC017: Historical filesystem metrics queryable by time range

**Type:** API | **Priority:** Medium | **Story:** US0178-AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has filesystem metrics over 24 hours | Multiple data points |
| When | Query metrics endpoint with time range | API request with range param |
| Then | Returns per-filesystem trend data | Time series response |

**Assertions:**
- [ ] Response includes filesystem metrics
- [ ] Data covers requested time range
- [ ] Multiple data points per filesystem
- [ ] mount_point identifies each series

---

### TC018: Historical metrics distinguishes multiple filesystems

**Type:** Integration | **Priority:** Medium | **Story:** US0178-AC5

| Step | Action | Expected Result |
|------|--------|-----------------|
| Given | Server has / and /data filesystems | Two mount points |
| When | Query historical metrics | API or DB query |
| Then | Separate trend data for each filesystem | Distinguished by mount_point |

**Assertions:**
- [ ] / filesystem has separate data series
- [ ] /data filesystem has separate data series
- [ ] No data mixing between filesystems
- [ ] mount_point used as discriminator

---

## Fixtures

```yaml
mock_proc_mounts_standard:
  content: |
    /dev/sda1 / ext4 rw,relatime 0 0
    /dev/sdb1 /data xfs rw,relatime 0 0
    tmpfs /tmp tmpfs rw,nosuid,nodev 0 0
    devtmpfs /dev devtmpfs rw,nosuid,noexec,relatime 0 0
    proc /proc proc rw,nosuid,nodev,noexec,relatime 0 0
    sysfs /sys sysfs rw,nosuid,nodev,noexec,relatime 0 0
    /dev/loop0 /snap/core/12345 squashfs ro,nodev,relatime 0 0

mock_disk_usage_root:
  total: 107374182400  # 100GB
  used: 64424509440    # 60GB
  free: 42949672960    # 40GB

mock_disk_usage_data:
  total: 4000787030016   # ~3.7TB
  used: 2800550921011    # ~2.6TB
  free: 1200236108005    # ~1.1TB

test_server:
  id: "test-server-001"
  server_guid: "550e8400-e29b-41d4-a716-446655440001"
  hostname: "testhost.local"
  status: "online"

test_filesystem_metric_valid:
  mount_point: "/"
  device: "/dev/sda1"
  fs_type: "ext4"
  total_bytes: 107374182400
  used_bytes: 64424509440
  available_bytes: 42949672960
  percent: 60.0

test_heartbeat_with_filesystems:
  server_id: "test-server-001"
  server_guid: "550e8400-e29b-41d4-a716-446655440001"
  hostname: "testhost.local"
  status: "online"
  metrics:
    cpu_percent: 25.5
    memory_percent: 45.2
    disk_percent: 60.0
    disk_total_gb: 100.0
    disk_used_gb: 60.0
  filesystems:
    - mount_point: "/"
      device: "/dev/sda1"
      fs_type: "ext4"
      total_bytes: 107374182400
      used_bytes: 64424509440
      available_bytes: 42949672960
      percent: 60.0
    - mount_point: "/data"
      device: "/dev/sdb1"
      fs_type: "xfs"
      total_bytes: 4000787030016
      used_bytes: 2800550921011
      available_bytes: 1200236108005
      percent: 70.0
```

---

## Automation Status

| TC | Title | Status | Implementation |
|----|-------|--------|----------------|
| TC001 | Agent collects filesystem data | Automated | `agent/test_collectors_filesystem.py::TestGetFilesystemMetrics::test_collects_filesystem_data` |
| TC002 | Agent handles empty /proc/mounts | Automated | `agent/test_collectors_filesystem.py::TestGetFilesystemMetrics::test_handles_empty_proc_mounts` |
| TC003 | Agent handles inaccessible mount point | Automated | `agent/test_collectors_filesystem.py::TestGetFilesystemMetrics::test_handles_inaccessible_mount_point` |
| TC004 | Agent handles OSError for offline network mount | Automated | `agent/test_collectors_filesystem.py::TestGetFilesystemMetrics::test_handles_offline_network_mount` |
| TC005 | FilesystemMetric schema validates complete entry | Automated | `tests/test_filesystem_metrics.py::TestFilesystemMetricSchema::test_valid_filesystem_metric` |
| TC006 | FilesystemMetric schema rejects missing fields | Automated | `tests/test_filesystem_metrics.py::TestFilesystemMetricSchema::test_missing_mount_point_raises_error` |
| TC007 | FilesystemMetric schema rejects invalid types | Automated | `tests/test_filesystem_metrics.py::TestFilesystemMetricSchema::test_invalid_type_raises_error` |
| TC008 | Server API returns filesystems array | Automated | `tests/test_filesystem_metrics.py::TestServerResponseWithFilesystems::test_server_response_with_filesystems` |
| TC009 | Server API returns empty filesystems for new server | Automated | `tests/test_filesystem_metrics.py::TestServerResponseWithFilesystems::test_server_response_without_filesystems` |
| TC010 | Server API returns multiple filesystems | Automated | `tests/test_filesystem_metrics.py::TestServerResponseWithFilesystems::test_server_response_with_filesystems` |
| TC011 | Heartbeat with filesystems stores data | Automated | `tests/test_filesystem_metrics.py::TestHeartbeatRequestWithFilesystems::test_heartbeat_with_filesystems` |
| TC012 | Agent excludes tmpfs filesystem | Automated | `agent/test_collectors_filesystem.py::TestGetFilesystemMetrics::test_excludes_tmpfs` |
| TC013 | Agent excludes devtmpfs filesystem | Automated | `agent/test_collectors_filesystem.py::TestGetFilesystemMetrics::test_excludes_devtmpfs` |
| TC014 | Agent excludes squashfs (snap) filesystem | Automated | `agent/test_collectors_filesystem.py::TestGetFilesystemMetrics::test_excludes_squashfs_snap` |
| TC015 | Agent excludes system paths | Automated | `agent/test_collectors_filesystem.py::TestGetFilesystemMetrics::test_excludes_system_paths` |
| TC016 | Historical filesystem metrics stored | Automated | `tests/test_filesystem_metrics.py::TestFilesystemMetricsModel::test_model_creation` |
| TC017 | Historical filesystem metrics queryable | Pending | Future: Add historical query endpoint |
| TC018 | Historical metrics distinguishes multiple filesystems | Pending | Future: Add historical query endpoint |

---

## Traceability

| Artefact | Reference |
|----------|-----------|
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |
| Plan | [PL0178: Per-Filesystem Metrics API](../plans/PL0178-per-filesystem-metrics-api.md) |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial spec |
