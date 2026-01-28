# PL0037: Trigger Package Updates - Implementation Plan

> **Status:** Complete
> **Story:** [US0052: Trigger Package Updates from Dashboard](../stories/US0052-trigger-package-updates.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-20
> **Language:** Python (Backend), TypeScript (Frontend)

## Overview

Extend the EP0004 Remediation Engine to support package management actions. This adds three new action types (`apt_update`, `apt_upgrade_all`, `apt_upgrade_security`) to the existing action queue infrastructure, with corresponding agent executor support and API extensions.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Refresh package list button | "Run apt update" queues apt_update action |
| AC2 | Apply all updates button | "Apply All Updates" queues apt_upgrade_all action |
| AC3 | Apply security updates only | Security-only upgrade option queues apt_upgrade_security |
| AC4 | Action requires approval | Non-maintenance servers require manual approval |
| AC5 | Action executes via remediation engine | Approved actions executed by agent |
| AC6 | Success/failure feedback | Results shown in action history |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.12+ (Backend), TypeScript (Frontend)
- **Framework:** FastAPI (Backend), React with Vite (Frontend)
- **Test Framework:** pytest (Backend), Vitest (Frontend)

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Use specific exception handling, not bare `except:`
- HTTP requests must have explicit timeouts
- Type hints on all public functions
- Use logging instead of print

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| FastAPI | /tiangolo/fastapi | Extending enum types in schemas | Enum extension |
| subprocess | (stdlib) | async subprocess with timeout | asyncio.create_subprocess_shell |

### Existing Patterns

The Remediation Engine (EP0004) provides the foundation:

1. **Action Types Enum** (`api/schemas/actions.py:9-13`)
   - Currently: `restart_service`, `clear_logs`
   - Pattern: String enum for action types

2. **Command Whitelist** (`api/routes/actions.py:29-33`)
   - Maps action_type to command builder function
   - Pattern: Dict with callable values for command generation

3. **Executor Whitelist** (`agent/executor.py:28-32`)
   - Regex patterns for command validation
   - Pattern: Dict with regex patterns for security

4. **Action Creation Flow** (`api/routes/actions.py:144-231`)
   - Server validation, command building, duplicate detection
   - Auto-approval for non-paused servers

## Implementation Phases

### Phase 1: Backend - Action Type Extension

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/actions.py`
- `backend/src/homelab_cmd/api/routes/actions.py`

**Changes:**

1. **Extend ActionType enum** (actions.py:9-13)
   ```python
   class ActionType(str, Enum):
       RESTART_SERVICE = "restart_service"
       CLEAR_LOGS = "clear_logs"
       APT_UPDATE = "apt_update"
       APT_UPGRADE_ALL = "apt_upgrade_all"
       APT_UPGRADE_SECURITY = "apt_upgrade_security"
   ```

2. **Add parameters field to ActionCreate** (actions.py:16-55)
   ```python
   parameters: dict[str, Any] | None = Field(
       None,
       description="Optional parameters for the action",
       examples=[{"security_only": True}],
   )
   ```

3. **Extend ALLOWED_ACTION_TYPES** (actions.py:29-33)
   ```python
   ALLOWED_ACTION_TYPES: dict[str, callable] = {
       ActionType.RESTART_SERVICE.value: lambda data: f"systemctl restart {data.service_name}",
       ActionType.CLEAR_LOGS.value: lambda data: "journalctl --vacuum-time=7d",
       ActionType.APT_UPDATE.value: lambda data: "apt update",
       ActionType.APT_UPGRADE_ALL.value: lambda data: "apt upgrade -y",
       ActionType.APT_UPGRADE_SECURITY.value: _build_security_upgrade_command,
   }
   ```

4. **Add security package helper function** (new function in actions.py)
   ```python
   async def _build_security_upgrade_command(data: ActionCreate, session: AsyncSession) -> str:
       """Build apt install command for security packages only."""
       from homelab_cmd.db.models.pending_package import PendingPackage
       result = await session.execute(
           select(PendingPackage.name).where(
               PendingPackage.server_id == data.server_id,
               PendingPackage.is_security == True,
           )
       )
       security_pkgs = [row[0] for row in result.all()]
       if not security_pkgs:
           return "echo 'No security packages to upgrade'"
       return f"apt install -y {' '.join(security_pkgs)}"
   ```

5. **Update create_action to handle async command builders** (actions.py:144-231)
   - Check if command builder is async
   - Handle security-only upgrade package list lookup

### Phase 2: Agent - Executor Whitelist Extension

**Files to modify:**
- `agent/executor.py`

**Changes:**

1. **Extend COMMAND_WHITELIST patterns** (executor.py:28-32)
   ```python
   COMMAND_WHITELIST: dict[str, str] = {
       "restart_service": r"^systemctl restart [a-zA-Z0-9_-]+$",
       "clear_logs": r"^journalctl --vacuum-time=\d+[dhms]$",
       "apply_updates": r"^apt update && apt upgrade -y$",
       "apt_update": r"^apt update$",
       "apt_upgrade": r"^apt upgrade -y$",
       "apt_install": r"^apt install -y [a-zA-Z0-9_. -]+$",
       "echo_no_security": r"^echo 'No security packages to upgrade'$",
   }
   ```

2. **Add longer timeout for apt operations**
   - apt update: 120 seconds (2 minutes)
   - apt upgrade: 600 seconds (10 minutes)
   - These timeouts will be passed from the action metadata

### Phase 3: Backend - Duplicate Action Detection

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/actions.py`

**Changes:**

1. **Extend duplicate detection for apt actions** (around line 190)
   - Check for pending/approved apt_update, apt_upgrade_all, apt_upgrade_security
   - Prevent queuing duplicate apt actions while one is in progress
   ```python
   APT_ACTION_TYPES = {
       ActionType.APT_UPDATE.value,
       ActionType.APT_UPGRADE_ALL.value,
       ActionType.APT_UPGRADE_SECURITY.value,
   }

   if action_data.action_type.value in APT_ACTION_TYPES:
       existing = await session.execute(
           select(RemediationAction).where(
               RemediationAction.server_id == action_data.server_id,
               RemediationAction.action_type.in_(APT_ACTION_TYPES),
               RemediationAction.status.in_([
                   ActionStatus.PENDING.value,
                   ActionStatus.APPROVED.value,
                   ActionStatus.EXECUTING.value,
               ]),
           )
       )
       if existing.scalar_one_or_none():
           raise HTTPException(409, detail={"code": "CONFLICT", ...})
   ```

### Phase 4: Integration Testing

**Test scenarios:**
1. Create apt_update action - verify command built correctly
2. Create apt_upgrade_all action - verify command and status
3. Create apt_upgrade_security with packages - verify package list in command
4. Create apt_upgrade_security without packages - verify echo command
5. Duplicate apt action rejection - verify 409 response
6. Agent executes apt commands - verify whitelist validation
7. Approval workflow for apt actions - verify paused server flow
8. Action timeout handling - verify 10-minute timeout for upgrades

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Security: command injection via package names | Whitelist regex validation in executor, sanitised package names from apt |
| Availability: apt lock held | Edge case documented, retry logic in agent |
| Data: packages table out of sync | Heartbeat refreshes list after apt operations |

## Dependencies

- US0051 backend must be complete (PendingPackage model exists)
- EP0004 Remediation Engine (Done)

## Testing Requirements

- Unit tests for new action types
- Integration tests for API endpoints
- Agent executor tests for new whitelist patterns
- E2E test for full action flow (optional, manual)

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `api/schemas/actions.py` | Modify | Add 3 action types to enum, add parameters field |
| `api/routes/actions.py` | Modify | Extend command builders, duplicate detection |
| `agent/executor.py` | Modify | Add apt command patterns to whitelist |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial plan creation |
