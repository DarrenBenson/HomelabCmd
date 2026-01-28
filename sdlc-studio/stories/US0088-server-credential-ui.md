# US0088: Server Credential Management UI

> **Status:** Done
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** to manage per-server credentials in the dashboard
**So that** I can configure credentials without using the API directly

## Context

### Persona Reference

**Darren** - Prefers visual management of server configurations. Wants to quickly see which servers have custom credentials and easily update them when needed.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With API endpoints for per-server credentials (US0087), we need a UI to:

1. View which credentials are configured per-server vs using global defaults
2. Set/update SSH username override
3. Set sudo mode (passwordless/password)
4. Upload per-server SSH key
5. Set per-server sudo password
6. Remove per-server credentials to fall back to global

## Acceptance Criteria

### AC1: Credentials tab on server detail page

- **Given** the server detail page
- **When** viewing a server
- **Then** there is a "Credentials" tab or section
- **And** it shows current credential configuration status

### AC2: View credential configuration status

- **Given** the credentials section
- **When** viewing a server
- **Then** each credential type shows configured/not configured
- **And** shows whether it's per-server or using global
- **And** credential values are NEVER displayed

### AC3: Set/update SSH username

- **Given** the credentials section
- **When** I enter a username and save
- **Then** the per-server SSH username is updated
- **And** empty value clears the override (falls back to global)

### AC4: Set sudo mode

- **Given** the credentials section
- **When** I select sudo mode (passwordless/password)
- **Then** the server's sudo_mode is updated
- **And** UI reflects the change immediately

### AC5: Upload per-server SSH key

- **Given** the credentials section
- **When** I upload an SSH private key
- **Then** the key is stored encrypted for this server
- **And** indicator shows "SSH Key: Configured (per-server)"

### AC6: Set per-server sudo password

- **Given** the credentials section
- **When** I enter a sudo password and save
- **Then** the password is stored encrypted for this server
- **And** indicator shows "Sudo Password: Configured (per-server)"

### AC7: Remove per-server credentials

- **Given** a per-server credential configured
- **When** I click "Remove" or "Use Global"
- **Then** the per-server credential is deleted
- **And** server falls back to global credential
- **And** UI updates to show "Using global"

### AC8: Clear indication of scope

- **Given** the credentials section
- **When** viewing credential status
- **Then** "Per-server" credentials show with one style
- **And** "Global fallback" credentials show with another style
- **And** "Not configured" shows clearly

## Scope

### In Scope

- Credentials section/tab on ServerDetail page
- ServerCredentials component
- Credential status display
- SSH username input field
- Sudo mode selector (radio/dropdown)
- SSH key upload for per-server
- Sudo password input
- Remove credential button
- Visual distinction between per-server and global
- Form validation
- Success/error feedback

### Out of Scope

- Global credential management (in Settings page)
- Bulk credential management
- Credential rotation UI
- SSH key generation

## Technical Notes

### Component Structure

```
ServerDetail.tsx
  └── ServerCredentials.tsx (new)
        ├── CredentialStatusList
        ├── SSHUsernameForm
        ├── SudoModeSelector
        ├── SSHKeyUpload
        └── SudoPasswordForm
```

### UI Mockup

```
┌──────────────────────────────────────────────────────────────┐
│  Server: omv-mediaserver                                     │
├──────────────────────────────────────────────────────────────┤
│  [Overview] [Services] [Metrics] [Credentials*]              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SSH Configuration                                           │
│  ───────────────────────────────────────────────────────     │
│                                                              │
│  SSH Username Override                                       │
│  [                    ] (leave empty to use global: darren)  │
│                                                              │
│  SSH Key                                                     │
│  ● Using global key ✓                                        │
│  ○ Use per-server key  [Upload Key...]                       │
│                                                              │
│  ───────────────────────────────────────────────────────     │
│                                                              │
│  Sudo Configuration                                          │
│  ───────────────────────────────────────────────────────     │
│                                                              │
│  Sudo Mode                                                   │
│  ○ Passwordless sudo (default)                               │
│  ● Requires sudo password                                    │
│                                                              │
│  Sudo Password                                               │
│  [●●●●●●●●●●●●●●●●] [Update] [Remove]                        │
│  ✓ Configured (per-server)                                   │
│                                                              │
│  ───────────────────────────────────────────────────────     │
│                                                              │
│  Credential Status Summary                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ SSH Key:        ✓ Configured (global)                  │  │
│  │ SSH Username:   - Using default (darren)               │  │
│  │ Sudo Password:  ✓ Configured (per-server)              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                                        [Save Changes]        │
└──────────────────────────────────────────────────────────────┘
```

### API Integration

```typescript
// Types
interface ServerCredentialStatus {
  credential_type: string;
  configured: boolean;
  scope: 'per_server' | 'global' | 'none';
}

interface ServerCredentialsResponse {
  server_id: string;
  ssh_username: string | null;
  sudo_mode: string;
  credentials: ServerCredentialStatus[];
}

// API calls
async function getServerCredentials(serverId: string): Promise<ServerCredentialsResponse> {
  return apiClient.get(`/servers/${serverId}/credentials`);
}

async function storeServerCredential(
  serverId: string,
  credentialType: string,
  value: string
): Promise<void> {
  return apiClient.post(`/servers/${serverId}/credentials`, {
    credential_type: credentialType,
    value,
  });
}

async function deleteServerCredential(
  serverId: string,
  credentialType: string
): Promise<void> {
  return apiClient.delete(`/servers/${serverId}/credentials/${credentialType}`);
}

async function updateServer(
  serverId: string,
  updates: { ssh_username?: string; sudo_mode?: string }
): Promise<void> {
  return apiClient.patch(`/servers/${serverId}`, updates);
}
```

### Files Created/Modified

| File | Changes |
|------|---------|
| `frontend/src/components/ServerCredentials.tsx` | New component |
| `frontend/src/pages/ServerDetail.tsx` | Add Credentials tab |
| `frontend/src/api/servers.ts` | Add credential API functions |
| `frontend/src/types/server.ts` | Add credential types |

### State Management

```typescript
// Local component state (not Redux - credentials are server-specific)
const [credentialStatus, setCredentialStatus] = useState<ServerCredentialsResponse | null>(null);
const [sshUsername, setSshUsername] = useState<string>('');
const [sudoMode, setSudoMode] = useState<'passwordless' | 'password'>('passwordless');
const [sudoPassword, setSudoPassword] = useState<string>('');
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server not found | Redirect to servers list |
| Network error loading credentials | Error message with retry button |
| Save fails | Error toast, form not cleared |
| Delete fails | Error toast, status unchanged |
| Empty sudo password submitted | Validation error |
| Invalid SSH key format | Validation error from API |
| Global credential removed elsewhere | Refresh shows updated status |

## Test Scenarios

- [x] View credentials tab for server
- [x] See global credential in status
- [x] See per-server credential in status
- [x] Set SSH username override
- [x] Clear SSH username override
- [x] Change sudo mode to password
- [x] Change sudo mode to passwordless
- [x] Upload per-server SSH key
- [x] Set per-server sudo password
- [x] Remove per-server credential
- [x] Error handling on save failure
- [x] Loading state during operations

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0088-01 | Credentials tab visible | AC1 | E2E | Ready |
| TC-US0088-02 | View credential status | AC2 | E2E | Ready |
| TC-US0088-03 | Set SSH username | AC3 | E2E | Ready |
| TC-US0088-04 | Set sudo mode | AC4 | E2E | Ready |
| TC-US0088-05 | Upload SSH key | AC5 | E2E | Ready |
| TC-US0088-06 | Set sudo password | AC6 | E2E | Ready |
| TC-US0088-07 | Remove per-server credential | AC7 | E2E | Ready |
| TC-US0088-08 | Scope indication | AC8 | E2E | Ready |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0087: Per-Server Credential API Endpoints | Story | Ready |

## Estimation

**Story Points:** 5

**Complexity:** Medium - New component with forms and API integration

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial story creation |
| 2026-01-27 | Claude | Implementation complete - 21 unit tests passing |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
