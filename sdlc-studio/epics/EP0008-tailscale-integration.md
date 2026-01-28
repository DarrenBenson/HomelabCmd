# EP0008: Tailscale Integration

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-25
> **Target Release:** Phase 1 (Alpha)
> **Story Points:** 34

---

## Overview

Enable HomelabCmd to discover and connect to machines via Tailscale's encrypted mesh network. This provides stable, encrypted connectivity across all infrastructure without requiring static IPs or complex firewall rules. Supports both Tailscale-native discovery (via API) and graceful fallback to direct SSH with network scanning.

---

## Goals

### Primary Goals
- Discover all devices on Tailscale network via API
- Connect to machines via stable Tailscale MagicDNS hostnames
- Store and encrypt Tailscale API credentials securely
- Provide import workflow for discovered devices
- Support connectivity mode switching (Tailscale vs Direct SSH)

### Success Criteria
- Can list all Tailscale devices with metadata
- Can import Tailscale device as monitored machine
- SSH connections work via Tailscale hostnames
- Credentials encrypted in database with `HOMELABCMD_ENCRYPTION_KEY`
- Hub automatically detects Tailscale availability

---

## User Stories

### US0076: Tailscale API Client Integration
**Story Points:** 5
**Priority:** P0
**Dependencies:** None

**As a** system administrator
**I want** HomelabCmd to integrate with Tailscale API
**So that** I can discover all devices on my tailnet automatically

**Acceptance Criteria:**
- [ ] Tailscale API client implemented using `httpx`
- [ ] API token stored encrypted in database
- [ ] API token configurable via UI settings page
- [ ] Test connection button validates token
- [ ] Error handling for invalid tokens, network failures
- [ ] API rate limiting respected (Tailscale limits)
- [ ] Connection timeout configured (10s)

**Technical Notes:**
- Tailscale API endpoint: `https://api.tailscale.com/api/v2/`
- Authentication: `Authorization: Bearer <token>`
- Endpoints needed: `/tailnet/{tailnet}/devices`
- Store token in `credentials` table with type `tailscale_token`

**Test Scenarios:**
- Valid token → successful connection
- Invalid token → clear error message
- Network failure → timeout with retry suggestion
- Rate limit hit → backoff with user notification

---

### US0077: Tailscale Device Discovery
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0076

**As a** system administrator
**I want** to see all devices on my Tailscale network
**So that** I can identify which machines to monitor

**Acceptance Criteria:**
- [ ] GET `/api/v1/tailscale/devices` endpoint returns device list
- [ ] Device list includes: name, hostname, Tailscale IP, OS, last seen, online status
- [ ] Devices sorted by name (alphabetical)
- [ ] Filter options: online/offline, OS type
- [ ] Refresh button triggers new API call
- [ ] Discovery UI page shows all discovered devices
- [ ] Loading state during API call
- [ ] Cache results for 5 minutes (avoid excessive API calls)

**Technical Notes:**
- Parse Tailscale API response:
  ```json
  {
    "devices": [
      {
        "name": "homeserver",
        "hostname": "homeserver.tail-abc123.ts.net",
        "addresses": ["100.64.0.1"],
        "os": "linux",
        "lastSeen": "2026-01-25T20:00:00Z",
        "online": true
      }
    ]
  }
  ```

**UI Mockup:**
```
┌────────────────────────────────────────────────┐
│ Tailscale Device Discovery        [Refresh]    │
├────────────────────────────────────────────────┤
│ Discovering devices... ⟳                       │
│                                                │
│ Found 11 devices:                              │
│                                                │
│ ✓ homeserver.tail-abc123.ts.net               │
│   100.64.0.1 | OpenMediaVault | Online        │
│   Last seen: 2 minutes ago      [Import]      │
│                                                │
│ ✓ mediaserver.tail-abc123.ts.net              │
│   100.64.0.2 | Debian 12 | Online             │
│   Last seen: 1 minute ago       [Import]      │
│                                                │
│ ○ studypc.tail-abc123.ts.net                  │
│   100.64.0.10 | Ubuntu 24.04 | Offline        │
│   Last seen: 3 hours ago        [Import]      │
└────────────────────────────────────────────────┘
```

---

### US0078: Machine Registration via Tailscale
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0077

**As a** system administrator
**I want** to import Tailscale devices as monitored machines
**So that** I can start monitoring them immediately

**Acceptance Criteria:**
- [ ] "Import" button on discovery page
- [ ] Import modal pre-fills: Tailscale hostname, detected OS, Tailscale IP
- [ ] User can set: display_name, machine_type (server/workstation), TDP
- [ ] POST `/api/v1/tailscale/import` creates Machine record
- [ ] Machine record includes `tailscale_hostname` and `tailscale_device_id`
- [ ] Imported machine appears on main dashboard
- [ ] Duplicate detection (warn if hostname already exists)
- [ ] Validation: display_name required, TDP must be positive integer

**Technical Notes:**
- Database fields:
  ```sql
  machine.tailscale_hostname = "homeserver.tail-abc123.ts.net"
  machine.tailscale_device_id = "device-abc123"
  machine.display_name = "HOMESERVER" (user-editable)
  machine.machine_type = "server" or "workstation"
  ```

**Import Modal:**
```
┌────────────────────────────────────────┐
│ Import Tailscale Device                │
├────────────────────────────────────────┤
│ Tailscale Hostname:                    │
│ homeserver.tail-abc123.ts.net (locked) │
│                                        │
│ Display Name: *                        │
│ [HOMESERVER                        ]   │
│                                        │
│ Machine Type: *                        │
│ ○ Server  ● Workstation               │
│                                        │
│ TDP (Watts):                           │
│ [50                                ]   │
│                                        │
│ Machine Category:                      │
│ [Select...]▼                       ]   │
│                                        │
│        [Cancel]  [Import Machine]      │
└────────────────────────────────────────┘
```

---

### US0079: SSH Connection via Tailscale
**Story Points:** 8
**Priority:** P0
**Dependencies:** US0078

**As a** system administrator
**I want** HomelabCmd to connect to machines via Tailscale
**So that** connections work reliably across networks

**Acceptance Criteria:**
- [ ] SSH connections use Tailscale hostname (not IP)
- [ ] Connection string: `{ssh_username}@{tailscale_hostname}`
- [ ] Default username: `homelabcmd` (overridable per machine)
- [ ] SSH private key uploaded via UI, encrypted in database
- [ ] SSH connection pooling (reuse connections for 5 minutes)
- [ ] Connection timeout: 10 seconds
- [ ] Automatic retry on connection failure (3 attempts with 2s delay)
- [ ] Host key verification (store per machine, warn on change)
- [ ] Connection health check endpoint

**Technical Notes:**
- Use `asyncssh` library:
  ```python
  async with asyncssh.connect(
      host=machine.tailscale_hostname,
      username=ssh_username,
      client_keys=[ssh_private_key],
      known_hosts=None,  # Trust on first use
      connect_timeout=10
  ) as conn:
      result = await conn.run(command)
  ```
- Store SSH private key in `credentials` table with type `ssh_private_key`
- Connection pool: `Dict[machine_id, Tuple[connection, expire_time]]`

**Test Scenarios:**
- Successful connection → command executes
- Connection timeout → retry 3x, then fail
- Host key mismatch → warning with option to accept
- Invalid credentials → clear error message

---

### US0080: Connectivity Mode Management
**Story Points:** 5
**Priority:** P0
**Dependencies:** US0079

**As a** system administrator
**I want** to choose between Tailscale and Direct SSH modes
**So that** I can use HomelabCmd even without Tailscale

**Acceptance Criteria:**
- [ ] Settings page has "Connectivity" section
- [ ] Two modes: "Tailscale Mode" and "Direct SSH Mode"
- [ ] Tailscale Mode enabled when API token provided
- [ ] Direct SSH Mode enabled when no token (fallback)
- [ ] Mode switching persisted in database
- [ ] Mode displayed on dashboard (status bar)
- [ ] SSH username configurable (default: `homelabcmd`)
- [ ] SSH private key upload for both modes
- [ ] Test connection button for current mode

**Technical Notes:**
- Store mode in `config` table: `connectivity_mode` = `tailscale` or `direct_ssh`
- Mode auto-detected:
  - If `tailscale_token` credential exists → Tailscale Mode
  - Else → Direct SSH Mode
- Both modes use same SSH executor, just different hostname resolution

**Settings UI:**
```
┌────────────────────────────────────────────┐
│ Settings > Connectivity                    │
├────────────────────────────────────────────┤
│                                            │
│ ● Tailscale Mode                           │
│   Tailscale API Token:                     │
│   [sk-tail-abc123...        ] [Test]       │
│   ✓ Connected to tailnet: darren-homelab   │
│   ✓ 11 devices discovered                  │
│                                            │
│ ○ Direct SSH Mode                          │
│   Network Discovery: mDNS + subnet scan    │
│                                            │
│ SSH Configuration (Both Modes):            │
│   Default Username: [homelabcmd      ]     │
│   Private Key: [Upload Key...]             │
│   ✓ Key uploaded and encrypted             │
│                                            │
│           [Save Settings]                  │
└────────────────────────────────────────────┘
```

---

### US0081: Credential Encryption and Storage
**Story Points:** 3
**Priority:** P0
**Dependencies:** None (security foundation)

**As a** system administrator
**I want** sensitive credentials encrypted at rest
**So that** my Tailscale tokens and SSH keys are secure

**Acceptance Criteria:**
- [ ] `HOMELABCMD_ENCRYPTION_KEY` environment variable required
- [ ] Startup check: fail if encryption key missing
- [ ] Generate encryption key helper command
- [ ] Credentials encrypted before database storage (AES-256-GCM)
- [ ] Credentials decrypted only when needed (in-memory, short-lived)
- [ ] Database stores: `encrypted_value` (ciphertext + IV + tag)
- [ ] Audit log for credential access
- [ ] Key rotation support (future: decrypt with old, re-encrypt with new)

**Technical Notes:**
- Use Python `cryptography` library:
  ```python
  from cryptography.fernet import Fernet

  cipher = Fernet(encryption_key)
  encrypted = cipher.encrypt(plaintext.encode())
  decrypted = cipher.decrypt(encrypted).decode()
  ```
- Encryption key from env: `os.environ["HOMELABCMD_ENCRYPTION_KEY"]`
- Generate key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

**Database Schema:**
```sql
CREATE TABLE credentials (
  id UUID PRIMARY KEY,
  credential_type VARCHAR(50) NOT NULL, -- 'tailscale_token', 'ssh_private_key'
  encrypted_value TEXT NOT NULL,        -- Base64 encrypted blob
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Technical Architecture

### Component Diagram
```
┌─────────────────────────────────────────────────────┐
│                    Hub (FastAPI)                     │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │         Tailscale Service                     │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  API Client (httpx)                     │  │  │
│  │  │  - List devices                         │  │  │
│  │  │  - Get device details                   │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  SSH Executor (asyncssh)                │  │  │
│  │  │  - Connection pooling                   │  │  │
│  │  │  - Command execution                    │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  Credential Manager                     │  │  │
│  │  │  - Encrypt/decrypt                      │  │  │
│  │  │  - Store tokens, keys                   │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│                        ↓                            │
│  ┌──────────────────────────────────────────────┐   │
│  │          Database (SQLite)                   │   │
│  │  - credentials (encrypted)                   │   │
│  │  - machines (tailscale_hostname)             │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         ↓
                    Tailscale API
                         ↓
            ┌────────────┴────────────┐
            │                         │
      Tailscale Mesh          Tailscale Mesh
            │                         │
    ┌───────▼──────┐          ┌───────▼──────┐
    │  HOMESERVER  │          │  MEDIASERVER │
    │  (agent)     │          │  (agent)     │
    └──────────────┘          └──────────────┘
```

### API Endpoints
```
GET    /api/v1/tailscale/devices           # List discovered devices
POST   /api/v1/tailscale/import            # Import device as machine
GET    /api/v1/tailscale/status            # Connection status
POST   /api/v1/tailscale/test-connection   # Test API token

GET    /api/v1/settings/connectivity       # Get connectivity mode
PUT    /api/v1/settings/connectivity       # Update mode and credentials
POST   /api/v1/settings/test-ssh           # Test SSH connection
```

---

## Dependencies

**Python Libraries:**
- `httpx>=0.26.0` (already have) - Tailscale API calls
- `asyncssh>=2.14.0` (new) - SSH connections
- `cryptography>=41.0.0` (new) - Credential encryption

**Frontend Libraries:**
- No new dependencies (use existing fetch)

**Infrastructure:**
- Tailscale installed on all monitored machines
- `HOMELABCMD_ENCRYPTION_KEY` environment variable
- SSH key for homelabcmd user accessible

---

## Testing Strategy

### Unit Tests
- Credential encryption/decryption
- Tailscale API client (mocked responses)
- SSH connection pooling logic
- Mode detection (token present/absent)

### Integration Tests
- Tailscale API discovery (use sandbox tailnet)
- SSH connection to test machine via Tailscale
- Import workflow (full cycle)
- Credential storage and retrieval

### E2E Tests
- User uploads Tailscale token → sees devices
- User imports device → machine appears on dashboard
- User tests SSH connection → success/failure displayed

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tailscale API rate limiting | Medium | Cache results, respect rate limits, backoff on 429 |
| SSH connection failures | High | Retry logic, connection pooling, health checks |
| Encryption key loss | Critical | Document backup procedure, key rotation support |
| Tailscale hostname resolution | Medium | Fallback to IP if MagicDNS fails |

---

## Future Enhancements (Deferred)

- Automatic re-discovery on schedule (hourly)
- Tailscale ACL integration (respect access controls)
- Multi-tailnet support (for multi-user scenarios)
- SSH certificate authentication (vs key-based)
- Connection metrics and latency tracking

---

## Story Breakdown

| Story | Description | Points | Status | Dependencies |
|-------|-------------|--------|--------|--------------|
| [US0081](../stories/US0081-credential-encryption-storage.md) | Credential Encryption and Storage | 3 | Done | None (foundation) |
| [US0076](../stories/US0076-tailscale-api-client.md) | Tailscale API Client Integration | 5 | Done | US0081 |
| [US0077](../stories/US0077-tailscale-device-discovery.md) | Tailscale Device Discovery | 5 | Done | US0076 |
| [US0078](../stories/US0078-tailscale-machine-registration.md) | Machine Registration via Tailscale | 5 | Done | US0077 |
| [US0079](../stories/US0079-ssh-connection-tailscale.md) | SSH Connection via Tailscale | 8 | Done | US0078, US0081 |
| [US0080](../stories/US0080-connectivity-mode-management.md) | Connectivity Mode Management | 5 | Done | US0076, US0079 |
| [US0082](../stories/US0082-tailscale-import-with-agent-install.md) | Tailscale Import with Agent Install | 3 | Done | US0078, US0079, US0080 |
| **Total** | | **34** | | |

**Recommended Implementation Order:**
1. US0081 → 2. US0076 → 3. US0077 → 4. US0078 → 5. US0079 → 6. US0080 → 7. US0082

---

**Created:** 2026-01-25
**Last Updated:** 2026-01-27
**Epic Owner:** Darren

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-25 | Claude | Initial epic creation |
| 2026-01-26 | Claude | Generated 6 story files, updated status to Ready |
| 2026-01-27 | Claude | Added US0082, marked epic as Done (7 stories, 34 points) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
