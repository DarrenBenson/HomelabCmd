# US0051: Package Update List View

> **Status:** Done
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Owner:** Darren
> **Created:** 2026-01-20
> **Story Points:** 5

## User Story

**As a** Darren (Homelab Operator)
**I want** to see which specific packages need updating on each server
**So that** I can assess the importance of updates and make informed decisions about when to apply them

## Context

### Persona Reference

**Darren** - Wants visibility into server maintenance status. Needs to know what packages are outdated before deciding to update.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

US0044 implemented package update counts displayed on server cards and detail views. However, only aggregate counts are shown - users cannot see which specific packages need updating. This makes it difficult to assess urgency (is it just a font update or a critical SSL library?) or plan maintenance windows.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Scope | Core monitoring functions | Package list is monitoring data |
| Data | Agent-collected metrics | Agent must parse apt output |
| Platform | Debian-based servers | apt list command dependency |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Dashboard < 2 seconds | Package list query must be efficient |
| Design | Brand guide compliance | Table styling follows brand-guide.md |
| UX | Minimal clicks to insight | Expandable section, not separate page |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Agent collects package list

- **Given** the agent is running on a Debian-based server
- **When** collecting metrics for heartbeat
- **Then** the list of upgradable packages is collected with name, current version, new version, and repository

### AC2: Package list stored in database

- **Given** an agent sends a heartbeat with package update data
- **When** the backend processes the heartbeat
- **Then** the package list is stored and associated with the server

### AC3: Package list displayed in server detail

- **Given** viewing the server detail page for a server with pending updates
- **When** expanding the Updates section
- **Then** a table shows each package name, current version, available version, and whether it's a security update

### AC4: Package list filterable by type

- **Given** viewing the package update list
- **When** filtering by "security only"
- **Then** only packages from security repositories are shown

### AC5: Package list refreshed on heartbeat

- **Given** a server's package list changes (new updates available or updates applied)
- **When** the next heartbeat is processed
- **Then** the displayed package list reflects the current state

## Scope

### In Scope

- Agent collection of individual package names and versions
- New database table for package update details
- API endpoint to fetch package list for a server
- Server detail view package list component
- Security package highlighting
- Basic filtering (all/security only)

### Out of Scope

- Triggering updates from dashboard (see US0052)
- Package changelogs or CVE details
- Non-Debian package managers (yum, dnf)
- Historical package update data

## UI/UX Requirements

### Server Detail Updates Section (Expanded)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ System Updates                                              [Collapse ▲]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Available: 12 total, 3 security          [All ▼] [Security Only]       │
│  Last Checked: 2026-01-20 10:30 UTC                                     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Package              │ Current    │ Available  │ Type              │ │
│  ├──────────────────────┼────────────┼────────────┼───────────────────┤ │
│  │ openssl              │ 3.0.13     │ 3.0.14     │ 🔒 Security       │ │
│  │ libssl3              │ 3.0.13     │ 3.0.14     │ 🔒 Security       │ │
│  │ linux-image-6.1      │ 6.1.90     │ 6.1.94     │ 🔒 Security       │ │
│  │ vim                  │ 9.0.1378   │ 9.0.1499   │ Standard          │ │
│  │ curl                 │ 7.88.1     │ 7.88.2     │ Standard          │ │
│  │ ...                  │            │            │                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [Run apt update] [Apply All Updates]                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Colour Coding

| Type | Display |
|------|---------|
| Security update | Warning colour with lock icon |
| Standard update | Default text colour |

## Technical Notes

### Agent Implementation

```python
def get_package_update_list() -> list[dict]:
    """Get list of upgradable packages on Debian-based systems."""
    try:
        result = subprocess.run(
            ['apt', 'list', '--upgradable'],
            capture_output=True,
            text=True,
            timeout=30
        )

        packages = []
        for line in result.stdout.strip().split('\n')[1:]:  # Skip header
            if not line:
                continue
            # Format: package/repo version arch [upgradable from: old_version]
            match = re.match(
                r'(\S+)/(\S+)\s+(\S+)\s+\S+\s+\[upgradable from: (\S+)\]',
                line
            )
            if match:
                packages.append({
                    'name': match.group(1),
                    'repository': match.group(2),
                    'new_version': match.group(3),
                    'current_version': match.group(4),
                    'is_security': 'security' in match.group(2).lower()
                })

        return packages
    except Exception as e:
        logger.warning(f"Failed to get package list: {e}")
        return []
```

### API Contracts

**GET /api/v1/servers/{server_id}/packages**

Response:
```json
{
  "server_id": "uuid",
  "last_checked": "2026-01-20T10:30:00Z",
  "total_count": 12,
  "security_count": 3,
  "packages": [
    {
      "name": "openssl",
      "current_version": "3.0.13",
      "new_version": "3.0.14",
      "repository": "bookworm-security",
      "is_security": true
    }
  ]
}
```

### Data Requirements

New table: `pending_packages`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| server_id | UUID | Foreign key to servers |
| name | VARCHAR | Package name |
| current_version | VARCHAR | Currently installed version |
| new_version | VARCHAR | Available version |
| repository | VARCHAR | Source repository |
| is_security | BOOLEAN | True if from security repo |
| detected_at | TIMESTAMP | When first seen |
| updated_at | TIMESTAMP | Last heartbeat update |

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| apt not available (non-Debian) | Agent returns empty list, API returns 200 with `packages: []`, UI shows "Package information not available" |
| Very large package list (100+) | API returns all packages, frontend paginates (shows 25 per page with pagination controls) |
| Package removed between heartbeats | Backend deletes package from `pending_packages` table on next heartbeat |
| Same package, version changed | Backend updates existing record's `new_version` and `updated_at` fields |
| Server not found | GET /api/v1/servers/{id}/packages returns 404 with `{"detail": "Server not found"}` |
| Server exists but no heartbeat yet | API returns 200 with `packages: []`, `last_checked: null` |
| apt list command times out | Agent logs warning, returns empty list, UI shows stale data with last successful check time |
| Package name contains special chars | Store and display correctly (UTF-8 support) |
| Repository field contains colons/slashes | Parse and store correctly (e.g., "bookworm-security/main") |
| Concurrent heartbeat updates | Database upsert handles race condition gracefully |

## Test Scenarios

- [x] Agent collects full package list (TC175-TC178)
- [x] Package list stored in database correctly (TC179-TC182)
- [x] API returns package list for server (TC183-TC185)
- [x] Frontend displays package table (PackageList.test.tsx - 27 tests)
- [x] Security filter works correctly (PackageList.test.tsx filter tests)
- [x] Package list updates on heartbeat (TC188-TC189)
- [x] Empty state when no updates available (PackageList.test.tsx empty state)

## Test Cases

| ID | AC | Test Description | Expected Result |
|----|----|--------------------|-----------------|
| TC1 | AC1 | Agent collects upgradable packages on Debian server | Returns list with name, versions, repository, security flag |
| TC2 | AC1 | Agent on non-Debian system | Returns empty list gracefully |
| TC3 | AC2 | Heartbeat contains package data | Package records created in pending_packages table |
| TC4 | AC2 | Heartbeat updates existing packages | Existing records updated, removed packages deleted |
| TC5 | AC3 | Server detail shows package table | Table displays all packages with columns |
| TC6 | AC3 | Server with no pending updates | Shows "No updates available" message |
| TC7 | AC4 | Filter by security only | Only security packages displayed |
| TC8 | AC4 | Filter shows counts | Filter buttons show package counts |
| TC9 | AC5 | Package list changes between heartbeats | UI reflects updated package list |
| TC10 | AC5 | All packages applied | Table shows empty state after update |

## Quality Checklist

- [x] All acceptance criteria have corresponding test cases (AC1-AC5 mapped to TC175-TC189)
- [x] Edge cases documented and tested (10 edge cases, all covered)
- [x] API contracts validated with integration tests (19 tests passing)
- [ ] Agent tested on OMV and Raspberry Pi OS (requires deployment)
- [x] Package list pagination tested with 100+ packages (TC in test_large_package_list)
- [x] Database schema reviewed (PendingPackage model with proper constraints)
- [x] Performance tested with large package lists (105 packages tested)

## Ready Status Gate

| Gate | Status | Notes |
|------|--------|-------|
| AC coverage | Pass | All 5 ACs mapped to test cases (TC1-TC10) |
| Edge cases | Pass | 10 edge cases documented (exceeds minimum 8 for API story) |
| Dependencies met | Pass | US0044 is Done |
| Technical design | Pass | API contract, schema, agent code all defined |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0044: Package Update Display | Story | Done |

## Estimation

**Story Points:** 5

**Complexity:** Medium - new data model, agent changes, API, and frontend component

## Open Questions

None

## Implementation Notes

### Backend Implementation Complete

1. **Agent Collection** (`agent/collectors.py:210-279`)
   - New `get_package_update_list()` function parses `apt list --upgradable`
   - Returns list of dicts with name, versions, repository, is_security flag
   - Handles non-Debian systems, timeouts, and errors gracefully

2. **Database Model** (`backend/src/homelab_cmd/db/models/pending_package.py`)
   - `PendingPackage` model with unique constraint on (server_id, name)
   - Cascade delete with Server model
   - Timestamps for detected_at and updated_at

3. **API Endpoint** (`backend/src/homelab_cmd/api/routes/servers.py:361-406`)
   - `GET /api/v1/servers/{server_id}/packages`
   - Returns PackageListResponse with counts and package list
   - 404 for unknown server, 200 with empty list for new server

4. **Heartbeat Processing** (`backend/src/homelab_cmd/api/routes/agents.py:236-260`)
   - Accepts `packages` array in HeartbeatRequest
   - Bulk delete existing + insert new on each heartbeat
   - Preserves existing packages if `packages` field not provided (backward compat)

### Frontend Implementation Complete

1. **PackageList Component** (`frontend/src/components/PackageList.tsx`)
   - Displays package table with name, current version, available version, type
   - Collapsible section with badge counts (total/security)
   - Filter toggle buttons: All / Security Only
   - Pagination (25 per page) for large package lists
   - Action buttons: Refresh List, Apply Security, Apply All
   - Loading, error, and empty states handled

2. **Type Definitions** (`frontend/src/types/server.ts:52-67`)
   - `Package` interface with all required fields
   - `PackagesResponse` interface matching API contract

3. **API Client** (`frontend/src/api/servers.ts:35-37`)
   - `getServerPackages(serverId)` fetches package list from API

4. **Integration** (`frontend/src/pages/ServerDetail.tsx:399-404`)
   - PackageList component replaces old simple update counts card
   - Renders in System Updates section on server detail page

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-20 | Claude | Expanded edge cases to 10 (API story minimum), marked Ready |
| 2026-01-20 | Claude | Backend implementation complete: agent, model, API, heartbeat processing (19 tests passing) |
| 2026-01-20 | Claude | Frontend implementation complete: PackageList component, filter toggle, pagination, action buttons |
| 2026-01-20 | Claude | Frontend tests added: PackageList.test.tsx with 27 tests covering all AC |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
