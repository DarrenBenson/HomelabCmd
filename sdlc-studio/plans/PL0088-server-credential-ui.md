# PL0088: Server Credential Management UI - Implementation Plan

> **Status:** Done
> **Story:** [US0088: Server Credential Management UI](../stories/US0088-server-credential-ui.md)
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Created:** 2026-01-27
> **Language:** TypeScript (React)

## Overview

Add a Credentials section to the ServerDetail page allowing administrators to view and manage per-server credential configuration. Users can set SSH username overrides, sudo mode, upload per-server SSH keys, set sudo passwords, and remove per-server credentials to fall back to global defaults. The UI clearly distinguishes between per-server, global, and unconfigured credentials.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Credentials section | Server detail page has a Credentials section |
| AC2 | View status | Each credential type shows configured/scope, NEVER values |
| AC3 | SSH username | Set/clear per-server SSH username override |
| AC4 | Sudo mode | Set sudo mode (passwordless/password) |
| AC5 | SSH key upload | Upload per-server SSH private key |
| AC6 | Sudo password | Set per-server sudo password |
| AC7 | Remove credentials | Delete per-server credential to fall back to global |
| AC8 | Clear scope indication | Visual distinction between per-server, global, none |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript
- **Framework:** React 18 with Vite
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices

From `~/.claude/best-practices/typescript.md`:
- Avoid `any`, use `unknown` with type guards
- Handle `null` and `undefined` explicitly
- Use utility types (`Partial`, `Omit`) to derive types
- Explicit return types for exported functions
- No `!` non-null assertions

### Library Documentation (Context7)

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| React | /facebook/react | useState, useEffect hooks | Component state management |
| Lucide Icons | - | Icon components | Used for visual indicators |

### Existing Patterns

1. **AgentCredentialCard** - `components/AgentCredentialCard.tsx` shows credential management UI patterns
2. **ServerDetail** - `pages/ServerDetail.tsx` shows server detail page structure with cards and sections
3. **API client** - `api/servers.ts` shows API function patterns with `api.get`, `api.put`, `api.delete`
4. **Type definitions** - `types/server.ts` shows server-related type structures
5. **Server update** - Uses `api.put` to `/api/v1/servers/{id}` for field updates

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is primarily a UI component with API integration. The API endpoints are already tested (US0087). Component testing will verify the UI renders correctly and handles user interactions. E2E tests would provide the most value but are marked as future work.

### Test Priority

1. ServerCredentials component renders with credential status
2. SSH username form updates server
3. Sudo mode selector updates server
4. Store credential API integration
5. Delete credential API integration
6. Visual scope indicators render correctly

### Documentation Updates Required

- [ ] Update story status to Planned

## Implementation Tasks

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add credential types to types/server.ts | `types/server.ts` | - | Yes | [x] |
| 2 | Add credential API functions | `api/servers.ts` | 1 | No | [x] |
| 3 | Create ServerCredentials component | `components/ServerCredentials.tsx` | 1, 2 | No | [x] |
| 4 | Add ssh_username/sudo_mode to ServerDetail type | `types/server.ts` | - | Yes | [x] |
| 5 | Integrate ServerCredentials into ServerDetail page | `pages/ServerDetail.tsx` | 3 | No | [x] |
| 6 | Write unit tests for ServerCredentials | `components/ServerCredentials.test.tsx` | 3 | No | [x] |

### Task Dependency Graph

```
1 (types) ────┬──→ 2 (API) ──→ 3 (component) ──→ 5 (integrate) ──→ 6 (tests)
              │
4 (ServerDetail type) ─────────────────────────┘
```

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 4 | None |
| 2 | 2 | Task 1 |
| 3 | 3 | Tasks 1, 2, 4 |
| 4 | 5 | Task 3 |
| 5 | 6 | Task 3 |

## Implementation Phases

### Phase 1: Types and API Layer

**Goal:** Add TypeScript types and API functions for credential management

**Tasks in this phase:** 1, 2, 4

#### Step 1.1: Add credential types

- [ ] Add `ServerCredentialStatus` interface
- [ ] Add `ServerCredentialsResponse` interface
- [ ] Add `StoreServerCredentialRequest` interface
- [ ] Add `ssh_username` and `sudo_mode` to `ServerDetail` interface

**Files to modify:**
- `frontend/src/types/server.ts` - Add credential-related types

**Types to add:**

```typescript
export type CredentialScope = 'per_server' | 'global' | 'none';

export interface ServerCredentialStatus {
  credential_type: string;
  configured: boolean;
  scope: CredentialScope;
}

export interface ServerCredentialsResponse {
  server_id: string;
  ssh_username: string | null;
  sudo_mode: 'passwordless' | 'password';
  credentials: ServerCredentialStatus[];
}
```

#### Step 1.2: Add credential API functions

- [ ] Add `getServerCredentials()` function
- [ ] Add `storeServerCredential()` function
- [ ] Add `deleteServerCredential()` function

**Files to modify:**
- `frontend/src/api/servers.ts` - Add credential API functions

**API functions:**

```typescript
export async function getServerCredentials(serverId: string): Promise<ServerCredentialsResponse>
export async function storeServerCredential(serverId: string, type: string, value: string): Promise<void>
export async function deleteServerCredential(serverId: string, type: string): Promise<void>
```

### Phase 2: UI Component

**Goal:** Create the ServerCredentials component

**Tasks in this phase:** 3

#### Step 2.1: Create ServerCredentials component

- [ ] Create component with credential status display
- [ ] Add SSH username input form
- [ ] Add sudo mode radio selector
- [ ] Add SSH key upload section (text input for now)
- [ ] Add sudo password form
- [ ] Add remove credential buttons
- [ ] Add visual scope indicators (badges/icons)
- [ ] Add loading states
- [ ] Add error handling with toast messages

**Files to create:**
- `frontend/src/components/ServerCredentials.tsx` - Main credential management component

**Component structure:**

```typescript
interface ServerCredentialsProps {
  serverId: string;
  onUpdate?: () => void;
}

export function ServerCredentials({ serverId, onUpdate }: ServerCredentialsProps)
```

**Sub-sections within component:**
1. SSH Configuration section (username, key)
2. Sudo Configuration section (mode, password)
3. Credential Status Summary

### Phase 3: Integration

**Goal:** Integrate ServerCredentials into ServerDetail page

**Tasks in this phase:** 5

#### Step 3.1: Add to ServerDetail page

- [ ] Import ServerCredentials component
- [ ] Add Credentials section between Agent Security and System Updates
- [ ] Pass serverId prop

**Files to modify:**
- `frontend/src/pages/ServerDetail.tsx` - Add ServerCredentials component

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

**Tasks in this phase:** 6

#### Step 4.1: Unit Tests

- [ ] Test component renders credential status
- [ ] Test SSH username form submission
- [ ] Test sudo mode selection
- [ ] Test credential store/delete actions
- [ ] Test loading states
- [ ] Test error handling

**Test file:** `frontend/src/components/ServerCredentials.test.tsx`

#### Step 4.2: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Visual inspection | `ServerDetail.tsx` | Done |
| AC2 | Unit test: status display | `ServerCredentials.test.tsx` | Done |
| AC3 | Unit test: username form | `ServerCredentials.test.tsx` | Done |
| AC4 | Unit test: sudo mode | `ServerCredentials.test.tsx` | Done |
| AC5 | Unit test: SSH key upload | `ServerCredentials.test.tsx` | Done |
| AC6 | Unit test: sudo password | `ServerCredentials.test.tsx` | Done |
| AC7 | Unit test: remove credential | `ServerCredentials.test.tsx` | Done |
| AC8 | Visual inspection | `ServerCredentials.tsx` | Done |

## Edge Case Handling Plan

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Server not found | Redirect handled by ServerDetail parent | Phase 3 | [ ] |
| 2 | Network error loading credentials | Show error message with retry button | Phase 2 | [ ] |
| 3 | Save fails | Show error toast, keep form values | Phase 2 | [ ] |
| 4 | Delete fails | Show error toast, status unchanged | Phase 2 | [ ] |
| 5 | Empty sudo password submitted | Pydantic validation rejects (min_length=1) | Phase 2 | [ ] |
| 6 | Invalid SSH key format | API returns 500, show error message | Phase 2 | [ ] |
| 7 | Global credential removed elsewhere | Refresh shows updated status on next fetch | Phase 2 | [ ] |

### Coverage Summary

- Story edge cases: 7
- Handled in plan: 7
- Unhandled: 0

### Edge Case Implementation Notes

Error handling follows the pattern established in AgentCredentialCard:
- Use `try/catch` blocks for API calls
- Set error state to display messages
- Keep loading states for user feedback
- Don't clear form values on error

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSH key handling complexity | Security concerns | Use text input initially, document key format requirements |
| UI state complexity | Bugs in form handling | Use controlled components, clear state management |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0087 | Story | API endpoints for per-server credentials (Done) |

## Open Questions

None - all questions resolved in US0087 implementation.

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (21 tests)
- [x] Edge cases handled
- [x] Code follows best practices
- [x] No linting errors
- [x] Ready for code review

## Notes

The ServerDetail page already has a complex structure with multiple sections. The Credentials section will be added as a new card similar to "Agent Security" section, positioned logically after it.

The component uses local state rather than Redux since credential data is server-specific and doesn't need global state management.

For SSH key upload, we'll use a textarea/text input rather than file upload for simplicity. Users paste their private key content.
