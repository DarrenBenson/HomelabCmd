# Change Request Registry

**Last Updated:** 2026-05-24
**PRD Reference:** [Product Requirements Document](../prd.md)

## Summary

| Status | Count |
| --- | --- |
| Proposed | 12 |
| Approved | 0 |
| In Progress | 0 |
| Complete | 0 |
| Rejected | 0 |
| Deferred | 0 |
| **Total** | **12** |

## By Priority

| Priority | Proposed | Approved | In Progress | Complete |
| --- | --- | --- | --- | --- |
| P1 | 1 | 0 | 0 | 0 |
| P2 | 7 | 0 | 0 | 0 |
| P3 | 4 | 0 | 0 | 0 |
| P4 | 0 | 0 | 0 | 0 |

## All Change Requests

| ID | Title | Priority | Status | Type | Linked Epics | Date |
| --- | --- | --- | --- | --- | --- | --- |
| [CR-0001](CR0001-frontend-server-side-api-key-injection.md) | Move VITE_API_KEY from client bundle to server-side nginx injection | P2 | Proposed | design-change | _none_ | 2026-05-24 |
| [CR-0002](CR0002-hub-mcp-server.md) | HomelabCmd MCP server (read + whitelisted execute) | P1 | Proposed | feature-request | _none_ | 2026-05-24 |
| [CR-0003](CR0003-install-sh-option-parity-dns-resilience.md) | Hub-served install.sh option parity + DNS resilience | P2 | Proposed | production-feedback | _none_ | 2026-05-24 |
| [CR-0004](CR0004-fleet-install-bulk-deploy.md) | Fleet install / bulk-deploy endpoint + CLI | P2 | Proposed | feature-request | _none_ | 2026-05-24 |
| [CR-0005](CR0005-hub-db-backup-restore.md) | Hub DB backup + restore | P2 | Proposed | feature-request | _none_ | 2026-05-24 |
| [CR-0006](CR0006-stale-token-cleanup.md) | Stale-token bulk cleanup primitive | P3 | Proposed | production-feedback | _none_ | 2026-05-24 |
| [CR-0007](CR0007-agent-hostname-self-heal.md) | Agent self-heals on hostname change | P3 | Proposed | production-feedback | _none_ | 2026-05-24 |
| [CR-0008](CR0008-scoped-api-keys.md) | Scoped / role-based API keys | P2 | Proposed | design-change | _none_ | 2026-05-24 |
| [CR-0009](CR0009-api-key-from-secret-not-env.md) | Read backend API key from a mounted secret/file, not container env | P3 | Proposed | design-change | _none_ | 2026-05-24 |
| [CR-0010](CR0010-agent-hub-url-hot-reload.md) | Agent hub_url hot-reload via heartbeat ack | P2 | Proposed | feature-request | _none_ | 2026-05-24 |
| [CR-0011](CR0011-security-baseline-config-pack.md) | Security-Baseline 2026 configuration pack | P2 | Proposed | feature-request | _none_ | 2026-05-24 |
| [CR-0012](CR0012-telegram-home-assistant-channels.md) | Telegram + Home Assistant notification channels | P3 | Proposed | feature-request | _none_ | 2026-05-24 |

## Dependencies

| CR | Depends On | Dependency Status |
| --- | --- | --- |
| CR-0002 | (CR-0008 optional uplift) | Proposed |
| CR-0004 | CR-0003 | Proposed |
| CR-0005 | (CR-0008 optional uplift) | Proposed |
| CR-0007 | (CR-0010 shares helper) | Proposed |
| CR-0010 | (CR-0008 optional uplift) | Proposed |

## Recommended action order

Per the planning doc at `/home/darren/.claude/plans/i-want-you-to-delegated-alpaca.md` (2026-05-24):

1. **CR-0002** – MCP server (operator's headline ask)
2. **CR-0003** – install.sh DNS / option parity
3. **CR-0005** – Hub DB backup/restore
4. **CR-0008** – Scoped API keys
5. **CR-0004** – Bulk install
6. **CR-0010** – Hub-url hot-reload
7. **CR-0011** – Security baseline config pack
8. **CR-0006, CR-0007, CR-0009, CR-0012** – cleanups in any order

## Notes

- CRs are numbered globally (CR-0001, CR-0002, etc.)
- Priority: P1 (critical gap) > P2 (important) > P3 (desirable) > P4 (nice to have)
- Types: feature-request, production-feedback, spec-gap, retrospective, design-change
- Use `/sdlc-studio cr action --cr CR-NNNN` to turn a CR into epics and stories
