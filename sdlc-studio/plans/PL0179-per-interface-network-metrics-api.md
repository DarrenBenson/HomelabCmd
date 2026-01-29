# PL0179: Per-Interface Network Metrics API - Implementation Plan

> **Status:** Draft
> **Story:** [US0179: Per-Interface Network Metrics API](../stories/US0179-per-interface-network-metrics-api.md)
> **Epic:** [EP0012: Widget-Based Detail View](../epics/EP0012-widget-based-detail-view.md)
> **Created:** 2026-01-29
> **Language:** Python (Backend), TypeScript (Frontend)

---

## Overview

Extend the agent, backend API, and frontend to support per-interface network metrics. Currently, only aggregate network bytes (rx/tx totals) are collected. This story enables the network widget to display individual interface traffic and sparkline charts.

---

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Agent collection | Agent collects per-interface data from /proc/net/dev |
| AC2 | Data structure | Each interface entry includes name, rx_bytes, tx_bytes, rx_packets, tx_packets, is_up |
| AC3 | API endpoint | GET `/api/v1/servers/{id}` returns `network_interfaces` array |
| AC4 | Exclude loopback | Filter out lo (loopback), include tailscale/docker/bridge |
| AC5 | Historical metrics | Per-interface metrics stored for trend analysis |
| AC6 | Network sparkline API | GET `/api/v1/metrics/sparkline/{server_id}/network` returns time-series data |

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

### Existing Patterns (from US0178 FilesystemMetrics)

**Agent collectors:** `agent/collectors.py` contains `get_filesystem_metrics()` which parses `/proc/mounts` and collects per-mount data - use same pattern for `/proc/net/dev`.

**Heartbeat schema:** `backend/src/homelab_cmd/api/schemas/heartbeat.py` defines `FilesystemMetric` and `HeartbeatRequest.filesystems` - use same pattern for `NetworkInterfaceMetric`.

**Server model:** `backend/src/homelab_cmd/db/models/server.py` has `filesystems` JSON column - add similar `network_interfaces` column.

**Historical metrics:** `backend/src/homelab_cmd/db/models/metrics.py` defines `FilesystemMetrics` for per-mount history - create `NetworkInterfaceMetrics` model.

---

## Recommended Approach

**Strategy:** TDD
**Rationale:** API story with well-defined contracts, clear Given/When/Then AC, and precise data structures specified. Tests can be written upfront from the AC.

### Test Priority
1. Agent interface collection with loopback filtering
2. Heartbeat schema acceptance of network_interfaces field
3. Server API response includes network_interfaces array
4. Historical interface metrics storage and retrieval
5. Sparkline endpoint with interface parameter

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Add NetworkInterfaceMetric Pydantic schema | `backend/src/homelab_cmd/api/schemas/heartbeat.py` | - | [ ] |
| 2 | Add network_interfaces field to HeartbeatRequest | `backend/src/homelab_cmd/api/schemas/heartbeat.py` | 1 | [ ] |
| 3 | Add NetworkInterfaceMetrics database model | `backend/src/homelab_cmd/db/models/metrics.py` | - | [ ] |
| 4 | Create Alembic migration for NetworkInterfaceMetrics | `migrations/versions/xxx_add_network_interface_metrics.py` | 3 | [ ] |
| 5 | Add network_interfaces field to Server model (JSON) | `backend/src/homelab_cmd/db/models/server.py` | - | [ ] |
| 6 | Add network_interfaces to ServerResponse schema | `backend/src/homelab_cmd/api/schemas/server.py` | 1 | [ ] |
| 7 | Process network_interfaces in heartbeat endpoint | `backend/src/homelab_cmd/api/routes/agents.py` | 2, 5 | [ ] |
| 8 | Add get_network_interfaces function to agent | `agent/collectors.py` | - | [ ] |
| 9 | Include network_interfaces in agent heartbeat payload | `agent/heartbeat.py`, `agent/__main__.py` | 8 | [ ] |
| 10 | Add NetworkInterface type to frontend | `frontend/src/types/server.ts` | - | [ ] |
| 11 | Add network sparkline endpoint | `backend/src/homelab_cmd/api/routes/metrics.py` | 3, 4 | [ ] |
| 12 | Write backend unit tests | `tests/test_network_interface_metrics.py` | 1-7 | [ ] |
| 13 | Write agent unit tests | `agent/test_collectors_network.py` | 8 | [ ] |

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
**Goal:** Define data structures for network interface metrics

- [ ] Create `NetworkInterfaceMetric` Pydantic schema with all fields
- [ ] Add `network_interfaces: list[NetworkInterfaceMetric] | None` to `HeartbeatRequest`
- [ ] Create `NetworkInterfaceMetrics` SQLAlchemy model for historical storage
- [ ] Add `network_interfaces` JSON field to `Server` model (latest snapshot)
- [ ] Add `network_interfaces` to `ServerResponse` schema

**Files:**
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Add NetworkInterfaceMetric schema
- `backend/src/homelab_cmd/db/models/metrics.py` - Add NetworkInterfaceMetrics model
- `backend/src/homelab_cmd/db/models/server.py` - Add network_interfaces JSON column
- `backend/src/homelab_cmd/api/schemas/server.py` - Add to response

### Phase 2: Database Migration
**Goal:** Create database schema for network interface metrics

- [ ] Generate Alembic migration for NetworkInterfaceMetrics table
- [ ] Add migration for Server.network_interfaces column
- [ ] Run and verify migration

**Migration columns for NetworkInterfaceMetrics:**
```python
id: Integer (PK, autoincrement)
server_id: String(100) (FK to servers.id, CASCADE delete)
timestamp: DateTime (timezone=True)
interface_name: String(64)
rx_bytes: BigInteger
tx_bytes: BigInteger
rx_packets: BigInteger
tx_packets: BigInteger
is_up: Boolean
```

**Indexes:**
- `idx_net_iface_server_ts` on (server_id, timestamp)
- `idx_net_iface_server_name_ts` on (server_id, interface_name, timestamp)

### Phase 3: Agent Collection
**Goal:** Collect per-interface metrics from /proc/net/dev

- [ ] Create `get_network_interfaces()` function in collectors.py
- [ ] Parse /proc/net/dev for interface statistics
- [ ] Filter loopback (`lo`) interface
- [ ] Include virtual interfaces (tailscale, docker, veth, bridge)
- [ ] Read interface state from /sys/class/net/{name}/operstate
- [ ] Handle PermissionError/OSError gracefully
- [ ] Include network_interfaces in heartbeat payload

**Files:**
- `agent/collectors.py` - Add get_network_interfaces()
- `agent/heartbeat.py` - Add network_interfaces parameter
- `agent/__main__.py` - Collect and include in heartbeat payload

### Phase 4: Backend Processing
**Goal:** Store and serve network interface metrics

- [ ] Update heartbeat endpoint to extract and store network_interfaces
- [ ] Store latest snapshot in Server.network_interfaces (JSON)
- [ ] Store historical entries in NetworkInterfaceMetrics table
- [ ] Add network sparkline endpoint with interface parameter

**Files:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Process in heartbeat
- `backend/src/homelab_cmd/api/routes/metrics.py` - Add sparkline endpoint

### Phase 5: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Unit test agent collection | `agent/test_collectors_network.py` | Pending |
| AC2 | Schema validation test | `tests/test_network_interface_metrics.py` | Pending |
| AC3 | API integration test | `tests/test_servers.py` | Pending |
| AC4 | Unit test loopback filtering | `agent/test_collectors_network.py` | Pending |
| AC5 | Query historical endpoint | `tests/test_network_interface_metrics.py` | Pending |
| AC6 | Sparkline endpoint test | `tests/test_network_interface_metrics.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | Interface down | Include with is_up: false, read from /sys/class/net/{name}/operstate | Phase 3 |
| 2 | Virtual interface (veth) | Include - useful for Docker networking | Phase 3 |
| 3 | No physical interfaces | Return empty array | Phase 3 |
| 4 | Counter overflow (32-bit) | Handle wrap-around in rate calculation (frontend) | Future |

**Coverage:** 4/4 edge cases handled

**Additional edge cases to consider:**
| # | Scenario | Handling Strategy | Phase |
|---|----------|-------------------|-------|
| 5 | /proc/net/dev not found | Return empty list, log debug message | Phase 3 |
| 6 | New interface appears | Detected on next collection cycle | Phase 3 |
| 7 | Interface removed | Historical data preserved, new snapshots won't include it | Phase 3 |
| 8 | Server has no network data yet | Return null/empty for network_interfaces in API | Phase 4 |
| 9 | Very many interfaces (>20) | Include all, no limit (frontend handles display) | Phase 3 |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| /proc/net/dev parsing fragile | Agent crashes on unusual format | Wrap parsing in try/except, log and skip bad lines |
| Large number of interfaces bloats heartbeat | Increased network/storage | Consider pagination for historical endpoint |
| Counter wrap-around | Incorrect rate calculations | Document for frontend, handle in rate calculation |
| Interface names vary across systems | Inconsistent filtering | Use minimal exclusion (only `lo`) |

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

- Frontend NetworkWidget enhancement (displaying per-interface data) is out of scope for this story - it consumes the API but the widget update is tracked separately
- The sparkline endpoint should support optional `interface` parameter - if not provided, return aggregate data
- Counter wrap-around handling for rate calculation should be done in frontend or metrics service, not in storage
- Consider rate limiting the sparkline endpoint if performance issues arise

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial plan creation |
