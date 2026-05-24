# CR-0001: Move VITE_API_KEY from client bundle to server-side nginx injection

> **Status:** Proposed
> **Priority:** P2
> **Type:** design-change
> **Requester:** Darren (operator)
> **Date:** 2026-05-24
> **Affects:** frontend, deployment
> **Depends on:** none
> **GitHub Issue:** (not yet synced)

## Summary

The frontend SPA currently reads the backend API key from a Vite **build-time** env var (`VITE_API_KEY`). The value is baked into the compiled JavaScript bundle (`/assets/index-*.js`) and sent by the SPA as the `X-API-Key` header on every API call. Anyone with browser access to the deployed URL can extract the key via DevTools or by curling the JS bundle directly. This CR replaces the client-side key handling with **server-side header injection** in the frontend's nginx reverse-proxy block, removing the key from any client-visible surface.

## Problem

`frontend/src/api/tailscale.ts` (and similar API helpers) does:

```ts
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-change-me';
```

Vite resolves `import.meta.env.VITE_API_KEY` at **build time**, hard-coding the literal value into the minified bundle. Live verification on the production deploy (2026-05-24, `homelab-cmd-frontend` v2.2.0 on appserver1) showed the operator's backend API key embedded verbatim in `/assets/index-CYUTeHkP.js`. Any client that can reach `https://homelabcmd.home.lan` can `curl` that bundle and recover the key.

For the current `.home.lan` LAN-only deployment this is tolerable homelab posture, but:

- It violates least-privilege: a browser visitor shouldn't need admin-equivalent credentials.
- It blocks a future user-auth layer (HTTP Basic at NPM, OIDC, etc.) because anyone who reaches the SPA already has full API access regardless of any login gate added.
- It complicates key rotation: rotating the backend's `HOMELAB_CMD_API_KEY` requires a frontend rebuild + redeploy in lockstep.
- It puts a long-lived bearer credential in browser cache, history, and any extension with DOM read access.

The deployed pattern documented in `frontend/nginx.conf` already proxies `/api/*` through nginx to the backend container. nginx is the natural place to attach the service credential server-side.

---

## Proposed Changes

### Item 1: Templated nginx.conf + envsubst entrypoint

**Priority:** P2
**Effort:** S

Convert `frontend/nginx.conf` into `nginx.conf.template` containing `${HOMELAB_API_KEY}` (or reused `${HOMELAB_CMD_API_KEY}`) placeholders. Add a container entrypoint that runs `envsubst '${HOMELAB_API_KEY}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf` before `nginx -g 'daemon off;'`. Inject in the `location /api/` block:

```nginx
proxy_set_header X-API-Key "${HOMELAB_API_KEY}";
```

`proxy_set_header` overrides anything the client sent, so the SPA's stale-in-dev key (or no key) is replaced server-side. The agent code path is unaffected — agents continue talking to the backend directly, not through this nginx.

### Item 2: Remove `VITE_API_KEY` from SPA source

**Priority:** P2
**Effort:** S

Strip `import.meta.env.VITE_API_KEY` references from:

- `frontend/src/api/tailscale.ts`
- `frontend/src/components/ExportButton.tsx`
- Anywhere else discovered via `grep -rn 'VITE_API_KEY' frontend/src/`

SPA `fetch` / `axios` calls drop the `X-API-Key` header entirely (or keep an empty stub that nginx overrides). Update tests under `frontend/src/__tests__/` and `frontend/src/components/*.test.tsx` to reflect that the SPA no longer sets the header.

### Item 3: docker-compose.yml frontend env wiring

**Priority:** P2
**Effort:** S

Add an `environment:` block to the frontend service in `docker-compose.yml` so the container receives `HOMELAB_API_KEY` (or `HOMELAB_CMD_API_KEY`) at start time. The root `.env` already holds `HOMELAB_CMD_API_KEY`; either reuse it directly or alias it. Update `frontend/.env.example` to document that `VITE_API_KEY` is **removed** and no longer needed.

### Item 4: Dev-mode parity

**Priority:** P3
**Effort:** S

For `npm run dev` (Vite dev server outside Docker), the SPA still needs a way to reach the backend in development. Two options to consider:

- The Vite dev server proxies `/api/*` to a local backend with the dev API key (config in `vite.config.ts`).
- A development-only `.env.local` still supports `VITE_API_KEY` but the production build path no longer reads it.

Option A is cleaner and keeps the production code path free of any client-side key handling.

---

## Impact Assessment

### Existing Functionality

| Path | Before | After |
| --- | --- | --- |
| SPA → `/api/v1/*` | SPA sends real key in `X-API-Key` (extracted from bundle) | SPA sends no key; nginx attaches it |
| Agent → backend | Direct LAN call with per-agent token | Unchanged (this CR does not touch the agent path) |
| Browser DevTools "view source" | API key visible in bundle | API key absent from bundle |
| Backend auth check | Receives valid key from SPA | Receives valid key from nginx — semantics identical |

No user-visible behaviour change. No data-model change. No agent recompile.

### Affected Modules

| Module | Impact | Change Type |
| --- | --- | --- |
| `frontend/nginx.conf` | Convert to template, add `proxy_set_header X-API-Key` | Modified |
| `frontend/Dockerfile` | Add envsubst entrypoint stage | Modified |
| `frontend/src/api/tailscale.ts` | Remove `VITE_API_KEY` usage | Modified |
| `frontend/src/components/ExportButton.tsx` | Remove `X-API-Key` header in fetch | Modified |
| `frontend/src/**/*.test.tsx`, `*.test.ts` | Update expectations | Modified |
| `frontend/.env.example` | Remove `VITE_API_KEY` line | Modified |
| `docker-compose.yml` | Pass key env to `frontend` service | Modified |
| `README.md` | Document the new auth boundary | Modified |

### Breaking Changes

None for production deploys. Anyone running `npm run dev` outside Docker against a non-proxied backend must adopt Item 4's dev-mode option.

---

## Acceptance Criteria

- [ ] `frontend/nginx.conf` (or `nginx.conf.template`) contains `proxy_set_header X-API-Key "${HOMELAB_API_KEY}";` in the `/api/` location block.
- [ ] Container entrypoint runs `envsubst` before `nginx -g 'daemon off;'`, and missing-env-var aborts startup with a clear message.
- [ ] `grep -r 'VITE_API_KEY' frontend/src` returns zero hits (excluding `.env.example` if retained for dev).
- [ ] Built JS bundle contains no copy of the real backend key — verified by `curl -sS https://.../assets/index-*.js | grep -c '<key-prefix>'` returning 0.
- [ ] All existing UI flows continue to work after redeploy: server list, settings, agent install token mint, action execution, exports.
- [ ] `docker-compose.yml` documents the new env requirement in a comment.
- [ ] Backend logs show `X-API-Key` header on requests via the frontend container (proxy_set_header inject worked).
- [ ] README "Quick Start" updated to no longer instruct setting `VITE_API_KEY`.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `envsubst` template typo silently leaves placeholder unsubstituted, all API calls 401 | Low | High (UI dead) | Entrypoint script greps for literal `${HOMELAB_API_KEY}` post-substitution and exits non-zero if found |
| Missing env var at container start | Medium | High (UI dead) | Entrypoint validates env present, fails fast with a clear message |
| Existing browser tabs cache the stale bundle with the old key | Medium | Low (still works) | Cache headers on assets already include `expires 1y, immutable`; users get the new bundle on hard refresh — accept the long-tail |
| Adding user auth at NPM later still doesn't gate the API because nginx attaches the service key regardless | Medium | Medium | Out of scope here; the proper layering is "user auth at NPM → service auth at frontend nginx" — document in README |

---

## Dependencies

### CR Dependencies

None — this is the first CR in the project.

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| `nginx:alpine` envsubst binary | Tool | Already in base image (`gettext` package) |
| Existing `HOMELAB_CMD_API_KEY` env in root `.env` | Config | Present and used by backend |

---

## Linked Epics

> *Populated when CR is actioned via `/sdlc-studio cr action`*

| Epic | Title | Status |
| --- | --- | --- |
| _none yet_ | | |

---

## Out of Scope

- User-level authentication (HTTP Basic, OIDC, SSO) — separate CR if added.
- Rotating the existing `HOMELAB_CMD_API_KEY` value — operational concern, not part of this design change.
- Multi-tenant / per-user API keys — out of scope for current homelab posture.
- Changing the agent → backend auth path (currently per-agent tokens, working correctly).

---

## Open Questions

- [ ] Reuse `HOMELAB_CMD_API_KEY` as the frontend env name, or introduce `HOMELAB_API_KEY` to distinguish "key the frontend forwards" from "key the backend validates"? Both resolve to the same secret today. — Owner: project lead
- [ ] Should the SPA continue to send `X-API-Key` with an empty / placeholder value so unit tests (`expect.any(String)`) don't need updating, or remove the header from the SPA entirely? — Owner: project lead

---

## Close Reason

> *Filled when CR is closed*

**Outcome:**
**Rationale:**

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-24 | Darren | CR proposed — discovered during fleet agent rollout when first browser load of `https://homelabcmd.home.lan` returned 401 because the un-built `VITE_API_KEY` left the SPA sending `dev-key-change-me`. Immediate fix was a frontend rebuild with the real key baked in; this CR replaces that with a server-side injection that doesn't leak the key to the browser. |
