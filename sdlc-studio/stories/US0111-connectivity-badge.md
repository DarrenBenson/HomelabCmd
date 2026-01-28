# US0111: Connectivity Badge (Tailscale/SSH)

> **Status:** Ready
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 2

## User Story

**As a** system administrator
**I want** to see which connectivity method each server uses (Tailscale vs direct SSH)
**So that** I understand my infrastructure topology at a glance

## Context

### Persona Reference
**System Administrator** - Manages homelab infrastructure, needs to understand connectivity paths
[Full persona details](../personas.md#system-administrator)

### Background

With Tailscale integration (EP0008), servers can be connected via Tailscale MagicDNS or direct SSH. Currently there's no visual indicator showing which method a server uses. This makes it hard to understand the connectivity topology when looking at the dashboard.

A small badge showing "Tailscale" (with icon) on applicable cards helps administrators quickly identify which servers are reachable via Tailscale vs direct network connectivity.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Data | Use existing `tailscale_hostname` | No new API fields needed |
| PRD | Performance | Dashboard <3s load | Badge must be lightweight |

---

## Acceptance Criteria

### AC1: Tailscale Badge Display
- **Given** a server with `tailscale_hostname` set (not null/empty)
- **When** the ServerCard is rendered
- **Then** a small Tailscale badge appears in the card footer showing the Tailscale icon and "TS"

### AC2: No Badge for Direct SSH
- **Given** a server with `tailscale_hostname` null or empty
- **When** the ServerCard is rendered
- **Then** no connectivity badge is shown (direct SSH is the default)

### AC3: Tooltip with Full Hostname
- **Given** a server with `tailscale_hostname: "homeserver.tailnet.ts.net"`
- **When** the user hovers over the Tailscale badge
- **Then** a tooltip shows "Connected via Tailscale: homeserver.tailnet.ts.net"

### AC4: Badge Styling
- **Given** a server with Tailscale connectivity
- **When** the badge is rendered
- **Then** it uses subtle styling: small text, muted colours, positioned in footer area

### AC5: Frontend Type Update
- **Given** the `Server` TypeScript interface
- **When** the interface is defined
- **Then** it includes `tailscale_hostname: string | null` field (already in `ServerDetail`, needs adding to `Server`)

---

## Scope

### In Scope
- Tailscale badge component
- Tooltip showing full Tailscale hostname
- Update `Server` TypeScript type to include `tailscale_hostname`
- Badge in ServerCard footer

### Out of Scope
- Showing Tailscale badge on server detail page (consider for open question)
- SSH connectivity badge (direct SSH is default, no badge needed)
- Network diagnostics or connectivity testing from badge

---

## Technical Notes

### Frontend Type Update

Update `frontend/src/types/server.ts`:

```typescript
export interface Server {
  // ... existing fields
  tailscale_hostname: string | null;  // Add this field
}
```

### ConnectivityBadge Component

Create `frontend/src/components/ConnectivityBadge.tsx`:

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConnectivityBadgeProps {
  tailscaleHostname: string | null;
}

export function ConnectivityBadge({ tailscaleHostname }: ConnectivityBadgeProps) {
  if (!tailscaleHostname) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/10 text-blue-400">
            {/* Tailscale logo SVG or icon */}
            <TailscaleIcon className="h-3 w-3" />
            TS
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Connected via Tailscale: {tailscaleHostname}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### Tailscale Icon

Use a simple Tailscale-inspired icon or SVG. Options:
1. Custom SVG based on Tailscale logo
2. Generic network/VPN icon from Lucide (`Network`, `Globe`)
3. Text-only badge "TS"

Recommended: Text badge "TS" with subtle styling (simplest, no licensing concerns).

### Integration in ServerCard

Add to `ServerCard.tsx` footer section:

```tsx
{/* Footer */}
<div className="flex justify-between items-center mt-3 pt-3 border-t border-border-subtle">
  <span className="font-mono text-xs text-text-tertiary">
    ↑ {formatUptime(metrics?.uptime_seconds ?? null)}
  </span>
  <div className="flex items-center gap-2">
    <ConnectivityBadge tailscaleHostname={server.tailscale_hostname} />
    {/* Update indicator */}
    ...
  </div>
</div>
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| `tailscale_hostname` is null | No badge shown |
| `tailscale_hostname` is empty string | No badge shown (treat as null) |
| `tailscale_hostname` is very long | Tooltip shows full name, badge shows "TS" only |
| Server has both Tailscale and direct IP | Show Tailscale badge (Tailscale is the preferred connection method) |
| Tailscale not configured globally | Servers without `tailscale_hostname` show no badge |
| Card in compact/mobile view | Badge may be hidden at small breakpoints |

---

## Test Scenarios

- [ ] Verify Tailscale badge appears when `tailscale_hostname` is set
- [ ] Verify no badge when `tailscale_hostname` is null
- [ ] Verify no badge when `tailscale_hostname` is empty string
- [ ] Verify tooltip shows full Tailscale hostname
- [ ] Verify badge styling matches design system
- [ ] Verify `Server` TypeScript type includes `tailscale_hostname`
- [ ] Verify accessibility: badge has aria-label or tooltip accessible

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0076 | Data | Tailscale integration with `tailscale_hostname` | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| `tailscale_hostname` in ServerResponse | Backend | Done |
| Radix UI Tooltip | Library | Available |

---

## Estimation

**Story Points:** 2
**Complexity:** Low

---

## Open Questions

- [ ] Should connectivity badge also show on server detail page header? - Owner: Darren

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
