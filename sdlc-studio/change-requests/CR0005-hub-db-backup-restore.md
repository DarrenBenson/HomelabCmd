# CR-0005: Hub DB backup + restore

> **Status:** Proposed
> **Priority:** P2
> **Type:** feature-request
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** backend (new admin endpoints), docker-compose, README
> **Depends on:** none
> **GitHub Issue:** (not yet synced)

## Summary

HomelabCmd's hub holds the canonical inventory of every registered agent (`server_guid`, hostname, IP, last heartbeat, agent token hash, credentials, audit history). Today there is no built-in backup or restore path: when the hub on the operator's workstation went dark this morning and a new hub came up on appserver1, every agent in the fleet had to be re-registered from scratch because the workstation's database wasn't preserved. Add nightly DB dumps, an admin endpoint for on-demand dumps, and a restore path so the same situation in the future becomes a 30-second operation instead of a 30-minute re-registration sweep.

## Problem

What actually happened today: the operator stood up a new HomelabCmd hub on appserver1 (`http://10.0.0.206:8080`). The 7 existing agents (homeserver, backupserver, webserver1, webserver2, mediaserver, cloudserver1, agentbox01) were still configured to talk to the old hub at `http://10.0.0.63:8080` (the workstation). When the workstation hub was no longer running, all 7 agents were silently failing their heartbeats (the agent service shows `active` regardless of heartbeat success).

Trying the existing agents' tokens against the new hub returned `401 UNAUTHORIZED` because the new hub has a fresh database. So all 10 hosts (7 existing + 3 new) had to be re-registered, losing months of audit history, alert state, and any UI preferences.

This wasn't an exotic failure mode – it was a routine "move the service to a more permanent host" event. HomelabCmd needs to make this routine. Two pieces are missing: a way to capture state (backup) and a way to bring it back (restore) on a different hub instance.

---

## Proposed Changes

### Item 1: Nightly DB dump

**Priority:** P2
**Effort:** S

Backend container's startup wires a cron-style schedule (APScheduler is already in use for the alert engine):

- Default schedule: 03:00 daily.
- Default output: `/var/lib/homelabcmd/backups/homelabcmd-YYYY-MM-DD.sql.gz` (volume-mounted in compose).
- Retention: 30 days (oldest pruned automatically).
- Config via env vars: `HOMELAB_CMD_BACKUP_ENABLED`, `HOMELAB_CMD_BACKUP_PATH`, `HOMELAB_CMD_BACKUP_RETAIN_DAYS`, `HOMELAB_CMD_BACKUP_CRON`.

Dump format: SQL dump for portability across hub instances (Postgres → `pg_dump`; SQLite → `sqlite3 .dump` or `VACUUM INTO`).

### Item 2: `POST /api/v1/admin/backup` on-demand

**Priority:** P2
**Effort:** S

Admin-only endpoint (requires admin key; once CR-0008 lands, requires admin scope). Triggers an immediate dump to the configured path and returns the file's checksum + size. Useful before risky operations (DB schema upgrade, hub migration).

CLI counterpart (relies on CR-0004's CLI scaffolding once that lands): `homelabcmd-cli admin backup`.

### Item 3: `POST /api/v1/admin/restore` for fresh hubs

**Priority:** P2
**Effort:** M

Admin-only endpoint that accepts a dump file (or a path on the hub container) and replaces the current DB contents with the restored state. Includes a safety check (dry-run by default; requires `confirm: true` to actually overwrite).

Restore preserves:

- Server records (so existing agent tokens continue to authenticate).
- Pending registration tokens (if still in their TTL window).
- Audit history.
- Encrypted credential blobs (so SSH keys / sudo passwords don't need re-entry, assuming the same `HOMELAB_CMD_ENCRYPTION_KEY` is in scope).

Restore does NOT preserve:

- Current heartbeat timestamps (those re-establish as agents check in).
- Server `status` (re-computed from incoming heartbeats).

### Item 4: Hub migration runbook in README

**Priority:** P3
**Effort:** S

"## Migrating the hub to a new host" section walking through: backup on old host → stop old hub → bring up new hub with same `HOMELAB_CMD_API_KEY` and `HOMELAB_CMD_ENCRYPTION_KEY` → restore → confirm agents resume heartbeats without operator action.

---

## Impact Assessment

### Existing Functionality

No change to running agents or to the SPA. Adds two new admin routes and one volume mount.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `backend/src/homelab_cmd/api/routes/admin.py` (new or existing) | New `/backup` and `/restore` endpoints | New / Modified |
| `backend/src/homelab_cmd/services/backup.py` | New scheduled job + dump/restore logic | New |
| `docker-compose.yml` | Volume mount `/var/lib/homelabcmd/backups` | Modified |
| `README.md` | "Migrating the hub" section | Modified |

### Breaking Changes

None.

---

## Acceptance Criteria

- [ ] Nightly dump runs at the configured time and produces a valid `.sql.gz` file in the configured path.
- [ ] Retention policy prunes dumps older than `HOMELAB_CMD_BACKUP_RETAIN_DAYS` automatically.
- [ ] `POST /api/v1/admin/backup` produces an immediate dump and returns its checksum.
- [ ] `POST /api/v1/admin/restore` with `dry_run: true` (default) reports the entity counts that would be restored.
- [ ] `POST /api/v1/admin/restore` with `confirm: true` replaces DB contents successfully.
- [ ] End-to-end migration drill: dump on hub A → stop hub A → start hub B with the same encryption key → restore → all 10 agents resume heartbeating against hub B without operator action.
- [ ] Restore refuses to overwrite a non-empty DB without `confirm: true` AND a matching `expected_server_count` to prevent accidental clobber.
- [ ] Audit table records who triggered the backup / restore.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Restore wipes a healthy DB accidentally | Low | Critical | Two-factor confirm (`confirm: true` + `expected_server_count`); admin-only |
| Encryption key mismatch silently leaves credentials unreadable | Medium | High | Restore validates a sentinel value encrypted under the current key; aborts on mismatch |
| Backup file world-readable on the host | Medium | High | Default file mode 0640, owner = backend container user; volume mount restricted by host file perms |
| Disk fills with old dumps if retention misconfigured | Low | Medium | Retention enforced server-side; warn in metrics if backups directory exceeds N% of available space |

---

## Dependencies

### CR Dependencies

| CR | Title | Status | Required Before |
| --- | --- | --- | --- |
| [CR-0008](CR0008-scoped-api-keys.md) | Scoped API keys | Proposed | Optional – nicer if backup/restore require an `admin` scope explicitly |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| `pg_dump` / `pg_restore` (Postgres) OR sqlite3 CLI | OS package | Available in backend container base image |
| APScheduler (already in use) | Library | Present |

---

## Linked Epics

> *Populated when CR is actioned via `/sdlc-studio cr action`*

| Epic | Title | Status |
| --- | --- | --- |
| _none yet_ | | |

---

## Out of Scope

- Off-host backup destinations (S3, B2, restic). Operator can drive that via filesystem-level tooling on the mounted backups directory.
- Point-in-time recovery / WAL streaming. SQL dump suffices for the homelab use case.
- Schema migrations across hub versions during restore (assume hub A and hub B are the same version).

---

## Open Questions

- [ ] Should the dump include encrypted credential blobs? If yes, document the encryption-key dependency strongly so operators don't ship dumps alongside a published encryption key. — Owner: project lead
- [ ] Single dump file or split per-table (better selective restore)? — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Concrete trigger: hub migration this morning (workstation → appserver1) lost all server records; all 10 agents had to be re-registered from scratch because there was no backup to restore. |
