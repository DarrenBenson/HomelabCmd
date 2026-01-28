# BG0010: Agent Install Modal Should Suggest Display Name from Hostname

> **Status:** Closed
> **Severity:** Low
> **Priority:** P3
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

The Agent Install modal should pre-populate the Display Name field with a suggested value derived from the hostname (with the option to override). Additionally, the Server ID field should be auto-generated and not shown to users, as it's an internal identifier.

## Affected Area

- **Epic:** [EP0007: Agent Management](../epics/EP0007-agent-management.md)
- **Story:** [US0066: Install Agent UI](../stories/US0066-install-agent-ui.md)
- **Component:** Frontend - AgentInstallModal

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** All

## Reproduction Steps

1. Navigate to Network Discovery page
2. Run a scan to discover devices
3. Click "Install Agent" on a device with SSH success
4. Observe the form fields

## Expected Behaviour

1. **Display Name**: Should be pre-filled with a friendly suggestion derived from hostname (e.g., `10.0.0.5` → `Server 10.0.0.5`, or `pihole.local` → `Pihole`)
2. **Server ID**: Should be hidden from the user and always auto-generated from hostname by the backend - users should not need to understand or manage internal identifiers

## Actual Behaviour

1. **Display Name**: Empty with generic placeholder "e.g., Media Server" - requires user to type a name manually
2. **Server ID**: Visible as an editable field with a suggested placeholder - exposes internal implementation detail to users

## Screenshots/Evidence

Current form shows:
- Server ID field (editable, with placeholder)
- Display Name field (empty, generic placeholder)

## Root Cause Analysis

The current implementation prioritises flexibility over UX. For most users, the server_id is an internal detail they shouldn't need to manage, whilst the display name is what they'll see throughout the UI and should be suggested.

**Current code in AgentInstallModal.tsx:**
```typescript
// Server ID - visible, editable
<input value={serverId} placeholder={suggestedServerId} />

// Display Name - empty, generic placeholder
<input value={displayName} placeholder="e.g., Media Server" />
```

## Fix Description

Implemented both proposed changes:

1. **Removed Server ID field** - the backend auto-generates this from hostname, users don't need to manage it
2. **Added display name suggestion** - pre-populated from hostname:
   - IP addresses (e.g., `10.0.0.5`) → `Server 10.0.0.5`
   - Hostnames (e.g., `pihole.local`) → `Pihole` (capitalised, domain removed)

The display name field is now pre-filled with the suggestion but remains editable for customisation.

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/AgentInstallModal.tsx:29-41` | Added `generateDisplayNameSuggestion()` function |
| `frontend/src/components/AgentInstallModal.tsx:46` | Pre-initialise displayName state with suggestion |
| `frontend/src/components/AgentInstallModal.tsx:63-70` | Removed `server_id` from install request |
| `frontend/src/components/AgentInstallModal.tsx:91` | Reset displayName to suggestion on close |
| `frontend/src/components/AgentInstallModal.tsx:178-199` | Removed Server ID field JSX, updated Display Name field |

### Tests Added

| Test ID | Description | File |
|---------|-------------|------|
| - | Visual verification only (UX change) | - |

## Verification

> *To be filled when verifying*

- [ ] Fix verified in development
- [ ] Regression tests pass
- [ ] No side effects observed
- [ ] Documentation updated (if applicable)

**Verified by:** -
**Verification date:** -

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Epic | EP0007 | Agent Management |
| Story | US0066 | Install Agent UI |

## Notes

This is a UX polish item rather than a bug. The current implementation works correctly but requires more manual input than necessary.

Consider also passing the discovered hostname (if available) from NetworkDiscovery to AgentInstallModal to provide better suggestions.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported |
| 2026-01-21 | Claude | Status: Open → In Progress |
| 2026-01-21 | Claude | Status: In Progress → Fixed |
