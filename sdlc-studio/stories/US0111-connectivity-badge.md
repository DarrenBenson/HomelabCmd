# US0111: Connectivity Badge (Tailscale/SSH)

> **Status:** Done
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Story Points:** 2

## User Story

**As a** Darren (Homelab Operator)
**I want** to see which servers are connected via Tailscale at a glance
**So that** I know which servers support remote SSH access without checking each one

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers on Tailscale. Uses Tailscale for secure remote access and SSH operations.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With EP0008 (Tailscale Integration) complete, servers can be imported from Tailscale and connected via Tailscale hostnames. However, there's no visual indicator on the dashboard showing which servers have Tailscale connectivity configured. This makes it hard to know at a glance which servers support remote SSH operations.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | Colour not sole indicator | Badge must include icon and text |
| PRD | Performance | Dashboard load <3s | No additional API calls needed |
| EP0008 | Data | tailscale_hostname on Server | Use existing field |

---

## Acceptance Criteria

### AC1: Tailscale badge on connected servers

- **Given** a server has `tailscale_hostname` set (not null/empty)
- **When** the dashboard renders the server card
- **Then** a Tailscale badge appears on the card
- **And** the badge shows the Tailscale logo icon and "Tailscale" text

### AC2: Badge placement and styling

- **Given** a server card is rendered with Tailscale badge
- **When** the user views the card
- **Then** the badge appears in the card header (top-right or below name)
- **And** the badge uses Tailscale brand colour (blue) or neutral grey
- **And** the badge is small/subtle to avoid visual clutter

### AC3: Tooltip with hostname

- **Given** a server has Tailscale connectivity
- **When** the user hovers over the Tailscale badge
- **Then** a tooltip displays "Connected via Tailscale: {tailscale_hostname}"
- **And** the tooltip appears within 200ms

### AC4: No badge for non-Tailscale servers

- **Given** a server has `tailscale_hostname: null` or empty string
- **When** the dashboard renders the server card
- **Then** no Tailscale badge is shown
- **And** no visual difference from current card layout

---

## Scope

### In Scope

- Tailscale badge component
- Badge appears on servers with tailscale_hostname
- Tooltip showing Tailscale hostname
- Light and dark mode styling

### Out of Scope

- SSH badge (separate indicator for SSH-configured servers)
- Badge on server detail page (consider in Open Questions)
- Connectivity status indicator (online/offline on Tailscale network)
- Direct SSH button from badge (US0115 scope)

---

## Technical Notes

### Implementation Approach

1. **Create ConnectivityBadge component:**
   ```tsx
   function ConnectivityBadge({ server }: { server: Server }) {
     if (!server.tailscale_hostname) return null;

     return (
       <Tooltip content={`Connected via Tailscale: ${server.tailscale_hostname}`}>
         <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
           <TailscaleIcon className="w-3 h-3" />
           <span>Tailscale</span>
         </div>
       </Tooltip>
     );
   }
   ```

2. **Tailscale icon:**
   - Use SVG from Tailscale brand assets
   - Or use a generic network icon (lucide-react Network)
   - Store in `frontend/src/assets/` if custom SVG

3. **Integration in ServerCard:**
   - Add `<ConnectivityBadge server={server} />` in card header

### Files to Modify

- `frontend/src/components/ConnectivityBadge.tsx` - New component
- `frontend/src/components/ServerCard.tsx` - Add badge
- `frontend/src/assets/tailscale-icon.svg` - Optional custom icon

### Data Requirements

- Server model already has `tailscale_hostname: string | null`
- No API changes required

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | tailscale_hostname is empty string | Treat as null, no badge |
| 2 | Very long Tailscale hostname | Truncate in tooltip if >50 chars |
| 3 | Server imported then Tailscale disconnected | Badge still shows (based on field, not live status) |
| 4 | Multiple connectivity types (future) | Badges stack horizontally |
| 5 | Icon fails to load | Show text-only badge "TS" |

---

## Test Scenarios

- [x] Server with tailscale_hostname shows badge
- [x] Server without tailscale_hostname has no badge
- [x] Badge tooltip shows correct hostname
- [x] Badge renders correctly in dark mode
- [x] Badge doesn't affect card layout/spacing
- [x] Empty string tailscale_hostname shows no badge

---

## Dependencies

### Story Dependencies

None - uses existing data from EP0008.

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| EP0008 Tailscale Integration | Feature | Done |
| Server.tailscale_hostname field | Data | Done |

---

## Estimation

**Story Points:** 2
**Complexity:** Low - simple conditional UI component

---

## Open Questions

None - resolved.

### Resolved Questions

- [x] Should connectivity badge also appear on server detail page header? - **Yes** - Will be included in EP0012 (Widget-Based Detail View) when the detail page header is redesigned.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0017 |
