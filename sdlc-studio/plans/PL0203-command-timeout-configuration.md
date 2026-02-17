# PL0203: Command Timeout Configuration

> **Story:** [US0186: Command Timeout Configuration](../stories/US0186-command-timeout-configuration.md)
> **Status:** Draft
> **Approach:** Test-After
> **Created:** 2026-01-31

## Overview

Implement configurable command execution timeouts to replace hardcoded values. Supports a global default timeout, per-command-type overrides, and per-execution overrides. Timeout information is visible in the UI and API, with clear status tracking for timed-out commands.

---

## Acceptance Criteria Summary

| AC | Description | Implementation |
|----|-------------|----------------|
| AC1 | Global default timeout | Add `command_timeout_default` to config (300s default) |
| AC2 | Per-command-type timeout | Add type-specific settings (restart: 60s, update: 600s) |
| AC3 | Timeout displayed before execution | Show in ActionDetailPanel with override option |
| AC4 | Command cancelled on timeout | Set status to FAILED with `timed_out_at` timestamp |
| AC5 | Timeout visible in history | Display "Timed out after Xs" in action details |
| AC6 | API supports timeout parameter | Add `timeout_seconds` to action create/execute requests |

---

## Technical Context

### Current Implementation

- **SSH Executor:** Already supports `timeout` parameter (default 30s)
- **CommandTimeoutError:** Exists with timeout value and partial output
- **Hardcoded timeouts:** 30s (commands), 300s (APT operations) scattered across routes
- **Config system:** Uses JSON key-value storage with Pydantic validation

### Key Files

| File | Purpose |
|------|---------|
| `backend/src/homelab_cmd/services/ssh_executor.py` | Timeout enforcement via asyncio.wait_for |
| `backend/src/homelab_cmd/api/routes/actions.py` | Action execution with timeout |
| `backend/src/homelab_cmd/api/routes/commands.py` | Synchronous command execution |
| `backend/src/homelab_cmd/db/models/remediation.py` | RemediationAction model |
| `backend/src/homelab_cmd/api/schemas/config.py` | Configuration schemas |
| `frontend/src/components/ActionDetailPanel.tsx` | Action display with timeout info |

### Integration Points

1. **Timeout lookup hierarchy:** action.timeout_seconds → command_type config → global default
2. **Config storage:** New `command_timeouts` key in Config table
3. **Status tracking:** Use FAILED status with `timed_out_at` field (no new enum value needed)

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Configuration-focused story with multiple integration points (config, API, frontend). Requires verification against running system to ensure timeout values propagate correctly. Frontend UI needs visual testing.

### Test Priority

1. Timeout configuration API CRUD
2. Timeout lookup hierarchy (override → type → global)
3. Action execution respects configured timeout
4. Frontend displays timeout information

---

## Implementation Tasks

### Phase 1: Backend Model & Migration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add `timeout_seconds` column to `remediation_actions` | [ ] | Optional INT for per-execution override |
| 2 | Add `timed_out_at` column to `remediation_actions` | [ ] | Nullable DateTime |
| 3 | Create Alembic migration | [ ] | `add_action_timeout_fields.py` |

### Phase 2: Configuration Schema & API

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4 | Create `CommandTimeoutConfig` schema | [ ] | global_default, service_restart, package_update |
| 5 | Create `CommandTimeoutUpdate` schema | [ ] | All fields optional for partial update |
| 6 | Add GET `/config/command-timeouts` endpoint | [ ] | Returns current config |
| 7 | Add PUT `/config/command-timeouts` endpoint | [ ] | Updates with partial merge |
| 8 | Add helper function `get_timeout_for_action_type()` | [ ] | Lookup with defaults |

### Phase 3: Action API Updates

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9 | Update `ActionCreate` schema with `timeout_seconds` | [ ] | Optional parameter |
| 10 | Update `ActionResponse` schema | [ ] | Include timeout_seconds, timed_out_at |
| 11 | Update action creation to store timeout | [ ] | In routes/actions.py |
| 12 | Update execution to use configured timeout | [ ] | Replace hardcoded 300s |
| 13 | Update timeout error handling | [ ] | Set `timed_out_at` on timeout |

### Phase 4: Commands API Updates

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14 | Add `timeout_seconds` to `CommandExecuteRequest` | [ ] | Optional override |
| 15 | Update command execution to lookup timeout | [ ] | Replace hardcoded 30s |
| 16 | Update timeout response format | [ ] | Include configured timeout |

### Phase 5: Frontend Display

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17 | Add `timeout_seconds` and `timed_out_at` to Action type | [ ] | `types/action.ts` |
| 18 | Show timeout in ActionDetailPanel | [ ] | "Timeout: 60s" display |
| 19 | Show "Timed out after Xs" for timed-out actions | [ ] | In result section |
| 20 | Add timeout override input (optional) | [ ] | In approval flow if needed |

### Phase 6: Settings UI

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21 | Add timeout configuration section to Settings | [ ] | Under Advanced or Remediation |
| 22 | Create timeout config form | [ ] | Three input fields with validation |
| 23 | Wire up API calls | [ ] | GET/PUT to command-timeouts endpoint |

### Phase 7: Testing

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24 | Write backend unit tests | [ ] | Config CRUD, lookup logic |
| 25 | Write action timeout tests | [ ] | Execution honours timeout |
| 26 | Write frontend tests | [ ] | Display and form behaviour |
| 27 | Run lint and type checks | [ ] | Verify no regressions |

---

## Edge Case Handling

| # | Scenario | Implementation | Phase |
|---|----------|----------------|-------|
| 1 | Timeout set to 0 | Clamp to global default in lookup function | Phase 2 |
| 2 | Very short timeout (< 5s) | Allow but log warning | Phase 2 |
| 3 | Command completes just before timeout | Normal success path | N/A |
| 4 | Network disconnect during command | asyncio.wait_for handles via timeout | Phase 3 |
| 5 | SSH connection drops | Immediate SSHConnectionError (not timeout) | N/A |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing timeout behaviour | Medium | Medium | Use sensible defaults matching current hardcoded values |
| Config migration on existing installs | Low | Low | Config auto-creates with defaults if missing |
| Frontend/Backend timeout mismatch | Low | Low | Single source of truth in config, frontend reads from API |

---

## Definition of Done

- [ ] All acceptance criteria implemented and verified
- [ ] Migration applies cleanly
- [ ] Default timeout values match story requirements (300s global, 60s restart, 600s update)
- [ ] Timeout visible in action details
- [ ] Settings UI allows configuration changes
- [ ] Unit tests cover configuration and execution
- [ ] Lint and type checks pass
- [ ] Code reviewed

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `migrations/versions/*_add_action_timeout_fields.py` | Create | New timeout columns |
| `backend/src/homelab_cmd/db/models/remediation.py` | Modify | Add timeout fields |
| `backend/src/homelab_cmd/api/schemas/config.py` | Modify | Add CommandTimeoutConfig |
| `backend/src/homelab_cmd/api/schemas/actions.py` | Modify | Add timeout to request/response |
| `backend/src/homelab_cmd/api/schemas/commands.py` | Modify | Add timeout to request |
| `backend/src/homelab_cmd/api/routes/config.py` | Modify | Add timeout config endpoints |
| `backend/src/homelab_cmd/api/routes/actions.py` | Modify | Use configured timeout |
| `backend/src/homelab_cmd/api/routes/commands.py` | Modify | Use configured timeout |
| `frontend/src/types/action.ts` | Modify | Add timeout fields |
| `frontend/src/components/ActionDetailPanel.tsx` | Modify | Display timeout info |
| `frontend/src/pages/SettingsPage.tsx` | Modify | Add timeout config section |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial plan creation |
