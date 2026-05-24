# CR-0009: Read backend API key from a mounted secret/file, not container env

> **Status:** Proposed
> **Priority:** P3
> **Type:** design-change
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** backend config loader, docker-compose.yml, README
> **Depends on:** none (cleaner once CR-0008 lands but not required)
> **GitHub Issue:** (not yet synced)

## Summary

`HOMELAB_CMD_API_KEY` is exposed in the backend container's environment block today, so any caller with `docker exec backend env` (i.e. anyone with shell access on the host) can read it. This is exactly how I extracted it this morning to mint the 10 registration tokens. Move the key onto a mounted file (Docker secret or read-only bind mount) and treat the env var path as an explicit dev-only fallback.

## Problem

This morning, to mint tokens via the admin API, I ran:

```bash
ssh ops@appserver1 'sudo docker exec homelab-cmd-backend env | grep API_KEY'
# HOMELAB_CMD_API_KEY=93216dfcc4dfc59700885720bb7cd69fc223d530500a25b9a926c065bfb9a7da
```

That worked because the key was passed via `env:` in `docker-compose.yml` (or from the root `.env` file referenced via `env_file:`). Any process inside the container can read its own env; any user with permission to run `docker exec` on the host can read it from outside.

It's homelab and the host is locked down, so the practical exposure is low. But the env-var path is a structural weakness: it ends up in `docker inspect` output, in container metadata, in any error log that dumps environment, and in any process listing that exposes `/proc/<pid>/environ` to a snoop. Files are easier to keep narrow.

---

## Proposed Changes

### Item 1: Read key from file path

**Priority:** P3
**Effort:** S

Backend config loader checks two paths in order:

1. `$HOMELAB_CMD_API_KEY_FILE` (default `/run/secrets/api_key`) – if file exists and is readable, read the key from there.
2. `$HOMELAB_CMD_API_KEY` – fallback only; log a WARN at startup if this is the active path.

Same change for `HOMELAB_CMD_ENCRYPTION_KEY` (`_FILE` variant).

### Item 2: docker-compose updated to use Docker secrets

**Priority:** P3
**Effort:** S

Docker Compose has first-class secret support:

```yaml
secrets:
  api_key:
    file: ./secrets/api_key
  encryption_key:
    file: ./secrets/encryption_key

services:
  backend:
    secrets:
      - api_key
      - encryption_key
    environment:
      HOMELAB_CMD_API_KEY_FILE: /run/secrets/api_key
      HOMELAB_CMD_ENCRYPTION_KEY_FILE: /run/secrets/encryption_key
```

The host file lives at `./secrets/api_key` (gitignored). `docker exec backend env` no longer reveals the key; `docker exec backend cat /run/secrets/api_key` does, but that's a more deliberate action and the file is owned by uid 0 (root in container, root on host – read access requires sudo on the host).

### Item 3: Migration helper

**Priority:** P3
**Effort:** S

Small bash one-liner in README's upgrade notes for moving from env-var to file:

```bash
mkdir -p ./secrets && chmod 700 ./secrets
grep -E '^HOMELAB_CMD_(API|ENCRYPTION)_KEY=' .env | while IFS='=' read -r k v; do
  case "$k" in
    HOMELAB_CMD_API_KEY)        printf '%s' "$v" > ./secrets/api_key ;;
    HOMELAB_CMD_ENCRYPTION_KEY) printf '%s' "$v" > ./secrets/encryption_key ;;
  esac
  chmod 600 ./secrets/*
done
# Comment out the env-var lines in .env, then `docker compose up -d`.
```

---

## Impact Assessment

### Existing Functionality

The existing env-var path keeps working as a fallback, so upgrading is a "do it when convenient" change, not a breaking one. Tests and dev setups that rely on env vars continue to function.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `backend/src/homelab_cmd/config/loader.py` (or wherever config is read) | Add `_FILE` variants with fallback | Modified |
| `docker-compose.yml` | Add `secrets:` blocks + map into backend service | Modified |
| `README.md` | "Production secrets" section + migration helper | Modified |
| `.gitignore` | Add `secrets/` directory | Modified |

### Breaking Changes

None on the upgrade path.

---

## Acceptance Criteria

- [ ] Backend config loader reads `HOMELAB_CMD_API_KEY` from `$HOMELAB_CMD_API_KEY_FILE` when the file exists; falls back to env var with a startup WARN.
- [ ] Same pattern for `HOMELAB_CMD_ENCRYPTION_KEY`.
- [ ] `docker-compose.yml` includes the secrets pattern documented in Item 2.
- [ ] After migration: `docker exec backend env | grep -i api_key` returns nothing (or only `HOMELAB_CMD_API_KEY_FILE=/run/secrets/api_key`, not the value).
- [ ] Backend continues to authenticate API requests correctly.
- [ ] README migration helper exits with the secrets directory populated and gitignored.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Secrets file world-readable on host | Medium | High | README mandates `chmod 700 secrets/` + `chmod 600 secrets/*` |
| Operator migrates secrets but forgets to remove env-var lines from `.env` – key now in two places | Medium | Low | WARN at startup when both paths are populated, with the env-var path taking precedence (operator behaviour matches docs) |
| Restore from CR-0005's backup interacts oddly if the new hub uses file-based secrets and the dump references an env-derived encryption key – key mismatch detection in CR-0005 covers this | Low | Medium | Cross-CR test: dump on env-keys hub → restore on file-keys hub with matching key contents → all encrypted credentials decrypt cleanly |

---

## Dependencies

### CR Dependencies

None.

### External Dependencies

None (Docker Compose secrets are stable; not Swarm-specific).

---

## Linked Epics

> *Populated when CR is actioned via `/sdlc-studio cr action`*

| Epic | Title | Status |
| --- | --- | --- |
| _none yet_ | | |

---

## Out of Scope

- Vault / Bitwarden Secrets Manager integration (overkill for homelab).
- Per-environment secrets (dev / staging / prod) – only "prod"-style deployments exist here.

---

## Open Questions

- [ ] Should the WARN escalate to a startup refusal once file-based mode is mature, to push operators off the env path? (Recommendation: phased – warn for one minor release, refuse in the next.) — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed. Trigger: extracted the admin key via `docker exec backend env` this morning to mint registration tokens; works fine but represents broader-than-necessary exposure. |
