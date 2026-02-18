# PL0204: Remote Agent Mode Switch - Implementation Plan

> **Status:** Done
> **Story:** [US0188: Remote Agent Mode Switch](../stories/US0188-remote-agent-mode-switch.md)
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Created:** 2026-01-31
> **Language:** Python/TypeScript

## Overview

Enable users to switch an agent from readonly to readwrite mode (or vice versa) directly from the Server Detail page, without requiring manual SSH access. The hub will use its existing SSH infrastructure to remotely reinstall the agent with the new mode configuration.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Switch mode button visible | Button shown for readonly agents when SSH configured |
| AC2 | Switch mode via SSH | Hub SSHs into server and runs reinstall with new mode |
| AC3 | Progress feedback | Loading indicator on button during operation |
| AC4 | Success confirmation | Mode updates in UI, success toast shown |
| AC5 | Error handling | Error message shown, button returns to normal |
| AC6 | Switch back to readonly | Optional bidirectional mode switching |

---

## Technical Context

### Language & Framework
- **Primary Language:** Python (backend), TypeScript (frontend)
- **Framework:** FastAPI, React
- **Test Framework:** pytest, Vitest

### Relevant Best Practices
- Use existing `build_agent_tarball()` for config delivery
- Follow SSHConnectionService patterns for remote execution
- Use Pydantic schemas for request/response validation
- Follow existing toast notification patterns in frontend

### Existing Patterns

1. **Agent Installation Flow** (`agent_deploy.py`):
   - Builds tarball with config.yaml containing mode
   - Executes via SSH with sudo support
   - Updates database `server.agent_mode` field

2. **SSH Execution** (`ssh.py`):
   - Multi-key support with per-key usernames
   - Password authentication fallback
   - Returns `CommandResult` with exit_code, stdout, stderr

3. **Frontend Agent Management** (`ServerDetail.tsx`):
   - Agent mode displayed as badge (readonly=gray, readwrite=green)
   - AgentInstallModal for installation/reinstallation

---

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Straightforward feature leveraging well-tested existing patterns. Core SSH and tarball logic already has test coverage.

### Test Priority
1. API endpoint returns correct response structure
2. Mode switch correctly updates database
3. Frontend button visibility and state management

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
|---|------|------|------------|--------|
| 1 | Create AgentModeSwitchRequest schema | `api/schemas/agent_deploy.py` | - | [ ] |
| 2 | Create AgentModeSwitchResponse schema | `api/schemas/agent_deploy.py` | 1 | [ ] |
| 3 | Add switch_agent_mode service method | `services/agent_deploy.py` | - | [ ] |
| 4 | Add POST /servers/{id}/agent/mode endpoint | `api/routes/agent_deploy.py` | 1,2,3 | [ ] |
| 5 | Add switchAgentMode API function | `frontend/src/api/agents.ts` | 4 | [ ] |
| 6 | Add AgentModeSwitchRequest type | `frontend/src/types/agent.ts` | - | [ ] |
| 7 | Create AgentModeSwitchButton component | `frontend/src/components/AgentModeSwitchButton.tsx` | 5,6 | [ ] |
| 8 | Integrate button into ServerDetail | `frontend/src/pages/ServerDetail.tsx` | 7 | [ ] |
| 9 | Add backend tests | `tests/test_agent_mode_switch.py` | 4 | [ ] |
| 10 | Add frontend tests | `frontend/src/components/AgentModeSwitchButton.test.tsx` | 7 | [ ] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| Backend | 1, 2, 3 | None |
| API | 4 | Backend |
| Frontend Types | 5, 6 | API |
| Frontend UI | 7, 8 | Frontend Types |
| Tests | 9, 10 | All |

---

## Implementation Phases

### Phase 1: Backend API
**Goal:** Create endpoint to switch agent mode via SSH

- [ ] Add AgentModeSwitchRequest schema (mode, sudo_password)
- [ ] Add AgentModeSwitchResponse schema (success, server_id, new_mode, message, error)
- [ ] Add switch_agent_mode method to AgentDeployService
- [ ] Add POST /api/v1/servers/{server_id}/agent/mode endpoint
- [ ] Update server.agent_mode in database on success

**Files:**
- `backend/src/homelab_cmd/api/schemas/agent_deploy.py` - Add request/response schemas
- `backend/src/homelab_cmd/services/agent_deploy.py` - Add switch_agent_mode method
- `backend/src/homelab_cmd/api/routes/agent_deploy.py` - Add endpoint

### Phase 2: Frontend Integration
**Goal:** Add mode switch button to Server Detail page

- [ ] Add switchAgentMode function to agents API
- [ ] Add TypeScript types for mode switch
- [ ] Create AgentModeSwitchButton component with loading/error states
- [ ] Integrate button into ServerDetail.tsx near agent mode badge
- [ ] Add success toast notification
- [ ] Refetch server data on success to update mode badge

**Files:**
- `frontend/src/api/agents.ts` - Add API function
- `frontend/src/types/agent.ts` - Add types
- `frontend/src/components/AgentModeSwitchButton.tsx` - New component
- `frontend/src/pages/ServerDetail.tsx` - Integration

### Phase 3: Testing & Validation
**Goal:** Verify all acceptance criteria

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Visual test - button visible for readonly | `ServerDetail.tsx` | Pending |
| AC2 | API test - SSH command executed | `test_agent_mode_switch.py` | Pending |
| AC3 | Visual test - loading state shown | `AgentModeSwitchButton.test.tsx` | Pending |
| AC4 | Integration test - mode updates | `test_agent_mode_switch.py` | Pending |
| AC5 | Unit test - error handling | `AgentModeSwitchButton.test.tsx` | Pending |
| AC6 | API test - bidirectional switch | `test_agent_mode_switch.py` | Pending |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
|---|------------------------|-------------------|-------|
| 1 | SSH connection fails | Return error with details, allow retry | Phase 1 |
| 2 | sudo permission denied | Include "sudo access required" in error message | Phase 1 |
| 3 | Agent install script missing | Return error "Agent not properly installed" | Phase 1 |
| 4 | Service restart fails | Return warning but mode may have changed | Phase 1 |
| 5 | Network timeout | Return timeout error, allow retry | Phase 1 |
| 6 | SSH key not configured | Button disabled with tooltip "SSH not configured" | Phase 2 |

**Coverage:** 6/6 edge cases handled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSH connection cache stale after mode switch | Medium | Clear connection pool entry after switch |
| Agent briefly offline during restart | Low | Show warning about brief downtime |
| Mode switch partially completes | Medium | Verify mode via next heartbeat |

---

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests written and passing
- [ ] Edge cases handled
- [ ] Code follows best practices
- [ ] No linting errors
- [ ] Documentation updated (if needed)

---

## Notes

- Reuse existing `build_agent_tarball()` with modified mode config
- Existing install.sh supports `--remote --mode X` for unattended reinstall
- SSH command timeout should be 120s (matching existing install timeout)
- Consider clearing SSHPooledExecutor cache after mode switch
