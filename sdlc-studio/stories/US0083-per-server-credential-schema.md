# US0083: Per-Server Credential Schema

> **Status:** Done
> **Epic:** [EP0015: Per-Host Credential Management](../epics/EP0015-per-host-credential-management.md)
> **Owner:** Darren
> **Created:** 2026-01-27
> **Story Points:** 3

## User Story

**As a** system administrator
**I want** the database to support per-server credentials
**So that** I can configure different credentials for different servers

## Context

### Persona Reference

**Darren** - Has servers with different sudo configurations. Some servers (e.g., Raspberry Pis) have passwordless sudo, while others (e.g., production servers) require sudo passwords for elevated operations.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

The current credential storage system only supports global credentials - one SSH key and one Tailscale token for all servers. This creates problems when:

- Different servers require different SSH users
- Some servers require sudo passwords while others use passwordless sudo
- Different environments need different SSH keys

This story extends the database schema to support per-server credential storage while maintaining backward compatibility with existing global credentials.

## Acceptance Criteria

### AC1: Credentials table has server_id column

- **Given** the existing credentials table
- **When** the migration runs
- **Then** a new `server_id` column is added as a nullable foreign key to `servers(id)`
- **And** the column has `ON DELETE CASCADE` constraint

### AC2: Unique constraint allows per-server credentials

- **Given** the credentials table with server_id column
- **When** storing credentials
- **Then** the same credential_type can exist for different server_ids
- **And** only one credential per type per server (including NULL for global)

### AC3: Server model has SSH username field

- **Given** the servers table
- **When** the migration runs
- **Then** a new `ssh_username` column is added (nullable VARCHAR(255))
- **And** NULL means use global default username

### AC4: Server model has sudo mode field

- **Given** the servers table
- **When** the migration runs
- **Then** a new `sudo_mode` column is added (VARCHAR(20), default 'passwordless')
- **And** valid values are 'passwordless' or 'password'

### AC5: Existing credentials remain valid

- **Given** existing global credentials in the database
- **When** the migration runs
- **Then** existing credentials have server_id = NULL
- **And** they continue to function as global credentials

## Scope

### In Scope

- Alembic migration for credentials table (add server_id FK)
- Alembic migration for servers table (add ssh_username, sudo_mode)
- Update Credential model with server_id relationship
- Update Server model with ssh_username, sudo_mode fields
- Compound unique constraint on (credential_type, server_id)

### Out of Scope

- Service layer changes (US0084)
- API changes (US0087)
- UI changes (US0088)
- Migrating existing data to per-server

## Technical Notes

### Migration Script

```python
"""Add per-server credentials support.

Revision ID: xxx
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add server_id to credentials table
    op.add_column(
        'credentials',
        sa.Column('server_id', sa.String(100), nullable=True)
    )
    op.create_foreign_key(
        'fk_credentials_server_id',
        'credentials', 'servers',
        ['server_id'], ['id'],
        ondelete='CASCADE'
    )

    # Drop old unique constraint and create new compound one
    op.drop_constraint('uq_credentials_credential_type', 'credentials', type_='unique')
    op.create_index(
        'ix_credentials_type_server',
        'credentials',
        [sa.text("credential_type"), sa.text("COALESCE(server_id, '__global__')")],
        unique=True
    )

    # Add server credential fields
    op.add_column(
        'servers',
        sa.Column('ssh_username', sa.String(255), nullable=True)
    )
    op.add_column(
        'servers',
        sa.Column('sudo_mode', sa.String(20), nullable=False, server_default='passwordless')
    )

def downgrade():
    op.drop_column('servers', 'sudo_mode')
    op.drop_column('servers', 'ssh_username')
    op.drop_index('ix_credentials_type_server', 'credentials')
    op.create_index('uq_credentials_credential_type', 'credentials', ['credential_type'], unique=True)
    op.drop_constraint('fk_credentials_server_id', 'credentials', type_='foreignkey')
    op.drop_column('credentials', 'server_id')
```

### Model Changes

**Credential model:**
```python
class Credential(Base, TimestampMixin):
    __tablename__ = "credentials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    credential_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    server_id: Mapped[str | None] = mapped_column(
        String(100),
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship
    server: Mapped["Server | None"] = relationship("Server", back_populates="credentials")

    __table_args__ = (
        Index(
            'ix_credentials_type_server',
            'credential_type',
            text("COALESCE(server_id, '__global__')"),
            unique=True
        ),
    )
```

**Server model additions:**
```python
class Server(TimestampMixin, Base):
    # ... existing fields ...

    # Per-server credential settings
    ssh_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sudo_mode: Mapped[str] = mapped_column(String(20), default="passwordless", nullable=False)

    # Relationship to per-server credentials
    credentials: Mapped[list["Credential"]] = relationship(
        "Credential",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="select",
    )
```

### Files Modified

| File | Changes |
|------|---------|
| `backend/src/homelab_cmd/db/models/credential.py` | Add server_id FK, relationship, table args |
| `backend/src/homelab_cmd/db/models/server.py` | Add ssh_username, sudo_mode, credentials relationship |
| `backend/src/homelab_cmd/db/models/__init__.py` | Update imports if needed |
| `migrations/versions/xxx_add_per_server_credentials.py` | New migration file |

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Server deleted with credentials | Credentials cascade delete |
| Duplicate global credential | Unique constraint violation |
| Duplicate per-server credential | Unique constraint violation |
| Same type for different servers | Allowed (different server_ids) |
| Invalid sudo_mode value | Application validation rejects |
| Migration on empty database | Succeeds with no data changes |
| Migration with existing credentials | Existing credentials get server_id=NULL |

## Test Scenarios

- [ ] Migration creates server_id column
- [ ] Migration creates ssh_username column
- [ ] Migration creates sudo_mode column with default
- [ ] Existing credentials have server_id NULL after migration
- [ ] Can create global credential (server_id=NULL)
- [ ] Can create per-server credential
- [ ] Cannot duplicate credential type for same server
- [ ] Can have same type for different servers
- [ ] Server deletion cascades to credentials
- [ ] Downgrade migration works

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0083-01 | Migration adds server_id to credentials | AC1 | Migration | Ready |
| TC-US0083-02 | Migration adds ssh_username to servers | AC3 | Migration | Ready |
| TC-US0083-03 | Migration adds sudo_mode to servers | AC4 | Migration | Ready |
| TC-US0083-04 | Existing credentials unchanged | AC5 | Migration | Ready |
| TC-US0083-05 | Can store per-server credential | AC2 | Model | Ready |
| TC-US0083-06 | Unique constraint enforced | AC2 | Model | Ready |
| TC-US0083-07 | Cascade delete works | AC1 | Model | Ready |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| EP0008: Tailscale Integration | Epic | Done |
| Existing credentials table | Schema | Done |
| Existing servers table | Schema | Done |

## Estimation

**Story Points:** 3

**Complexity:** Low - Schema extension with compound unique constraint

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-27 | Claude | Initial story creation |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
