# US0115: Server Card Quick Actions

> **Status:** Ready
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** system administrator
**I want** quick actions on server cards
**So that** I can perform common tasks without opening the detail page

## Context

### Persona Reference
**System Administrator** - Manages many servers, wants efficient workflows
[Full persona details](../personas.md#system-administrator)

### Background

Currently, to perform any action on a server (toggle pause, SSH, view details), users must navigate to the server detail page. This adds clicks and navigation overhead for common operations.

Market leaders like Datadog and Uptime Kuma show action buttons on hover, allowing quick interactions directly from the list/grid view. Adding hover-revealed action buttons to ServerCard reduces the number of clicks for common workflows.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | WCAG 2.1 AA | Keyboard accessible actions |
| PRD | Performance | Dashboard <3s load | No heavy hover state rendering |
| TRD | Architecture | React + Tailwind | Use group-hover pattern |

---

## Acceptance Criteria

### AC1: Hover Reveals Actions
- **Given** a desktop browser
- **When** I hover over a ServerCard
- **Then** action buttons appear in the card footer area

### AC2: Toggle Pause Action
- **Given** action buttons are visible
- **When** I click the pause/unpause button
- **Then** the server's maintenance mode is toggled
- **And** the card updates to reflect the new state (maintenance glow if paused)

### AC3: SSH Action
- **Given** action buttons are visible AND the server has SSH configured
- **When** I click the SSH button
- **Then** an SSH terminal link/command is copied to clipboard or opened in external terminal

### AC4: View Details Action
- **Given** action buttons are visible
- **When** I click the "View Details" button
- **Then** I navigate to the server detail page

### AC5: Keyboard Accessibility
- **Given** a ServerCard is focused (via Tab)
- **When** I press Enter or Space
- **Then** the action buttons become visible
- **And** I can Tab through the action buttons
- **And** I can activate them with Enter

### AC6: Touch Device Behaviour
- **Given** a touch device (no hover capability)
- **When** viewing ServerCard
- **Then** action buttons are always visible (subtle styling)
- **Or** a dedicated "more actions" button is shown

---

## Scope

### In Scope
- Hover-reveal action buttons in card footer
- Toggle pause action (maintenance mode)
- SSH action (copy command or open link)
- View details action (navigation)
- Keyboard accessibility
- Touch device adaptation

### Out of Scope
- Restart server action (requires confirmation)
- Wake-on-LAN action
- Custom action configuration
- Context menu (right-click)

---

## Technical Notes

### Implementation Approach

Create `CardActions` component:

```tsx
interface CardActionsProps {
  server: Server;
  onTogglePause: (serverId: string) => void;
  onSSH: (server: Server) => void;
}

export function CardActions({ server, onTogglePause, onSSH }: CardActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1">
      {/* Toggle Pause */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePause(server.id);
        }}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        title={server.is_paused ? 'Resume monitoring' : 'Pause monitoring'}
      >
        {server.is_paused ? <Play size={14} /> : <Pause size={14} />}
      </button>

      {/* SSH (only if configured) */}
      {server.tailscale_hostname && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSSH(server);
          }}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="SSH to server"
        >
          <Terminal size={14} />
        </button>
      )}

      {/* View Details */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/servers/${server.id}`);
        }}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        title="View details"
      >
        <ExternalLink size={14} />
      </button>
    </div>
  );
}
```

### Hover State in ServerCard

```tsx
<div className="group relative ...">
  {/* Card content */}

  {/* Footer with actions */}
  <div className="flex justify-between items-center mt-3 pt-3 border-t">
    <span className="font-mono text-xs">↑ {uptime}</span>

    {/* Actions - hidden by default, shown on hover */}
    <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
      <CardActions
        server={server}
        onTogglePause={handleTogglePause}
        onSSH={handleSSH}
      />
    </div>
  </div>
</div>
```

### Touch Device Detection

Use CSS media query for hover capability:

```css
/* Hide by default on touch, show on hover devices */
.card-actions {
  opacity: 1; /* Default: visible for touch */
}

@media (hover: hover) {
  /* Hover-capable devices: hide until hover */
  .card-actions {
    opacity: 0;
  }

  .group:hover .card-actions,
  .group:focus-within .card-actions {
    opacity: 1;
  }
}
```

### SSH Action Implementation

Options for SSH action:
1. **Copy command to clipboard**: `ssh user@hostname` - simplest
2. **Open ssh:// URL**: Depends on OS/browser support
3. **Open in iTerm/Terminal**: Requires custom URL scheme

Recommended: Copy SSH command to clipboard with toast notification.

```tsx
function handleSSH(server: Server) {
  const hostname = server.tailscale_hostname || server.hostname;
  const command = `ssh ${defaultUsername}@${hostname}`;
  navigator.clipboard.writeText(command);
  toast.success(`SSH command copied: ${command}`);
}
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Hover while action in progress | Show loading spinner, disable buttons |
| Toggle pause fails (API error) | Show error toast, revert optimistic update |
| SSH not configured | SSH button not shown |
| No clipboard API (older browser) | Fall back to prompt with selectable text |
| Keyboard navigation past card | Actions hide when focus leaves card |
| Touch then hover (hybrid device) | Actions visible from touch, enhanced on hover |
| Card in loading state | Actions disabled while loading |

---

## Test Scenarios

- [ ] Verify actions hidden by default on desktop
- [ ] Verify actions appear on hover
- [ ] Verify pause button toggles maintenance mode
- [ ] Verify pause button updates card appearance
- [ ] Verify SSH button copies command to clipboard
- [ ] Verify SSH button hidden when no SSH configured
- [ ] Verify view details navigates to server page
- [ ] Verify keyboard focus reveals actions
- [ ] Verify Tab navigates through action buttons
- [ ] Verify Enter activates focused action
- [ ] Verify actions visible by default on touch device
- [ ] Verify stopPropagation prevents card click
- [ ] Verify accessibility: buttons have labels

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0029 | API | Maintenance mode toggle endpoint | Done |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Lucide icons (Play, Pause, Terminal, ExternalLink) | Library | Available |
| Clipboard API | Browser | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low-Medium (hover states, keyboard accessibility, touch adaptation)

---

## Open Questions

- [ ] Should SSH open in browser-based terminal (if available) vs copy command? - Owner: Darren

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
