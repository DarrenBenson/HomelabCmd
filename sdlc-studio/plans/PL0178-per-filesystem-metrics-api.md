# PL0178: Per-Filesystem Metrics API - Implementation Plan

> **Status:** Draft
> **Story:** [US0178: Per-Filesystem Metrics API](../stories/US0178-per-filesystem-metrics-api.md)
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Created:** 2026-01-29
> **Language:** Python (Backend), TypeScript (Frontend)

---

## Overview

Extend the agent, backend API, and frontend to support per-filesystem disk metrics. Currently, only aggregate disk metrics (root mount) are collected. This story enables the disk widget to display individual mount points with their usage.

---

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Agent collection | Agent collects per-filesystem data from each mounted filesystem |
| AC2 | Data structure | Each filesystem entry includes mount_point, device, fs_type, total_bytes, used_bytes, available_bytes |
| AC3 | API endpoint | GET `/api/v1/servers/{id}` returns `filesystems` array |
| AC4 | Exclude virtual | Filter out tmpfs, devtmpfs, squashfs, overlay, proc, sysfs filesystems |
| AC5 | Historical metrics | Per-filesystem metrics stored over time for trend analysis |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+ (Backend), TypeScript (Frontend)
- **Framework:** FastAPI (Backend), React 18 (Frontend)
- **Test Framework:** pytest (Backend), Vitest (Frontend)

### Relevant Best Practices
- Use explicit timeouts for HTTP requests
- Use specific exception handling, not bare `except:`
- Use context managers for file operations
- Use pathlib for file paths

### Existing Patterns

**Agent collectors:** `agent/collectors.py` contains `get_metrics()` which uses `psutil.disk_usage("/")` for root mount only.

**Heartbeat schema:** `backend/src/homelab_cmd/api/schemas/heartbeat.py` defines `HeartbeatRequest` with `MetricsPayload` containing aggregate `disk_percent`, `disk_total_gb`, `disk_used_gb`.

**Server response:** `backend/src/homelab_cmd/api/schemas/server.py` defines `ServerResponse` which includes `latest_metrics`.

**Metrics model:** `backend/src/homelab_cmd/db/models/metrics.py` defines `Metrics`, `MetricsHourly`, `MetricsDaily` for tiered storage.

---

## Recommended Approach

**Strategy:** TDD
**Rationale:** API story with well-defined contracts, clear Given/When/Then AC, and precise data structures specified. Tests can be written upfront from the AC.

### Test Priority
1. Agent filesystem collection with virtual filesystem filtering
2. Heartbeat schema acceptance of filesystems field
3. Server API response includes filesystems array
4. Historical filesystem metrics storage and retrieval

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add FilesystemMetric Pydantic schema | `backend/src/homelab_cmd/api/schemas/heartbeat.py` | - | [ ] |
| 2 | Add filesystems field to HeartbeatRequest | `backend/src/homelab_cmd/api/schemas/heartbeat.py` | 1 | [ ] |
| 3 | Add FilesystemMetrics database model | `backend/src/homelab_cmd/db/models/metrics.py` | - | [ ] |
| 4 | Create Alembic migration for FilesystemMetrics | `migrations/versions/xxx_add_filesystem_metrics.py` | 3 | [ ] |
| 5 | Add filesystems field to Server model (JSON) | `backend/src/homelab_cmd/db/models/server.py` | - | [ ] |
| 6 | Add filesystems to ServerResponse schema | `backend/src/homelab_cmd/api/schemas/server.py` | 1 | [ ] |
| 7 | Process filesystems in heartbeat endpoint | `backend/src/homelab_cmd/api/routes/agents.py` | 2, 5 | [ ] |
| 8 | Add get_filesystem_metrics function to agent | `agent/collectors.py` | - | [ ] |
| 9 | Include filesystems in agent heartbeat payload | `agent/agent.py` | 8 | [ ] |
| 10 | Add Filesystem interface to frontend types | `frontend/src/types/server.ts` | - | [ ] |
| 11 | Add per-filesystem metrics API endpoint | `backend/src/homelab_cmd/api/routes/metrics.py` | 3, 4 | [ ] |
| 12 | Write backend unit tests | `tests/test_filesystem_metrics.py` | 1-7 | [ ] |
| 13 | Write agent unit tests | `agent/test_collectors.py` | 8 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| A | 1, 3, 5, 8, 10 | None (independent schemas/models) |
| B | 2, 4, 6 | Group A |
| C | 7, 9, 11 | Group B |
| D | 12, 13 | Group C |

---

## Implementation Phases

### Phase 1: Backend Schemas and Models
**Goal:** Define data structures for filesystem metrics

- [ ] Create `FilesystemMetric` Pydantic schema with all fields
- [ ] Add `filesystems: list[FilesystemMetric] | None` to `HeartbeatRequest`
- [ ] Create `FilesystemMetrics` SQLAlchemy model for historical storage
- [ ] Add `filesystems` JSON field to `Server` model (latest snapshot)
- [ ] Add `filesystems` to `ServerResponse` schema

**Files:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add FilesystemMetric schema
- `backend/src/homelab_cmd/db/models/metrics.py` - Add FilesystemMetrics model
- `backend/src/homelab_cmd/db/models/server.py` - Add filesystems JSON column
- `backend/src/homelab_cmd/api/schemas/server.py` - Add to response

### Phase 2: Database Migration
**Goal:** Create database schema for filesystem metrics

- [ ] Generate Alembic migration for FilesystemMetrics table
- [ ] Add migration for Server.filesystems column
- [ ] Run and verify migration

**Migration columns for FilesystemMetrics:**
```python
id: UUID
server_id: UUID (FK to servers.id)
timestamp: DateTime
mount_point: String(255)
device: String(255)
fs_type: String(50)
total_bytes: BigInteger
used_bytes: BigInteger
available_bytes: BigInteger
percent: Float
```

### Phase 3: Agent Collection
**Goal:** Collect per-filesystem metrics from /proc/mounts

- [ ] Create `get_filesystem_metrics()` function in collectors.py
- [ ] Parse /proc/mounts for filesystem entries
- [ ] Filter virtual filesystems (tmpfs, devtmpfs, squashfs, overlay, proc, sysfs)
- [ ] Filter mount points (/sys, /proc, /dev, /run, /snap)
- [ ] Deduplicate by device (handle bind mounts)
- [ ] Handle PermissionError/OSError gracefully
- [ ] Include filesystems in heartbeat payload

**Files:**
- `agent/collectors.py` - Add get_filesystem_metrics()
- `agent/agent.py` - Include in heartbeat payload

### Phase 4: Backend Processing
**Goal:** Store and serve filesystem metrics

- [ ] Update heartbeat endpoint to extract and store filesystems
- [ ] Store latest snapshot in Server.filesystems (JSON)
- [ ] Store historical entries in FilesystemMetrics table
- [ ] Add per-filesystem metrics query endpoint (optional for AC5)

**Files:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Process in heartbeat
- `backend/src/homelab_cmd/api/routes/metrics.py` - Historical endpoint

### Phase 5: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test agent collection | `agent/test_collectors.py` | Pending |
| AC2 | Schema validation test | `tests/test_filesystem_metrics.py` | Pending |
| AC3 | API integration test | `tests/test_servers.py` | Pending |
| AC4 | Unit test filtering logic | `agent/test_collectors.py` | Pending |
| AC5 | Query historical endpoint | `tests/test_filesystem_metrics.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Mount point inaccessible | Skip with warning log, continue to next mount | Phase 3 |
| 2 | Network mount offline | Include with available_bytes: 0, log warning | Phase 3 |
| 3 | Very many filesystems (>20) | Include all, no limit (frontend handles display) | Phase 3 |
| 4 | Bind mounts | Deduplicate by tracking seen devices in set | Phase 3 |

**Coverage:** 4/4 edge cases handled

**Additional edge cases to consider:**
| # | Scenario | Handling Strategy | Phase |
|---|----------|-------------------|-------|
| 5 | Empty /proc/mounts | Return empty list, log debug message | Phase 3 |
| 6 | Filesystem mounted after agent start | Detected on next collection cycle | Phase 3 |
| 7 | Disk nearly full (>99%) | Include normally, widget handles display | Phase 3 |
| 8 | Server has no filesystem data yet | Return null/empty for filesystems in API | Phase 4 |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| /proc/mounts parsing fragile | Agent crashes on unusual mount entries | Wrap parsing in try/except, log and skip bad lines |
| Large number of filesystems bloats heartbeat | Increased network/storage | Consider pagination for historical endpoint |
| Docker containers have many overlay mounts | Noise in filesystem list | Virtual filesystem filter excludes overlay type |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing (agent + backend)
- [ ] Edge cases handled
- [ ] Code follows best practices (Python, TypeScript)
- [ ] No linting errors
- [ ] Alembic migration tested
- [ ] API documentation updated (OpenAPI)

---

## Notes

- Frontend DiskWidget enhancement (displaying per-filesystem data) is out of scope for this story - it consumes the API but the widget update is tracked separately
- Historical metrics may need tiered storage (hourly/daily aggregates) similar to existing Metrics model - implement basic storage first, add tiers if needed
- Consider adding `mount_point` query parameter to existing metrics endpoints rather than creating entirely new endpoints

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial plan creation |
