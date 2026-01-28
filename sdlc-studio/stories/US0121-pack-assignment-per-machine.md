# US0121: Pack Assignment per Machine

> **Status:** Draft
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 3

## User Story

**As a** system administrator
**I want** to assign which packs apply to each machine
**So that** servers and workstations can have different requirements

## Context

### Persona Reference
**System Administrator** - Needs different configuration standards for different machine types
[Full persona details](../personas.md#system-administrator)

### Background

Not all machines should be checked against the same configuration pack. Servers might only need the Base Pack, while development workstations need Developer Max. This story enables assigning specific packs to each machine and sets sensible defaults based on machine type.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| TRD | Database | SQLite with SQLAlchemy | JSON column for pack list |
| Epic | UX | Defaults by machine type | Auto-assign on registration |

---

## Acceptance Criteria

### AC1: Database Field
- **Given** the Server model
- **When** updated
- **Then** includes `assigned_packs` JSON column storing array of pack names

### AC2: Update Packs Endpoint
- **Given** `PUT /api/v1/servers/{id}/config/packs`
- **When** called with `{"packs": ["base", "developer-max"]}`
- **Then** updates the server's assigned packs

### AC3: Get Packs Endpoint
- **Given** `GET /api/v1/servers/{id}/config/packs`
- **When** called
- **Then** returns server's assigned packs array

### AC4: Machine Detail Display
- **Given** server detail page
- **When** displayed
- **Then** shows currently assigned packs

### AC5: Pack Assignment UI
- **Given** machine settings page
- **When** editing configuration
- **Then** shows pack checkboxes:
  - Base Pack (required for all)
  - Developer Lite
  - Developer Max

### AC6: Default Assignment
- **Given** a new server registered with `machine_type="server"`
- **When** created
- **Then** `assigned_packs` defaults to `["base"]`
- **Given** a new server registered with `machine_type="workstation"`
- **When** created
- **Then** `assigned_packs` defaults to `["base", "developer-lite"]`

### AC7: Compliance Check Uses Assignment
- **Given** a compliance check
- **When** executed without explicit pack
- **Then** checks against all assigned packs

---

## Scope

### In Scope
- `assigned_packs` column on Server model
- `PUT /api/v1/servers/{id}/config/packs` endpoint
- `GET /api/v1/servers/{id}/config/packs` endpoint
- Pack assignment UI
- Default assignments based on machine type
- Migration for new column

### Out of Scope
- Pack inheritance UI (just uses extends in YAML)
- Pack groups/profiles
- Scheduled pack assignment changes

---

## Technical Notes

### Database Migration

```python
# alembic migration
def upgrade():
    op.add_column('server', sa.Column(
        'assigned_packs',
        sa.JSON,
        nullable=True,
        server_default='["base"]'
    ))

def downgrade():
    op.drop_column('server', 'assigned_packs')
```

### Model Update

```python
class Server(Base):
    __tablename__ = "server"
    # ... existing fields
    assigned_packs = Column(JSON, nullable=True, default=["base"])
```

### Default Assignment Logic

```python
# In server registration
def get_default_packs(machine_type: str) -> list[str]:
    if machine_type == "workstation":
        return ["base", "developer-lite"]
    return ["base"]  # servers

# When creating server
server = Server(
    # ... other fields
    machine_type=create_data.machine_type,
    assigned_packs=get_default_packs(create_data.machine_type)
)
```

### API Endpoints

```python
@router.get("/servers/{server_id}/config/packs")
async def get_assigned_packs(server_id: str, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(404, "Server not found")
    return {"packs": server.assigned_packs or ["base"]}

@router.put("/servers/{server_id}/config/packs")
async def update_assigned_packs(
    server_id: str,
    data: PackAssignmentRequest,
    db: Session = Depends(get_db)
):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(404, "Server not found")

    # Validate pack names
    available_packs = await get_available_packs()
    for pack in data.packs:
        if pack not in available_packs:
            raise HTTPException(400, f"Unknown pack: {pack}")

    server.assigned_packs = data.packs
    db.commit()
    return {"packs": server.assigned_packs}
```

### UI Component

```tsx
// PackAssignment.tsx
interface PackAssignmentProps {
  serverId: string;
  currentPacks: string[];
  onSave: (packs: string[]) => void;
}

export function PackAssignment({ serverId, currentPacks, onSave }: PackAssignmentProps) {
  const [selected, setSelected] = useState<string[]>(currentPacks);
  const { data: availablePacks } = useAvailablePacks();

  const handleToggle = (packName: string) => {
    if (packName === 'base') return; // Base is required
    setSelected(prev =>
      prev.includes(packName)
        ? prev.filter(p => p !== packName)
        : [...prev, packName]
    );
  };

  return (
    <div className="space-y-2">
      <h4 className="font-medium">Configuration Packs</h4>
      {availablePacks?.map(pack => (
        <label key={pack.name} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected.includes(pack.name)}
            onChange={() => handleToggle(pack.name)}
            disabled={pack.name === 'base'}
          />
          <span>{pack.display_name}</span>
          {pack.name === 'base' && (
            <span className="text-xs text-text-secondary">(required)</span>
          )}
        </label>
      ))}
      <Button onClick={() => onSave(selected)}>Save</Button>
    </div>
  );
}
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Empty packs array | Default to ["base"] |
| Unknown pack name | Reject with 400 error |
| Remove base pack | Prevent removal (base is required) |
| Machine type changes | Don't auto-update packs (user choice) |
| Null assigned_packs | Treat as ["base"] |

---

## Test Scenarios

- [ ] Verify migration adds assigned_packs column
- [ ] Verify new server gets default packs
- [ ] Verify workstation gets developer-lite by default
- [ ] Verify PUT endpoint updates packs
- [ ] Verify GET endpoint returns packs
- [ ] Verify unknown pack rejected
- [ ] Verify base pack cannot be removed
- [ ] Verify UI shows checkboxes for all packs
- [ ] Verify compliance check uses assigned packs

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0116 | Data | Pack definitions | Draft |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Server model | Database | Available |
| Alembic | Migration | Available |

---

## Estimation

**Story Points:** 3
**Complexity:** Low (database field, simple endpoints)

---

## Open Questions

None

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0099) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
