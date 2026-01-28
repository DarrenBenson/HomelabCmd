# EP0015: Per-Host Credential Management

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-27
> **Target Release:** Phase 1 (Alpha)
> **Story Points:** 24

---

## Overview

Enable per-server SSH and sudo credential management, fixing critical gaps in agent upgrade and removal operations that currently fail on servers requiring sudo passwords. The current system only supports global credentials, limiting flexibility when different servers require different authentication configurations.

---

## Problem Statement

### Current System Gaps

| Operation | SSH Auth | Sudo Password | Per-Host User | Status |
|-----------|----------|---------------|---------------|--------|
| Install | Global key | Parameter only | None | Partially works |
| **Upgrade** | Global key | **Not supported** | None | **Fails silently** |
| **Remove** | Global key | **Not supported** | None | **Fails with warnings** |

**Critical code locations:**
- `agent_deploy.py:439` - `upgrade_agent()` has no `sudo_password` parameter
- `agent_deploy.py:506-513` - Hard-coded sudo commands without password pipe
- `agent_deploy.py:542-548` - `remove_agent()` has `ssh_password` but not `sudo_password`
- `credential.py:24` - Only 2 global credential types allowed
- `server.py:32-178` - No per-host credential fields

### User Impact

- **Upgrade failures:** Servers requiring sudo passwords cannot be upgraded via UI
- **Removal failures:** Agent removal fails silently when sudo password required
- **Configuration inflexibility:** Cannot use different SSH usernames for different servers
- **Security concerns:** Some environments require per-host credentials, not global

---

## Goals

### Primary Goals
- Support per-server SSH private keys (override global default)
- Support per-server sudo passwords (stored encrypted)
- Support per-server SSH usernames (override global default)
- Fix agent upgrade to accept and use sudo password
- Fix agent removal to accept and use sudo password
- Maintain backward compatibility with global-only credentials

### Success Criteria
- Agent upgrade works on servers requiring sudo password
- Agent removal works on servers requiring sudo password
- Per-server credentials can be configured via API
- Credential retrieval follows fallback chain: per-server → global → none
- Existing servers continue to work without reconfiguration
- All credentials encrypted at rest using existing encryption infrastructure

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage approach | Extend existing `credentials` table | Avoids new table complexity; compound unique constraint handles scoping |
| SSH key fallback | Global key as fallback | Per-server keys override; global used if not set |
| Sudo password scope | Global default + per-server override | Support both patterns without forcing choice |
| Migration default | Assume passwordless sudo | Existing servers work without reconfiguration |
| Username storage | Server model field | Simple, doesn't need encryption |

---

## Schema Changes

### Credentials Table Extension

```sql
-- Add optional server_id to existing credentials table
ALTER TABLE credentials ADD COLUMN server_id VARCHAR(100) REFERENCES servers(id) ON DELETE CASCADE;

-- Change unique constraint from credential_type alone to compound
-- NULL server_id = global, non-NULL = per-server
DROP INDEX IF EXISTS ix_credentials_credential_type;
CREATE UNIQUE INDEX idx_credentials_type_server
    ON credentials(credential_type, COALESCE(server_id, '__global__'));
```

### Server Model Additions

```sql
ALTER TABLE servers ADD COLUMN ssh_username VARCHAR(255);  -- Per-host override
ALTER TABLE servers ADD COLUMN sudo_mode VARCHAR(20) DEFAULT 'passwordless';  -- 'passwordless' | 'password'
```

### New Credential Types

| Type | server_id | Purpose |
|------|-----------|---------|
| `ssh_private_key` | NULL | Global default SSH key (existing) |
| `ssh_private_key` | {server_id} | Per-server SSH key override |
| `sudo_password` | NULL | Global default sudo password |
| `sudo_password` | {server_id} | Per-server sudo password override |
| `ssh_password` | {server_id} | Per-server SSH password (if not using key) |

---

## Credential Retrieval Logic

```python
async def get_effective_credential(
    credential_type: str,
    server_id: str | None = None
) -> str | None:
    """
    Retrieval order:
    1. Per-server credential (if server_id provided and exists)
    2. Global credential (if exists)
    3. None (credential not configured)
    """
    if server_id:
        per_server = await get_credential(credential_type, server_id)
        if per_server:
            return per_server
    return await get_credential(credential_type, server_id=None)  # Global
```

---

## User Stories

### US0083: Per-Server Credential Schema
**Story Points:** 3
**Priority:** P0
**Dependencies:** None

**As a** system administrator
**I want** the database to support per-server credentials
**So that** I can configure different credentials for different servers

**Acceptance Criteria:**
- [ ] `credentials` table has `server_id` foreign key column
- [ ] Unique constraint allows same credential_type for different servers
- [ ] Server model has `ssh_username` field (nullable)
- [ ] Server model has `sudo_mode` field (default: 'passwordless')
- [ ] Alembic migration applies cleanly
- [ ] Existing credentials remain valid (server_id = NULL for global)

---

### US0084: Credential Service Per-Host Support
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0083

**As a** system administrator
**I want** the credential service to support per-server credentials
**So that** operations use the correct credentials for each server

**Acceptance Criteria:**
- [ ] `store_credential()` accepts optional `server_id` parameter
- [ ] `get_credential()` accepts optional `server_id` parameter
- [ ] `get_effective_credential()` implements fallback chain
- [ ] `delete_credential()` supports per-server deletion
- [ ] `credential_exists()` supports per-server check
- [ ] ALLOWED_CREDENTIAL_TYPES updated to include `sudo_password`, `ssh_password`
- [ ] Unit tests cover all credential retrieval scenarios

---

### US0085: Fix Agent Upgrade Sudo Support
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0084

**As a** system administrator
**I want** agent upgrade to work on servers requiring sudo password
**So that** I can upgrade agents across my entire fleet

**Acceptance Criteria:**
- [ ] `upgrade_agent()` accepts optional `sudo_password` parameter
- [ ] Upgrade command uses password pipe when sudo_password provided
- [ ] Stored sudo_password retrieved automatically if not provided
- [ ] Upgrade works on passwordless sudo servers (backward compatible)
- [ ] Upgrade works on password-required sudo servers
- [ ] Clear error message when sudo password needed but not available

---

### US0086: Fix Agent Removal Sudo Support
**Story Points:** 3
**Priority:** P0
**Dependencies:** US0084

**As a** system administrator
**I want** agent removal to work on servers requiring sudo password
**So that** I can cleanly remove agents from any server

**Acceptance Criteria:**
- [ ] `remove_agent()` accepts optional `sudo_password` parameter (separate from `ssh_password`)
- [ ] Removal command uses password pipe when sudo_password provided
- [ ] Stored sudo_password retrieved automatically if not provided
- [ ] Removal works on passwordless sudo servers (backward compatible)
- [ ] Removal works on password-required sudo servers
- [ ] Clear error message when sudo password needed but not available

---

### US0087: Per-Server Credential API Endpoints
**Story Points:** 5
**Priority:** P1
**Dependencies:** US0084

**As a** system administrator
**I want** API endpoints to manage per-server credentials
**So that** I can configure credentials via the dashboard

**Acceptance Criteria:**
- [ ] `GET /api/v1/servers/{server_id}/credentials` lists server credentials
- [ ] `POST /api/v1/servers/{server_id}/credentials` stores server credential
- [ ] `DELETE /api/v1/servers/{server_id}/credentials/{type}` removes credential
- [ ] `PATCH /api/v1/servers/{server_id}` updates ssh_username, sudo_mode
- [ ] Response never includes decrypted credential values
- [ ] Response includes credential type and existence status
- [ ] OpenAPI documentation complete

---

### US0088: Server Credential Management UI
**Story Points:** 5
**Priority:** P1
**Dependencies:** US0087

**As a** system administrator
**I want** to manage per-server credentials in the dashboard
**So that** I can configure credentials without using the API directly

**Acceptance Criteria:**
- [ ] Server detail page has "Credentials" tab/section
- [ ] Can view which credential types are configured
- [ ] Can set/update SSH username override
- [ ] Can set sudo mode (passwordless/password)
- [ ] Can upload per-server SSH key
- [ ] Can set per-server sudo password
- [ ] Can remove per-server credentials (falls back to global)
- [ ] Clear indication of which credentials are per-server vs global

---

## Implementation Order

```
US0083 (Schema)
    ↓
US0084 (Service)
    ↓
┌───┴───┐
↓       ↓
US0085  US0086  (Can be parallel - both depend on US0084)
(Upgrade) (Remove)
    ↓
US0087 (API)
    ↓
US0088 (UI)
```

---

## Technical Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Hub (FastAPI)                             │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Credential Service (Extended)                 │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  store_credential(type, value, server_id=None)  │  │  │
│  │  │  get_credential(type, server_id=None)           │  │  │
│  │  │  get_effective_credential(type, server_id)      │  │  │
│  │  │    → per-server → global → None                 │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Agent Deployment Service (Fixed)              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  upgrade_agent(server_id, sudo_password=None)   │  │  │
│  │  │  remove_agent(server_id, sudo_password=None)    │  │  │
│  │  │    → retrieves stored credential if not provided │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Database (SQLite)                             │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  credentials (server_id FK, compound unique)    │  │  │
│  │  │  servers (ssh_username, sudo_mode)              │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### API Endpoints

```
# Existing (unchanged)
GET    /api/v1/settings/ssh/status          # Global SSH config status
POST   /api/v1/settings/ssh/key             # Upload global SSH key
DELETE /api/v1/settings/ssh/key             # Remove global SSH key

# New (per-server)
GET    /api/v1/servers/{id}/credentials     # List server credentials
POST   /api/v1/servers/{id}/credentials     # Store server credential
DELETE /api/v1/servers/{id}/credentials/{type}  # Remove server credential

# Updated (server fields)
PATCH  /api/v1/servers/{id}                 # Update ssh_username, sudo_mode
```

---

## Files to Modify

### New Files
- `migrations/versions/xxx_add_per_server_credentials.py`
- `frontend/src/components/ServerCredentials.tsx`

### Modified Files

| File | Changes |
|------|---------|
| `backend/src/homelab_cmd/db/models/credential.py` | Add `server_id` FK |
| `backend/src/homelab_cmd/db/models/server.py` | Add `ssh_username`, `sudo_mode` fields |
| `backend/src/homelab_cmd/services/credential_service.py` | Per-server support, new methods |
| `backend/src/homelab_cmd/services/agent_deploy.py` | Add `sudo_password` to upgrade/remove |
| `backend/src/homelab_cmd/api/routes/servers.py` | Credential management endpoints |
| `backend/src/homelab_cmd/api/schemas/server.py` | Credential request/response schemas |
| `frontend/src/pages/ServerDetail.tsx` | Integrate credentials UI |

---

## Testing Strategy

### Unit Tests
- Credential service retrieval with fallback chain
- Sudo password retrieval (per-server → global → none)
- Server model with new fields

### Integration Tests
- Upgrade agent on server requiring sudo password
- Remove agent on server requiring sudo password
- Store and retrieve per-server credentials
- Credential type validation

### E2E Tests
- Configure per-server credentials via UI
- Configure global sudo password via Settings
- Upgrade agent with stored credentials

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration breaks existing credentials | High | server_id defaults to NULL; existing records unchanged |
| Sudo password exposure | High | Use password pipe, clear from memory, encrypted storage |
| Breaking change to upgrade API | Medium | sudo_password parameter is optional, defaults to stored |
| Complex credential resolution | Low | Clear fallback chain, comprehensive testing |

---

## Story Breakdown

| Story | Description | Points | Status | Dependencies |
|-------|-------------|--------|--------|--------------|
| [US0083](../stories/US0083-per-server-credential-schema.md) | Per-Server Credential Schema | 3 | Done | None |
| [US0084](../stories/US0084-credential-service-per-host.md) | Credential Service Per-Host Support | 5 | Done | US0083 |
| [US0085](../stories/US0085-agent-upgrade-sudo-support.md) | Fix Agent Upgrade Sudo Support | 3 | Ready | US0084 |
| [US0086](../stories/US0086-agent-removal-sudo-support.md) | Fix Agent Removal Sudo Support | 3 | Ready | US0084 |
| [US0087](../stories/US0087-per-server-credential-api.md) | Per-Server Credential API Endpoints | 5 | Ready | US0084 |
| [US0088](../stories/US0088-server-credential-ui.md) | Server Credential Management UI | 5 | Ready | US0087 |
| **Total** | | **24** | | |

**Recommended Implementation Order:**
1. US0083 → 2. US0084 → 3. US0085 & US0086 (parallel) → 4. US0087 → 5. US0088

---

**Created:** 2026-01-27
**Last Updated:** 2026-01-27
**Epic Owner:** Darren

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial epic creation with 6 stories, 24 points |
| 2026-01-27 | Claude | Epic review: US0083, US0084 implemented (8/24 pts, 33%). Status updated to In Progress. |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
