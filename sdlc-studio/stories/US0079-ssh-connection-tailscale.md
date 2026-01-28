# US0079: SSH Connection via Tailscale

> **Status:** Done
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Owner:** Darren
> **Created:** 2026-01-26
> **Story Points:** 8

## User Story

**As a** Darren (Homelab Operator)
**I want** HomelabCmd to connect to machines via Tailscale hostnames
**So that** connections work reliably across networks without IP address management

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers on Tailscale mesh network. Wants reliable SSH connectivity that works from anywhere without managing IP addresses or firewall rules.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

With machines imported from Tailscale (US0078), HomelabCmd needs to establish SSH connections for command execution. This story implements the SSH executor service that connects via stable Tailscale MagicDNS hostnames (e.g., `homeserver.tail-abc123.ts.net`) using the `asyncssh` library, with connection pooling for efficiency.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Performance | Connection pooling (5 min reuse) | Avoid reconnection overhead |
| Security | SSH key encrypted at rest | Use US0081 for key storage |
| Reliability | Retry on failure (3 attempts) | Handle transient network issues |
| Performance | 10 second connection timeout | Don't hang on unreachable hosts |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Performance | Command execution < 5s | Connection must be fast |
| Security | Command whitelist | Not in this story (EP0013) |
| Availability | >99% SSH success rate | Retry logic essential |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: SSH connections use Tailscale hostname

- **Given** a machine with `tailscale_hostname` = `homeserver.tail-abc123.ts.net`
- **When** the SSH executor connects to the machine
- **Then** it connects to the Tailscale hostname (not IP)
- **And** the connection string is `{ssh_username}@{tailscale_hostname}`
- **And** the default username is `homelabcmd` (configurable per machine)

### AC2: SSH private key stored encrypted

- **Given** I navigate to Settings > Connectivity
- **When** I upload an SSH private key
- **Then** the key is encrypted and stored via US0081 credential service
- **And** the UI shows "✓ SSH key uploaded and encrypted"
- **And** the plaintext key is never logged or persisted unencrypted

### AC3: Connection pooling for efficiency

- **Given** an SSH connection is established to a machine
- **When** another command is sent to the same machine within 5 minutes
- **Then** the existing connection is reused (no reconnection)
- **And** connections are closed after 5 minutes of inactivity
- **And** the pool is cleared when SSH key is changed

### AC4: Automatic retry on connection failure

- **Given** an SSH connection attempt fails
- **When** the error is transient (timeout, connection refused)
- **Then** the executor retries up to 3 times
- **And** each retry waits 2 seconds
- **And** after 3 failures, returns `SSHConnectionError` with all attempt details

### AC5: Connection health check endpoint

- **Given** a machine is imported with Tailscale hostname
- **When** I call `POST /api/v1/machines/{id}/test-ssh`
- **Then** an SSH connection is attempted
- **And** on success: returns `{"success": true, "latency_ms": 150}`
- **And** on failure: returns `{"success": false, "error": "Connection timed out after 10s"}`

### AC6: Host key verification

- **Given** an SSH connection is established to a new machine
- **When** the connection succeeds
- **Then** the host key is stored for future verification
- **When** the host key changes on subsequent connection
- **Then** a warning is raised: "Host key changed for {hostname}. Accept new key?"
- **And** the user can accept or reject the new key

## Scope

### In Scope

- SSH executor service using `asyncssh`
- Connection pooling with 5-minute TTL
- SSH private key upload and encrypted storage
- Retry logic (3 attempts, 2s delay)
- Connection timeout (10 seconds)
- Host key storage and verification
- Test SSH connection endpoint

### Out of Scope

- Command execution (EP0013 Synchronous Command Execution)
- SSH password authentication (key-based only for v2.0)
- SSH agent forwarding
- Multiple SSH keys per user
- Per-machine SSH key configuration

## UI/UX Requirements

**Settings > Connectivity - SSH Section:**

```
┌────────────────────────────────────────────────┐
│ SSH Configuration                               │
├────────────────────────────────────────────────┤
│                                                │
│ Default Username:                              │
│ ┌──────────────────────────────────────────┐   │
│ │ homelabcmd                               │   │
│ └──────────────────────────────────────────┘   │
│                                                │
│ Private Key:                                   │
│ ┌──────────────────────────────────────────┐   │
│ │ ✓ Key uploaded and encrypted             │   │
│ │   Uploaded: 2026-01-25                   │   │
│ └──────────────────────────────────────────┘   │
│ [Upload New Key]  [Remove Key]                 │
│                                                │
│ Key must be in PEM format (RSA, Ed25519)       │
│                                                │
└────────────────────────────────────────────────┘
```

**Machine Detail - Test Connection:**

```
┌────────────────────────────────────────────────┐
│ SSH Connection Test                             │
├────────────────────────────────────────────────┤
│                                                │
│ Target: homeserver.tail-abc123.ts.net          │
│ User: homelabcmd                               │
│                                                │
│ [Test Connection]                              │
│                                                │
│ ✓ Connected successfully                       │
│   Latency: 150ms                               │
│   Host key: SHA256:abc123...                   │
│                                                │
└────────────────────────────────────────────────┘
```

## Technical Notes

### API Contracts

**POST /api/v1/settings/ssh/key**

Request (multipart form):
```
Content-Type: multipart/form-data

key: (file content - PEM format)
```

Response 200:
```json
{
  "success": true,
  "message": "SSH key uploaded and encrypted",
  "key_type": "ssh-ed25519",
  "fingerprint": "SHA256:abc123..."
}
```

Response 400 (invalid key):
```json
{
  "detail": {
    "code": "INVALID_SSH_KEY",
    "message": "Invalid SSH private key format. Key must be PEM format (RSA or Ed25519)."
  }
}
```

**DELETE /api/v1/settings/ssh/key**

Response 200:
```json
{
  "success": true,
  "message": "SSH key removed"
}
```

**PUT /api/v1/settings/ssh/username**

Request:
```json
{
  "username": "homelabcmd"
}
```

Response 200:
```json
{
  "success": true,
  "message": "Default SSH username updated"
}
```

**POST /api/v1/machines/{machine_id}/test-ssh**

Response 200 (success):
```json
{
  "success": true,
  "hostname": "homeserver.tail-abc123.ts.net",
  "latency_ms": 150,
  "host_key_fingerprint": "SHA256:abc123..."
}
```

Response 200 (failure):
```json
{
  "success": false,
  "hostname": "homeserver.tail-abc123.ts.net",
  "error": "Connection timed out after 10s",
  "attempts": 3
}
```

Response 400 (no SSH key):
```json
{
  "detail": {
    "code": "NO_SSH_KEY",
    "message": "No SSH key configured. Upload a key in Settings > Connectivity."
  }
}
```

### Data Requirements

**Config table entries:**

```sql
INSERT INTO config (key, value) VALUES ('ssh_username', 'homelabcmd');
```

**Credentials table (via US0081):**

```sql
INSERT INTO credentials (id, credential_type, encrypted_value)
VALUES (uuid(), 'ssh_private_key', '{encrypted_pem}');
```

**Host keys table:**

```sql
CREATE TABLE ssh_host_keys (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES servers(id),
    hostname TEXT NOT NULL,
    key_type TEXT NOT NULL,        -- 'ssh-ed25519', 'ssh-rsa', etc.
    public_key TEXT NOT NULL,      -- Base64 encoded public key
    fingerprint TEXT NOT NULL,     -- SHA256 fingerprint
    first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(machine_id)
);
```

### SSH Executor Implementation

```python
import asyncssh
from typing import Dict, Tuple, Optional
from datetime import datetime, timedelta

class SSHExecutor:
    POOL_TTL = timedelta(minutes=5)
    MAX_RETRIES = 3
    RETRY_DELAY = 2  # seconds
    CONNECT_TIMEOUT = 10  # seconds

    def __init__(self, credential_service: CredentialService, host_key_service: HostKeyService):
        self._pool: Dict[str, Tuple[asyncssh.SSHClientConnection, datetime]] = {}
        self._credential_service = credential_service
        self._host_key_service = host_key_service

    async def connect(
        self,
        hostname: str,
        username: str,
        machine_id: str
    ) -> asyncssh.SSHClientConnection:
        """Get or create connection to hostname."""
        # Check pool
        if hostname in self._pool:
            conn, expires = self._pool[hostname]
            if datetime.utcnow() < expires:
                return conn
            else:
                await conn.close()
                del self._pool[hostname]

        # Get SSH key
        private_key = await self._credential_service.get_credential('ssh_private_key')
        if not private_key:
            raise SSHKeyNotConfiguredError()

        # Get stored host key for verification
        stored_host_key = await self._host_key_service.get_host_key(machine_id)

        # Connect with retries
        last_error = None
        for attempt in range(self.MAX_RETRIES):
            try:
                conn = await asyncssh.connect(
                    host=hostname,
                    username=username,
                    client_keys=[asyncssh.import_private_key(private_key)],
                    known_hosts=None,  # We handle host key verification ourselves
                    connect_timeout=self.CONNECT_TIMEOUT
                )

                # Verify or store host key per AC6
                server_host_key = conn.get_server_host_key()
                fingerprint = server_host_key.get_fingerprint()

                if stored_host_key:
                    # Verify against stored key
                    if stored_host_key.fingerprint != fingerprint:
                        await conn.close()
                        raise HostKeyChangedError(
                            hostname=hostname,
                            old_fingerprint=stored_host_key.fingerprint,
                            new_fingerprint=fingerprint
                        )
                    # Update last_seen timestamp
                    await self._host_key_service.update_last_seen(machine_id)
                else:
                    # Store host key on first connection (Trust On First Use)
                    await self._host_key_service.store_host_key(
                        machine_id=machine_id,
                        hostname=hostname,
                        key_type=server_host_key.algorithm,
                        public_key=server_host_key.export_public_key().decode(),
                        fingerprint=fingerprint
                    )

                self._pool[hostname] = (conn, datetime.utcnow() + self.POOL_TTL)
                return conn
            except HostKeyChangedError:
                raise  # Don't retry on host key change
            except (asyncssh.Error, OSError) as e:
                last_error = e
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(self.RETRY_DELAY)

        raise SSHConnectionError(hostname, last_error, attempts=self.MAX_RETRIES)

    async def accept_new_host_key(self, machine_id: str, hostname: str) -> None:
        """Accept a changed host key (user confirmed)."""
        # Delete old key and reconnect to store new one
        await self._host_key_service.delete_host_key(machine_id)
        # Clear from pool to force reconnection
        if hostname in self._pool:
            await self._pool[hostname][0].close()
            del self._pool[hostname]


class HostKeyService:
    """Service for storing and verifying SSH host keys (AC6)."""

    async def get_host_key(self, machine_id: str) -> Optional[SSHHostKey]:
        """Retrieve stored host key for machine."""
        ...

    async def store_host_key(
        self,
        machine_id: str,
        hostname: str,
        key_type: str,
        public_key: str,
        fingerprint: str
    ) -> None:
        """Store host key on first connection."""
        ...

    async def update_last_seen(self, machine_id: str) -> None:
        """Update last_seen timestamp for host key."""
        ...

    async def delete_host_key(self, machine_id: str) -> None:
        """Delete host key (for accepting new key)."""
        ...
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No SSH key configured | Return 400: "No SSH key configured. Upload a key in Settings > Connectivity." |
| Invalid SSH key format | Return 400: "Invalid SSH private key format. Key must be PEM format (RSA or Ed25519)." |
| Connection timeout (10s) | Retry 3 times, then return error with all attempt details |
| Connection refused | Retry 3 times, then return "Connection refused by {hostname}" |
| Host unreachable | Retry 3 times, then return "Host {hostname} unreachable" |
| Authentication failed | No retry, return "Authentication failed for {username}@{hostname}" |
| Host key changed | Prompt user to accept new key or abort |
| Connection pool expired | Close old connection, establish new one |
| SSH key changed while connections active | Clear connection pool |
| Machine has no tailscale_hostname | Return 400: "Machine {id} has no Tailscale hostname" |

## Test Scenarios

- [x] SSH connection uses Tailscale hostname not IP
- [x] Connection timeout after 10 seconds
- [x] Retry 3 times on connection failure
- [x] Retry delay is 2 seconds between attempts
- [x] Connection pool reuses existing connection
- [x] Connection pool expires after 5 minutes
- [x] SSH key upload stores encrypted value
- [x] Invalid SSH key format rejected
- [x] No SSH key returns appropriate error
- [x] Test connection endpoint returns latency
- [x] Test connection shows failure details after retries
- [x] Host key stored on first connection

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0079-01 | Connection uses Tailscale hostname | AC1 | Unit | Passed |
| TC-US0079-02 | SSH key encrypted on storage | AC2 | Integration | Passed |
| TC-US0079-03 | Connection pool reuses connection | AC3 | Unit | Passed |
| TC-US0079-04 | Pool expires after 5 minutes | AC3 | Unit | Passed |
| TC-US0079-05 | Retry on connection failure | AC4 | Unit | Passed |
| TC-US0079-06 | Max 3 retry attempts | AC4 | Unit | Passed |
| TC-US0079-07 | Test connection success | AC5 | Integration | Passed |
| TC-US0079-08 | Test connection failure | AC5 | Unit | Passed |
| TC-US0079-09 | Host key stored on connect | AC6 | Integration | Passed |
| TC-US0079-10 | Host key change detected | AC6 | Unit | Passed |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| [US0078](US0078-tailscale-machine-registration.md) | Data | Machines with tailscale_hostname | Done |
| [US0081](US0081-credential-encryption-storage.md) | Service | SSH key storage | Done |

### Schema Dependencies

| Schema | Source Story | Fields Needed |
|--------|--------------|---------------|
| Server | [US0078](US0078-tailscale-machine-registration.md) | tailscale_hostname |
| credentials | [US0081](US0081-credential-encryption-storage.md) | ssh_private_key |

### API Dependencies

| Endpoint | Source Story | How Used |
|----------|--------------|----------|
| Credential service | [US0081](US0081-credential-encryption-storage.md) | Retrieve SSH key |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| asyncssh>=2.14.0 | Python library | To be added |
| Tailscale installed on machines | Infrastructure | User requirement |
| homelabcmd user on machines | Infrastructure | User requirement |

> **Note:** All story dependencies are Done (US0078, US0081).

## Implementation Notes

- [x] Create Alembic migration for `ssh_host_keys` table schema
- [x] Add `python-multipart` to dependencies (for file upload)
- Note: Using Paramiko instead of asyncssh (already installed, consistent with existing codebase)

## Estimation

**Story Points:** 8

**Complexity:** High - SSH connection management with pooling and retries

## Open Questions

None.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 10/8 minimum documented
- [x] Test scenarios: 12/10 minimum listed
- [x] API contracts: Exact request/response JSON shapes documented
- [x] Error codes: All error codes with exact messages specified

### All Stories

- [x] No ambiguous language (avoid: "handles errors", "returns data", "works correctly")
- [x] Open Questions: 0/0 resolved (critical must be resolved)
- [x] Given/When/Then uses concrete values, not placeholders
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met (API stories)
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented (not just happy path)

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-26 | Claude | Initial story creation from EP0008 |
| 2026-01-26 | Claude | Added Implementation Notes with Alembic migration requirement |
| 2026-01-26 | Claude | Updated SSH executor implementation to align with AC6 host key verification |
| 2026-01-26 | Claude | Implementation plan created (PL0080), status → Planned |
| 2026-01-26 | Claude | Backend implementation complete (TDD), 20 tests passing, all AC verified |
| 2026-01-26 | Claude | Frontend implementation complete: types, API client, TailscaleSSHSettings component, test-ssh in ServerDetail |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
