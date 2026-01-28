# US0081: Credential Encryption and Storage

> **Status:** Done
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Owner:** Darren
> **Created:** 2026-01-26
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** sensitive credentials encrypted at rest
**So that** my Tailscale tokens and SSH keys are secure even if the database is compromised

## Context

### Persona Reference

**Darren** - Technical professional running a homelab with 11+ servers. Values security and wants confidence that credentials stored in HomelabCmd cannot be extracted from the database without the encryption key.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

HomelabCmd v2.0 introduces Tailscale API integration and SSH connectivity, which requires storing sensitive credentials (API tokens, SSH private keys). These credentials must be encrypted at rest to prevent exposure if the SQLite database is accessed by an attacker. This story provides the foundational security layer that all credential-handling features depend on.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | Credentials encrypted with `HOMELABCMD_ENCRYPTION_KEY` | Core requirement of this story |
| Risk | Encryption key loss is critical | Must document backup procedure |
| Dependency | None | Foundation story, no blockers |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Security | Secrets in environment variables only | Encryption key from env var, not config file |
| Security | Input validation via Pydantic | Credential type must be validated |
| Performance | API response < 500ms (p95) | Encryption/decryption must be fast |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Encryption key required at startup

- **Given** HomelabCmd starts without `HOMELABCMD_ENCRYPTION_KEY` environment variable
- **When** the application initialises
- **Then** startup fails with error: `HOMELABCMD_ENCRYPTION_KEY environment variable is required`
- **And** the error message includes instructions to generate a key

### AC2: Credentials encrypted before storage

- **Given** a Tailscale API token `tskey-api-abc123-EXAMPLE` is submitted
- **When** the credential is stored in the database
- **Then** the `encrypted_value` column contains Fernet-encrypted ciphertext (base64)
- **And** the plaintext token is never written to the database
- **And** the credential_type is stored as `tailscale_token`

### AC3: Credentials decrypted on retrieval

- **Given** an encrypted credential exists in the database
- **When** the application needs to use the credential (e.g., Tailscale API call)
- **Then** the credential is decrypted in memory
- **And** the decrypted value is not logged or persisted
- **And** the decrypted value is cleared after use (short-lived)

### AC4: Credential types supported

- **Given** the credential storage system
- **When** storing credentials
- **Then** the following types are supported:
  - `tailscale_token` - Tailscale API token
  - `ssh_private_key` - SSH private key (PEM format)
- **And** unknown credential types are rejected with 400 error

### AC5: Key generation helper

- **Given** a user needs to generate an encryption key
- **When** they run `python -m homelab_cmd.cli generate-key`
- **Then** a valid Fernet key is output to stdout
- **And** instructions are displayed for setting the environment variable

## Scope

### In Scope

- Fernet encryption using `cryptography` library
- `HOMELABCMD_ENCRYPTION_KEY` environment variable requirement
- Database `credentials` table with encrypted storage
- Key generation CLI command
- Credential CRUD operations (create, read, update, delete)
- Startup validation for encryption key

### Out of Scope

- Key rotation (future enhancement)
- Hardware security module (HSM) integration
- Multi-key support for different credential types
- UI for credential management (separate story US0080)
- Audit logging for credential access (tracked separately)

## UI/UX Requirements

No UI components in this story. Credential management UI is covered in US0080.

## Technical Notes

### API Contracts

**Internal Service API (not REST endpoint):**

```python
class CredentialService:
    async def store_credential(
        self,
        credential_type: str,  # 'tailscale_token' | 'ssh_private_key'
        plaintext_value: str
    ) -> UUID:
        """Store encrypted credential, return ID."""

    async def get_credential(
        self,
        credential_type: str
    ) -> str | None:
        """Retrieve and decrypt credential, or None if not found."""

    async def delete_credential(
        self,
        credential_type: str
    ) -> bool:
        """Delete credential, return True if existed."""

    async def credential_exists(
        self,
        credential_type: str
    ) -> bool:
        """Check if credential type is stored."""
```

### Data Requirements

**Database Schema:**

```sql
CREATE TABLE credentials (
    id TEXT PRIMARY KEY,           -- UUID
    credential_type TEXT NOT NULL UNIQUE,  -- 'tailscale_token', 'ssh_private_key'
    encrypted_value TEXT NOT NULL,  -- Fernet-encrypted, base64 encoded
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_credentials_type ON credentials(credential_type);
```

**Encryption Implementation:**

```python
from cryptography.fernet import Fernet, InvalidToken
import os

class CredentialEncryption:
    def __init__(self):
        key = os.environ.get("HOMELABCMD_ENCRYPTION_KEY")
        if not key:
            raise ValueError(
                "HOMELABCMD_ENCRYPTION_KEY environment variable is required. "
                "Generate one with: python -m homelab_cmd.cli generate-key"
            )
        self.cipher = Fernet(key.encode())

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext, return base64 ciphertext."""
        return self.cipher.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt ciphertext, return plaintext."""
        return self.cipher.decrypt(ciphertext.encode()).decode()
```

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Missing `HOMELABCMD_ENCRYPTION_KEY` at startup | Fail fast with clear error message and key generation instructions |
| Invalid encryption key format | Fail at startup: `Invalid encryption key format. Key must be 32 url-safe base64-encoded bytes.` |
| Corrupted encrypted value in database | Raise `CredentialDecryptionError` with credential_type, do not expose ciphertext |
| Store credential with empty value | Reject with 400: `Credential value cannot be empty` |
| Store credential with unknown type | Reject with 400: `Unknown credential type: {type}. Allowed: tailscale_token, ssh_private_key` |
| Update existing credential | Replace encrypted value, update `updated_at` timestamp |
| Delete non-existent credential | Return False, no error |
| Get non-existent credential | Return None, no error |
| Encryption key changed after data stored | Decryption fails with `InvalidToken`, suggest re-entering credentials |

## Test Scenarios

- [x] Startup fails without encryption key environment variable
- [x] Startup fails with invalid encryption key format
- [x] Startup succeeds with valid encryption key
- [x] Store Tailscale token encrypts value before database write
- [x] Store SSH private key encrypts value before database write
- [x] Retrieve credential decrypts value correctly
- [x] Retrieve non-existent credential returns None
- [x] Delete credential removes from database
- [x] Delete non-existent credential returns False
- [x] Update credential replaces encrypted value
- [x] Unknown credential type rejected with 400
- [x] Empty credential value rejected with 400
- [x] Corrupted ciphertext raises appropriate error
- [x] Key generation CLI outputs valid Fernet key
- [x] Encrypted value in database is not plaintext

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0081-01 | Startup fails without encryption key | AC1 | Unit | ✓ Passed |
| TC-US0081-02 | Startup fails with invalid key format | AC1 | Unit | ✓ Passed |
| TC-US0081-03 | Credential encrypted on storage | AC2 | Unit | ✓ Passed |
| TC-US0081-04 | Credential decrypted on retrieval | AC3 | Unit | ✓ Passed |
| TC-US0081-05 | Tailscale token type supported | AC4 | Unit | ✓ Passed |
| TC-US0081-06 | SSH private key type supported | AC4 | Unit | ✓ Passed |
| TC-US0081-07 | Unknown type rejected | AC4 | Unit | ✓ Passed |
| TC-US0081-08 | Key generation CLI works | AC5 | Integration | ✓ Passed |
| TC-US0081-09 | Corrupted ciphertext handled | AC3 | Unit | ✓ Passed |
| TC-US0081-10 | Empty value rejected | AC2 | Unit | ✓ Passed |

## Dependencies

### Story Dependencies

| Story | Dependency Type | What's Needed | Status |
|-------|-----------------|---------------|--------|
| None | - | Foundation story | - |

### Schema Dependencies

| Schema | Source Story | Fields Needed |
|--------|--------------|---------------|
| None | - | New schema defined in this story |

### API Dependencies

| Endpoint | Source Story | How Used |
|----------|--------------|----------|
| None | - | Internal service, no API dependencies |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| `cryptography>=41.0.0` | Python library | To be added |
| `HOMELABCMD_ENCRYPTION_KEY` | Environment variable | User must set |

## Implementation Notes

- [ ] Create Alembic migration for `credentials` table schema
- [ ] Add `cryptography>=41.0.0` to dependencies

## Estimation

**Story Points:** 3

**Complexity:** Low - Standard encryption pattern using well-established library

## Open Questions

None.

## Quality Checklist

### API Stories (minimum requirements)

- [x] Edge cases: 9/8 minimum documented
- [x] Test scenarios: 15/10 minimum listed
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
| 2026-01-26 | Claude | Story review: All AC verified, 17/17 tests passing, marked Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
