# PL0191: Remove Async Command Channel - Implementation Plan

> **Status:** Planned
> **Story:** [US0152: Remove Async Command Channel](../stories/US0152-remove-async-command-channel.md)
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-29
> **Language:** Python

## Overview

Remove the async command channel from the heartbeat protocol now that synchronous SSH execution (US0151, US0153) replaces it. This simplifies both the hub API and the agent, making the agent a metrics-only component while maintaining backward compatibility with v1.0 agents during migration.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Remove Command Fields | Remove `pending_commands` from response, `command_results` from request |
| AC2 | Remove Agent Execution | Remove all command execution code from agent |
| AC3 | Backward Compatibility | Hub accepts v1.0 agents, logs deprecation warnings |
| AC4 | Multi-Server Validation | Test on 2+ servers to verify no regressions |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python 3.11+
- **Framework:** FastAPI (backend), standalone Python (agent)
- **Test Framework:** pytest

### Relevant Best Practices
- Maintain backward compatibility during migration window
- Log deprecation warnings for v1.0 agent behaviour
- Use feature flags if needed for phased rollout
- Clean removal - no dead code left behind

### Existing Patterns

**Hub API (agents.py):**
- `_process_command_results()` at line 83-141 - processes incoming results
- `pending_commands` built at lines 518-536 - formats outgoing commands
- HeartbeatResponse includes `pending_commands` field

**Agent (__main__.py):**
- `process_pending_commands()` at lines 163-212 - executes received commands
- `_pending_results` global tracks results to send
- Main loop at lines 340-356 handles command cycle

**Schemas (heartbeat.py):**
- `command_results` field on HeartbeatRequest (line 407)
- `pending_commands` field on HeartbeatResponse (line 483)

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is primarily a removal task with clear scope. Edge cases are few (4) and well-defined. Backward compatibility can be verified after changes since the behaviour is straightforward.

### Test Priority
1. Backward compatibility - v1.0 agent heartbeats still accepted
2. Deprecation warnings logged correctly
3. Metrics continue flowing without command fields

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Make `command_results` optional with deprecation | `heartbeat.py` | - | [ ] |
| 2 | Add deprecation warning for `command_results` | `agents.py` | 1 | [ ] |
| 3 | Remove `_process_command_results()` logic | `agents.py` | 2 | [ ] |
| 4 | Make `pending_commands` return empty array | `agents.py` | 3 | [ ] |
| 5 | Remove command execution from agent | `agent/__main__.py` | 4 | [ ] |
| 6 | Remove `process_pending_commands()` function | `agent/__main__.py` | 5 | [ ] |
| 7 | Clean up agent heartbeat.py | `agent/heartbeat.py` | 6 | [ ] |
| 8 | Update/remove obsolete tests | `tests/test_heartbeat_commands.py` | 7 | [ ] |
| 9 | Add backward compatibility tests | `tests/test_heartbeat_compat.py` | 8 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| Hub Schema | 1 | None |
| Hub Logic | 2, 3, 4 | Hub Schema |
| Agent | 5, 6, 7 | Hub Logic (for testing) |
| Tests | 8, 9 | All code changes |

---

## Implementation Phases

### Phase 1: Hub Backward Compatibility
**Goal:** Hub accepts both v1.0 and v2.0 agents gracefully

- [ ] Make `command_results` field optional (already optional via `| None`)
- [ ] Add deprecation warning when `command_results` is non-empty
- [ ] Always return empty `pending_commands` array (backward compatible)
- [ ] Remove `_process_command_results()` call and function

**Files:**
- `backend/src/homelab_cmd/api/routes/agents.py` - Remove command processing, add deprecation log
- `backend/src/homelab_cmd/api/schemas/heartbeat.py` - Keep `command_results` optional for v1.0 compat

### Phase 2: Agent Simplification
**Goal:** Agent only collects and sends metrics

- [ ] Remove `command_results` parameter from `send_heartbeat()`
- [ ] Remove `pending_commands` handling from `HeartbeatResult`
- [ ] Remove `process_pending_commands()` function
- [ ] Remove `_pending_results` global and related logic
- [ ] Remove command execution imports (asyncio.run for commands)
- [ ] Simplify main loop (no command processing)

**Files:**
- `agent/__main__.py` - Remove command execution code
- `agent/heartbeat.py` - Remove command-related fields/dataclasses

### Phase 3: Test Updates
**Goal:** Tests reflect new behaviour

- [ ] Remove tests for command channel functionality
- [ ] Add tests for backward compatibility
- [ ] Add tests for deprecation warnings
- [ ] Verify metrics-only heartbeat tests still pass

**Files:**
- `tests/test_heartbeat_commands.py` - Remove or archive
- `tests/test_heartbeat_compat.py` - New backward compatibility tests
- `tests/test_agents_coverage.py` - Update affected tests

### Phase 4: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Schema inspection + tests | `heartbeat.py` | Pending |
| AC2 | Agent code inspection | `agent/__main__.py` | Pending |
| AC3 | Backward compat tests | `test_heartbeat_compat.py` | Pending |
| AC4 | Integration test on Docker agents | Docker Compose | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | v1.0 agent sends `command_results` | Log warning, ignore field | Phase 1 |
| 2 | v1.0 agent expects `pending_commands` | Return empty array | Phase 1 |
| 3 | Mixed agent versions | Both work, warnings logged | Phase 1 |
| 4 | Agent upgrade fails mid-deployment | v1.0 continues working | Phase 1 |

**Coverage:** 4/4 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| v1.0 agents break | High | Maintain backward compat, deploy hub first |
| Tests break unexpectedly | Medium | Run full test suite before/after each phase |
| Agent metrics stop flowing | High | Test on staging before production |

---

## Definition of Done

- [ ] `command_results` field ignored with deprecation warning
- [ ] `pending_commands` always returns empty array
- [ ] Agent code has no command execution logic
- [ ] Backward compatibility tests pass
- [ ] Existing metrics tests pass
- [ ] No linting errors
- [ ] Agent tested on 2+ servers

---

## Notes

- The `pending_commands` field is kept in the response schema for backward compatibility but always returns `[]`
- The `command_results` field is kept in the request schema but ignored with a warning
- Full removal of schema fields can be done in a future breaking change version
- Docker Compose test agents can be used to verify AC4
