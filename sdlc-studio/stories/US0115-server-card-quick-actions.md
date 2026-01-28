# US0115: Server Card Quick Actions

> **Status:** Done
> **Epic:** [EP0017: Desktop UX Improvements](../epics/EP0017-desktop-ux-improvements.md)
> **Owner:** Darren
> **Created:** 2026-01-28
> **Completed:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** quick action buttons on server cards
**So that** I can toggle pause or open SSH without navigating to the detail page

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers. Values efficiency and reducing clicks for common operations.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

Currently, performing actions on a server requires navigating to the server detail page. For common operations like toggling maintenance mode or initiating an SSH connection, this adds unnecessary clicks. Market leaders show action buttons on hover, reducing the path to action from 3+ clicks to 1.

---

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| Epic | Accessibility | Actions keyboard accessible | Tab navigation required |
| PRD | Security | API key authentication | Actions use existing auth |
| TRD | Architecture | Existing API endpoints | Use existing toggle/SSH APIs |

---

## Acceptance Criteria

### AC1: Quick actions appear on hover

- **Given** I view a server card on the dashboard
- **When** I hover over the card
- **Then** a quick action bar appears at the bottom of the card
- **And** the bar contains action buttons with icons

### AC2: Toggle pause action

- **Given** the quick action bar is visible
- **When** I click the "Toggle Pause" button (Pause/Play icon)
- **Then** the server's `is_paused` state toggles
- **And** a toast notification confirms "Server paused" or "Server resumed"
- **And** the card immediately reflects the new state

### AC3: SSH action (Tailscale servers)

- **Given** a server has `tailscale_hostname` set
- **When** I click the "SSH" button (Terminal icon)
- **Then** a modal appears with SSH connection command
- **And** a "Copy" button copies `ssh user@{tailscale_hostname}` to clipboard
- **And** toast confirms "SSH command copied"

### AC4: View details action

- **Given** the quick action bar is visible
- **When** I click the "Details" button (ChevronRight icon)
- **Then** I navigate to the server detail page
- **And** the URL updates to `/servers/{id}`

### AC5: Keyboard accessibility

- **Given** I focus on a server card via keyboard
- **When** I press Tab
- **Then** focus moves through the quick action buttons
- **And** pressing Enter activates the focused action
- **And** pressing Escape hides the action bar

### AC6: Action bar visibility for non-Tailscale servers

- **Given** a server does NOT have `tailscale_hostname`
- **When** the quick action bar appears
- **Then** the SSH button is either disabled or hidden
- **And** tooltip explains "SSH requires Tailscale connectivity"

---

## Scope

### In Scope

- Quick action bar on server card hover
- Toggle pause button with API call
- SSH button with copy-to-clipboard
- View details button (navigation)
- Keyboard accessibility
- Toast notifications for actions
- Conditional SSH button based on Tailscale

### Out of Scope

- Inline editing of server name
- Delete server action (dangerous for quick action)
- Restart server action (future feature)
- Wake-on-LAN action (future feature)
- Bulk actions on multiple servers

---

## Technical Notes

### Implementation Approach

1. **Create CardActions component:**
   ```tsx
   function CardActions({ server, onPauseToggle }: CardActionsProps) {
     const navigate = useNavigate();
     const { toast } = useToast();

     const handleTogglePause = async () => {
       await toggleServerPause(server.id, !server.is_paused);
       toast({
         title: server.is_paused ? "Server resumed" : "Server paused"
       });
       onPauseToggle();
     };

     const handleSSH = () => {
       const command = `ssh ${getSSHUser()}@${server.tailscale_hostname}`;
       navigator.clipboard.writeText(command);
       toast({ title: "SSH command copied to clipboard" });
     };

     return (
       <div className="flex gap-2 p-2 border-t bg-gray-50 dark:bg-gray-800">
         <ActionButton
           icon={server.is_paused ? Play : Pause}
           label={server.is_paused ? "Resume" : "Pause"}
           onClick={handleTogglePause}
         />
         {server.tailscale_hostname && (
           <ActionButton
             icon={Terminal}
             label="SSH"
             onClick={handleSSH}
           />
         )}
         <ActionButton
           icon={ChevronRight}
           label="Details"
           onClick={() => navigate(`/servers/${server.id}`)}
         />
       </div>
     );
   }
   ```

2. **ActionButton component:**
   ```tsx
   function ActionButton({ icon: Icon, label, onClick, disabled }: ActionButtonProps) {
     return (
       <Tooltip content={label}>
         <button
           onClick={onClick}
           disabled={disabled}
           className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
           aria-label={label}
         >
           <Icon className="w-4 h-4" />
         </button>
       </Tooltip>
     );
   }
   ```

3. **ServerCard integration:**
   - Add hover state to show/hide actions
   - Use CSS transition for smooth appearance
   - Handle keyboard focus visibility

### API Contracts

**Toggle Pause:** `PATCH /api/v1/servers/{id}` with `{ is_paused: boolean }`

No new endpoints needed.

### Files to Modify

- `frontend/src/components/CardActions.tsx` - New component
- `frontend/src/components/ActionButton.tsx` - New component
- `frontend/src/components/ServerCard.tsx` - Add actions bar
- `frontend/src/api/servers.ts` - Add togglePause function (if not exists)

### Data Requirements

- Server model `is_paused` field (exists)
- Server model `tailscale_hostname` field (exists)
- PATCH endpoint for server update (exists)

---

## Edge Cases & Error Handling

| # | Scenario | Expected Behaviour |
|---|----------|-------------------|
| 1 | API call fails during toggle | Show error toast, revert optimistic update |
| 2 | Clipboard API unavailable | Show modal with command to copy manually |
| 3 | Double-click on toggle | Debounce to prevent rapid state changes |
| 4 | Hover on touch device | Show actions on tap, hide on tap elsewhere |
| 5 | Server deleted while viewing | Handle 404, show error toast |
| 6 | No tailscale_hostname and no SSH key | SSH button hidden |
| 7 | Actions bar overlaps card content | Use absolute positioning below card |
| 8 | Very narrow viewport | Actions become icon-only (no labels) |

---

## Test Scenarios

- [x] Actions bar appears on card hover
- [x] Actions bar hides when mouse leaves
- [x] Toggle pause updates server state
- [x] Toast shows after toggle pause
- [x] SSH button copies command to clipboard
- [x] SSH button hidden for non-Tailscale servers
- [x] Details button navigates to detail page
- [x] Keyboard Tab cycles through actions
- [x] Keyboard Enter activates action
- [x] Keyboard Escape hides action bar
- [x] Actions work in dark mode
- [x] Error toast on API failure

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0109 | Layout | Card layout updates | Ready |
| US0111 | Data | tailscale_hostname check | Ready |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Clipboard API | Browser | Available |
| lucide-react icons | Library | Available |
| Toast notifications | Component | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Medium - multiple actions, keyboard accessibility

---

## Open Questions

None.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation from EP0017 |
