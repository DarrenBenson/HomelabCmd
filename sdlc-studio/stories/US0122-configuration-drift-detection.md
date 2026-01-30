# US0122: Configuration Drift Detection

> **Status:** Done
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** to be alerted when configuration drifts from compliance
**So that** I can proactively maintain standards

## Context

### Persona Reference
**System Administrator** - Needs proactive notification when machines fall out of compliance
[Full persona details](../personas.md#system-administrator)

### Background

Machines can become non-compliant over time due to manual changes, package updates, or file modifications. Rather than requiring manual checks, the system should automatically detect when a previously compliant machine drifts out of compliance and generate alerts.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| TRD | Architecture | APScheduler | Use existing scheduler |
| PRD | Notifications | Slack webhooks | Send drift alerts to Slack |
| Epic | UX | Warnings not blocks | Non-compliant is warning, not error |

---

## Acceptance Criteria

### AC1: Scheduled Compliance Check
- **Given** the scheduler
- **When** daily at 6am
- **Then** runs compliance check for all machines with assigned packs

### AC2: Drift Detection
- **Given** a machine that was compliant yesterday
- **When** today's check shows non-compliant
- **Then** creates a `config_drift` alert

### AC3: Alert Details
- **Given** drift detected
- **When** alert created
- **Then** includes:
  - Machine name and ID
  - Pack name
  - Number of mismatches
  - Link to diff view

### AC4: Alert Severity
- **Given** configuration drift alert
- **When** created
- **Then** severity is `warning` (not critical/error)

### AC5: Slack Notification
- **Given** drift detected
- **When** alert created
- **Then** Slack notification sent with:
  - Machine name
  - "Configuration drift detected"
  - Mismatch count

### AC6: Auto-Resolve
- **Given** a drift alert exists
- **When** machine returns to compliance
- **Then** alert auto-resolves

### AC7: Disable per Machine
- **Given** a machine with `drift_detection_enabled=false`
- **When** scheduled check runs
- **Then** that machine is skipped

---

## Scope

### In Scope
- Scheduled daily compliance check (6am)
- Drift alert creation (`config_drift` type)
- Slack notification for drift
- Auto-resolve when compliant
- Per-machine disable option
- Link to diff view in alert

### Out of Scope
- Configurable schedule (fixed at 6am)
- Different schedule per machine
- Drift severity levels (all are warnings)
- Auto-remediation (see US0119)

---

## Technical Notes

### Scheduler Job

```python
# In scheduler.py
@scheduler.scheduled_job('cron', hour=6, minute=0)
async def check_configuration_drift():
    """Daily configuration drift detection at 6am."""
    logger.info("Starting configuration drift detection")

    async with get_db_session() as db:
        # Get machines with assigned packs and drift detection enabled
        machines = db.query(Server).filter(
            Server.assigned_packs.isnot(None),
            Server.drift_detection_enabled == True
        ).all()

        for machine in machines:
            for pack_name in machine.assigned_packs:
                try:
                    await check_machine_drift(db, machine, pack_name)
                except Exception as e:
                    logger.error(f"Drift check failed for {machine.id}: {e}")

    logger.info(f"Drift detection complete. Checked {len(machines)} machines.")


async def check_machine_drift(db: Session, machine: Server, pack_name: str):
    """Check single machine for drift, create/resolve alerts."""
    # Get previous check result
    previous = db.query(ConfigCheck).filter(
        ConfigCheck.server_id == machine.id,
        ConfigCheck.pack_name == pack_name
    ).order_by(ConfigCheck.checked_at.desc()).first()

    # Run new check
    result = await check_compliance(machine.id, pack_name)

    # Save result
    db.add(ConfigCheck(
        server_id=machine.id,
        pack_name=pack_name,
        is_compliant=result.is_compliant,
        mismatches=result.mismatches,
        check_duration_ms=result.duration_ms
    ))
    db.commit()

    # Check for drift (was compliant, now isn't)
    if previous and previous.is_compliant and not result.is_compliant:
        await create_drift_alert(db, machine, pack_name, result)

    # Check for resolution (was non-compliant, now is)
    elif previous and not previous.is_compliant and result.is_compliant:
        await resolve_drift_alert(db, machine, pack_name)
```

### Alert Creation

```python
async def create_drift_alert(
    db: Session,
    machine: Server,
    pack_name: str,
    result: ConfigCheckResult
):
    """Create config_drift alert and send Slack notification."""
    # Check if alert already exists
    existing = db.query(Alert).filter(
        Alert.server_id == machine.id,
        Alert.alert_type == "config_drift",
        Alert.status == "active"
    ).first()

    if existing:
        # Update existing alert
        existing.message = f"{len(result.mismatches)} items no longer compliant with {pack_name}"
        existing.updated_at = datetime.utcnow()
    else:
        # Create new alert
        alert = Alert(
            server_id=machine.id,
            alert_type="config_drift",
            severity="warning",
            title=f"Configuration drift on {machine.display_name}",
            message=f"{len(result.mismatches)} items no longer compliant with {pack_name}",
            metadata={
                "pack_name": pack_name,
                "mismatch_count": len(result.mismatches),
                "diff_url": f"/servers/{machine.id}/config?pack={pack_name}"
            }
        )
        db.add(alert)

        # Send Slack notification
        await send_slack_notification(
            title=f"⚠️ Configuration Drift: {machine.display_name}",
            message=f"{len(result.mismatches)} items no longer compliant with {pack_name}",
            severity="warning",
            link=f"/servers/{machine.id}/config"
        )

    db.commit()
```

### Auto-Resolve

```python
async def resolve_drift_alert(db: Session, machine: Server, pack_name: str):
    """Auto-resolve drift alert when machine returns to compliance."""
    alert = db.query(Alert).filter(
        Alert.server_id == machine.id,
        Alert.alert_type == "config_drift",
        Alert.status == "active"
    ).first()

    if alert:
        alert.status = "resolved"
        alert.resolved_at = datetime.utcnow()
        alert.resolved_by = "auto"
        db.commit()

        # Send resolution notification
        await send_slack_notification(
            title=f"✅ Configuration Compliant: {machine.display_name}",
            message=f"Machine is now compliant with {pack_name}",
            severity="info"
        )
```

### Database Field for Disable

```python
# Add to Server model
drift_detection_enabled = Column(Boolean, default=True)
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Machine offline during check | Skip machine, log warning |
| SSH timeout | Skip machine, log error, don't alert |
| First check ever | Don't create drift alert (no previous state) |
| Multiple packs assigned | Check each pack separately |
| Alert already exists | Update message, don't duplicate |
| Scheduler fails | Log error, resume next day |

---

## Test Scenarios

- [ ] Verify scheduled job runs at 6am
- [ ] Verify drift detected when compliant → non-compliant
- [ ] Verify no alert on first check (no drift)
- [ ] Verify alert has correct severity (warning)
- [ ] Verify alert includes mismatch count
- [ ] Verify Slack notification sent
- [ ] Verify auto-resolve when returning to compliance
- [ ] Verify disabled machines are skipped
- [ ] Verify multiple packs checked separately

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0117 | Service | Compliance checker | Draft |
| US0121 | Data | Pack assignments | Draft |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| APScheduler | Library | Available |
| Alert model | Database | Available |
| Slack notifier | Service | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium (scheduler integration, state comparison)

---

## Open Questions

None

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0100) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
| 2026-01-29 | Claude | Status: Draft → Planned. Plan PL0186 and Test Spec TS0186 created |
| 2026-01-29 | Claude | Status: Planned → Done. Implementation complete, 14 backend tests passing |
