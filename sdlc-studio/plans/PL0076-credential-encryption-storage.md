# PL0076: Credential Encryption and Storage - Implementation Plan

> **Status:** Complete
> **Story:** [US0081: Credential Encryption and Storage](../stories/US0081-credential-encryption-storage.md)
> **Epic:** [EP0008: Tailscale Integration](../epics/EP0008-tailscale-integration.md)
> **Created:** 2026-01-26
> **Language:** Python

## Overview

Implement secure credential storage for HomelabCmd v2.0, providing encrypted at-rest storage for Tailscale API tokens and SSH private keys. This is the foundation story for the Tailscale integration epic - all other EP0008 stories depend on this credential service.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Encryption key required | Startup fails without `HOMELABCMD_ENCRYPTION_KEY` env var |
| AC2 | Credentials encrypted | Fernet encryption before database storage |
| AC3 | Credentials decrypted on retrieval | In-memory only, never logged |
| AC4 | Credential types | Support `tailscale_token` and `ssh_private_key` |
| AC5 | Key generation helper | CLI command to generate encryption key |

## Technical Context

### Language & Framework

- **Primary Language:** Python 3.11+
- **Framework:** FastAPI with SQLAlchemy 2.0
- **Test Framework:** pytest with pytest-asyncio

### Relevant Best Practices

From `~/.claude/best-practices/python.md`:
- Type hints on all public functions
- Specific exception handling (not bare `except:`)
- Context managers for resources
- Environment variables for secrets (never hardcode)
- Logging instead of print for debugging

### Library Documentation (Context7)

Query Context7 for each library before implementation:

| Library | Context7 ID | Query | Key Patterns |
|---------|-------------|-------|--------------|
| cryptography | /pyca/cryptography | Fernet encryption | `Fernet.generate_key()`, `Fernet(key).encrypt(data)`, `Fernet(key).decrypt(token)` |

### Existing Patterns

**Service Pattern (from codebase exploration):**
```python
class SomeService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def method_name(self, param: Type) -> ReturnType:
        # Business logic
        ...
```

**Database Model Pattern:**
- Inherit from `Base` and `TimestampMixin`
- Use SQLAlchemy 2.0 `Mapped` types
- UUID primary keys as String(36)
- Unique constraints via `unique=True` on columns

**Configuration Pattern:**
- Use pydantic-settings `BaseSettings`
- Environment prefix: `HOMELAB_CMD_`
- Cached singleton via `@lru_cache`

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is a service layer with clear interfaces. Fernet encryption is well-documented and deterministic. Test-After allows faster iteration on service design, then comprehensive test coverage.

### Test Priority

1. Roundtrip: store credential, retrieve decrypted value
2. Error cases: unknown type, empty value, corrupted ciphertext
3. CLI key generation produces valid Fernet key

### Documentation Updates Required

- [ ] AGENTS.md - Add `HOMELABCMD_ENCRYPTION_KEY` to environment variables table
- [ ] README.md - Add encryption key setup instructions

## Implementation Tasks

> **Deterministic task table** - exact files, dependencies, and parallel execution flags.

| # | Task | File | Depends On | Parallel | Status |
|---|------|------|------------|----------|--------|
| 1 | Add encryption_key to Settings | `backend/src/homelab_cmd/config.py` | - | Yes | [ ] |
| 2 | Create Credential model | `backend/src/homelab_cmd/db/models/credential.py` | - | Yes | [ ] |
| 3 | Export Credential model | `backend/src/homelab_cmd/db/models/__init__.py` | 2 | No | [ ] |
| 4 | Create Alembic migration | `migrations/versions/xxxx_add_credentials_table.py` | 2 | No | [ ] |
| 5 | Create CredentialService | `backend/src/homelab_cmd/services/credential_service.py` | 2 | No | [ ] |
| 6 | Export CredentialService | `backend/src/homelab_cmd/services/__init__.py` | 5 | No | [ ] |
| 7 | Create CLI module | `backend/src/homelab_cmd/cli.py` | - | Yes | [ ] |
| 8 | Add startup validation | `backend/src/homelab_cmd/main.py` | 1 | No | [ ] |
| 9 | Add CLI entry point | `pyproject.toml` | 7 | No | [ ] |
| 10 | Write unit tests | `backend/tests/test_credential_service.py` | 5 | No | [ ] |
| 11 | Add cryptography dependency | `pyproject.toml` | - | Yes | [ ] |

### Task Dependency Graph

```
1 (config) ────────────────────────────────────┐
                                               ├──► 8 (startup validation)
2 (model) ──► 3 (export) ──► 4 (migration)     │
    │                                          │
    └──────────────────────► 5 (service) ──► 6 (export) ──► 10 (tests)

7 (CLI) ──────────────────────────────────────► 9 (entry point)

11 (dependency) ─────────────────────────────── (independent)
```

### Parallel Execution Groups

Tasks that can run concurrently:

| Group | Tasks | Prerequisite |
|-------|-------|--------------|
| 1 | 1, 2, 7, 11 | None |
| 2 | 3, 4, 5 | Task 2 complete |
| 3 | 6, 8, 9 | Tasks 1, 5, 7 complete |
| 4 | 10 | Task 6 complete |

## Implementation Phases

### Phase 1: Configuration & Dependencies

**Goal:** Add encryption key configuration and cryptography dependency

**Tasks in this phase:** 1, 11

#### Step 1.1: Add Encryption Key to Settings

- [ ] Add `encryption_key: str | None = None` field to Settings class
- [ ] Maps to env var `HOMELAB_CMD_ENCRYPTION_KEY`

**Files to modify:**
- `backend/src/homelab_cmd/config.py` - Add encryption_key field

**Considerations:**
- Key is optional in Settings (allows tests to run without it)
- Validation happens at startup in main.py lifespan

#### Step 1.2: Add Cryptography Dependency

- [ ] Add `cryptography>=41.0.0` to dependencies in pyproject.toml

**Files to modify:**
- `pyproject.toml` - Add to dependencies list

### Phase 2: Database Layer

**Goal:** Create credentials table schema and migration

**Tasks in this phase:** 2, 3, 4

#### Step 2.1: Create Credential Model

- [ ] Create new model file with Credential class
- [ ] Inherit from Base and TimestampMixin
- [ ] Fields: id (UUID), credential_type (unique), encrypted_value (Text)

**Files to create:**
- `backend/src/homelab_cmd/db/models/credential.py`

```python
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from homelab_cmd.db.base import Base, TimestampMixin

class Credential(Base, TimestampMixin):
    __tablename__ = "credentials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    credential_type: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
```

#### Step 2.2: Export Credential Model

- [ ] Import and export Credential in models __init__.py

**Files to modify:**
- `backend/src/homelab_cmd/db/models/__init__.py`

#### Step 2.3: Create Alembic Migration

- [ ] Generate migration with `alembic revision --autogenerate -m "add credentials table"`
- [ ] Verify migration creates correct schema
- [ ] Add index on credential_type

**Files to create:**
- `migrations/versions/xxxx_add_credentials_table.py`

### Phase 3: Service Layer

**Goal:** Implement CredentialService with encryption/decryption

**Tasks in this phase:** 5, 6

#### Step 3.1: Create CredentialService

- [ ] Create service class with AsyncSession and encryption_key in constructor
- [ ] Implement store_credential() - validates type, encrypts, stores
- [ ] Implement get_credential() - retrieves, decrypts, returns
- [ ] Implement delete_credential() - removes from database
- [ ] Implement credential_exists() - check without decrypting
- [ ] Create custom exceptions: CredentialDecryptionError

**Files to create:**
- `backend/src/homelab_cmd/services/credential_service.py`

**Key implementation details:**
- Validate credential_type against allowed set
- Reject empty values with ValueError
- Wrap Fernet InvalidToken in CredentialDecryptionError
- Use uuid.uuid4() for new credential IDs
- Upsert logic for store_credential (update if exists)

#### Step 3.2: Export CredentialService

- [ ] Add CredentialService to services __init__.py exports

**Files to modify:**
- `backend/src/homelab_cmd/services/__init__.py`

### Phase 4: CLI & Startup Validation

**Goal:** Add key generation CLI and startup validation

**Tasks in this phase:** 7, 8, 9

#### Step 4.1: Create CLI Module

- [ ] Create CLI module using Click
- [ ] Implement `generate-key` command
- [ ] Output key and usage instructions

**Files to create:**
- `backend/src/homelab_cmd/cli.py`

```python
import click
from cryptography.fernet import Fernet

@click.group()
def cli():
    """HomelabCmd command-line utilities."""
    pass

@cli.command("generate-key")
def generate_key():
    """Generate a new encryption key for credential storage."""
    key = Fernet.generate_key().decode()
    click.echo(f"\nGenerated encryption key:\n{key}")
    click.echo("\nAdd to your environment:")
    click.echo(f'  export HOMELABCMD_ENCRYPTION_KEY="{key}"')
    click.echo("\nOr add to .env file:")
    click.echo(f'  HOMELABCMD_ENCRYPTION_KEY="{key}"')
```

#### Step 4.2: Add Startup Validation

- [ ] Add encryption key validation to FastAPI lifespan
- [ ] Check key is present (fail fast if not)
- [ ] Validate key format by creating Fernet instance
- [ ] Clear error messages with generation instructions

**Files to modify:**
- `backend/src/homelab_cmd/main.py` - Add validation to lifespan function

#### Step 4.3: Add CLI Entry Point

- [ ] Add `[project.scripts]` entry for CLI

**Files to modify:**
- `pyproject.toml` - Add CLI entry point

### Phase 5: Testing & Validation

**Goal:** Verify all acceptance criteria are met

**Tasks in this phase:** 10

#### Step 5.1: Unit Tests

- [ ] Test store_credential encrypts value
- [ ] Test get_credential decrypts value
- [ ] Test roundtrip (store then get)
- [ ] Test unknown type rejected
- [ ] Test empty value rejected
- [ ] Test get non-existent returns None
- [ ] Test delete existing returns True
- [ ] Test delete non-existent returns False
- [ ] Test update existing credential
- [ ] Test corrupted ciphertext raises error

**Test file:** `backend/tests/test_credential_service.py`

#### Step 5.2: CLI Tests

- [ ] Test generate-key produces valid Fernet key
- [ ] Test key can be used to create Fernet instance

#### Step 5.3: Acceptance Criteria Verification

| AC | Verification Method | File Evidence | Status |
|----|---------------------|---------------|--------|
| AC1 | Startup without key fails | `main.py:50-69` (`_validate_encryption_key`) | ✓ Verified |
| AC2 | Encrypted value in DB is not plaintext | `test_credential_service.py:68-89` | ✓ Verified |
| AC3 | Decrypted value matches original | `test_credential_service.py:32-65` | ✓ Verified |
| AC4 | Both credential types work | `test_credential_service.py:32-65,268-272` | ✓ Verified |
| AC5 | CLI generates valid key | `test_credential_service.py:278-320` | ✓ Verified |

## Edge Case Handling Plan

Every edge case from the Story MUST appear here with an explicit handling strategy.

### Edge Case Coverage

| # | Edge Case (from Story) | Handling Strategy | Implementation Phase | Validated |
|---|------------------------|-------------------|---------------------|-----------|
| 1 | Missing `HOMELABCMD_ENCRYPTION_KEY` at startup | Fail fast in lifespan with clear error message and key generation instructions | Phase 4 | ✓ |
| 2 | Invalid encryption key format | Validate by attempting Fernet instantiation; raise RuntimeError with format guidance | Phase 4 | ✓ |
| 3 | Corrupted encrypted value in database | Catch InvalidToken, raise CredentialDecryptionError with credential_type (no ciphertext exposure) | Phase 3 | ✓ |
| 4 | Store credential with empty value | Validate in service, raise ValueError: "Credential value cannot be empty" | Phase 3 | ✓ |
| 5 | Store credential with unknown type | Validate against ALLOWED_CREDENTIAL_TYPES set, raise ValueError with allowed types list | Phase 3 | ✓ |
| 6 | Update existing credential | Upsert logic: query by type, update encrypted_value and updated_at if exists | Phase 3 | ✓ |
| 7 | Delete non-existent credential | Return False, no error raised | Phase 3 | ✓ |
| 8 | Get non-existent credential | Return None, no error raised | Phase 3 | ✓ |
| 9 | Encryption key changed after data stored | Fernet raises InvalidToken; CredentialDecryptionError suggests re-entering credentials | Phase 3 | ✓ |

### Coverage Summary

- Story edge cases: 9
- Handled in plan: 9
- Unhandled: 0

### Edge Case Implementation Notes

- Edge cases 3 and 9 both result in Fernet InvalidToken - distinguish in error message if possible
- Edge case 6 uses SQLAlchemy merge or explicit update query
- All validation happens in service layer, not database constraints

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Encryption key lost | All credentials unrecoverable | Document backup procedure in README; warn user during key generation |
| Key exposed in logs | Security breach | Never log key value; mark field as sensitive in pydantic |
| SQLite concurrent writes | Potential corruption | Already handled by existing session management |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| cryptography>=41.0.0 | Python library | Must be added to pyproject.toml |
| click | Python library | Already a dependency (via uvicorn/FastAPI) |
| HOMELABCMD_ENCRYPTION_KEY | Environment | User must set before running |

## Open Questions

- [x] Should encryption key validation happen at Settings instantiation or lifespan?
  - **Resolved:** Lifespan - allows tests to run without key

## Definition of Done Checklist

- [x] All acceptance criteria implemented
- [x] Unit tests written and passing (17/17 tests)
- [x] Edge cases handled (9/9 cases)
- [x] Code follows best practices
- [x] No linting errors
- [x] Documentation updated (AGENTS.md)
- [x] Ready for code review

## Notes

- This story has no story dependencies - it's the foundation for EP0008
- Subsequent stories (US0076-US0080) will depend on CredentialService
- Consider adding credential rotation in future enhancement (out of scope for v2.0)
