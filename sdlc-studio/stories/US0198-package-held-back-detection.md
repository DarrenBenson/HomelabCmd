# US0198: Package Held-Back Detection

> **Status:** Done

**Epic:** [EP0001 - Core Monitoring](../epics/EP0001-core-monitoring.md)
**Points:** 3
**Priority:** P1

---

## User Story

As a homelab operator, I want to see which packages are held back separately from upgradable packages, so I understand why certain updates won't be installed automatically.

## Acceptance Criteria

- [x] Agent detects held-back packages via `apt-get -s upgrade` parsing
- [x] Held-back packages distinguished from upgradable packages in heartbeat
- [x] API returns `held_back_count` field in server response
- [x] Frontend displays held-back count separately from updates available
- [x] Three hold types detected: phased rollouts, dependency conflicts, manual holds

## Technical Notes

### Backend Implementation

- `Server.held_back_count` field added to database model
- Migration: `c9542a8b9caf_add_held_back_count_to_server.py`
- `package_parser.py` service with `PackageStatus` class
- Heartbeat endpoint accepts `held_back_count` from agent

### Agent Implementation

- `get_package_updates()` in `collectors.py` parses apt output
- Distinguishes "kept back" packages from "will be upgraded"
- Returns `held_back_count` in heartbeat payload

### Detection Methods

1. **Phased rollouts** - Ubuntu/Debian percentage-based staged rollouts
2. **Dependency conflicts** - Packages that would break other packages
3. **Manual holds** - Packages marked via `apt-mark hold`

## Dependencies

- EP0001 Core Monitoring (base infrastructure)

## Test Coverage

- Backend: `test_package_status.py`
- Agent: Package parsing unit tests

## Implementation Date

2026-01-31

---

## Notes

- Retrofitted from existing implementation discovered during PRD review
- Feature was implemented but not formally documented as a story
