# EP0006: Ad-hoc Scanning

> **Status:** Done
> **Owner:** Darren
> **Created:** 2026-01-18
> **Target Release:** Phase 6
> **Story Points:** 22

## Summary

Enable scanning of transient devices (laptops, desktops) that don't have agents installed. Use SSH to collect system information on-demand, with results stored for audit trail. Includes optional network discovery to find scannable devices.

## Inherited Constraints

Constraints that flow from PRD and TRD to this Epic.

### From PRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Goal | Fleet audit - complete inventory on demand | Network discovery must find all devices |
| Design | Brand guide compliance | Scan UI follows phosphor colour palette |
| Architecture | LAN-only deployment | Scan limited to local network |

### From TRD

| Type | Constraint | Impact on Epic |
|------|------------|----------------|
| Architecture | Monolith deployment | Scanner service in main container |
| Tech Stack | Python/FastAPI | Use paramiko or similar SSH library |
| Data Model | SQLite storage | Scan results as JSON in database |
| Security | SSH key authentication | No password-based auth |

> **Note:** Inherited constraints MUST propagate to child Stories. Check Story templates include these constraints.

## Business Context

### Problem Statement

Transient devices on the network (laptops, desktops, guest machines) have no visibility or audit trail. When troubleshooting network issues or auditing the homelab, there's no quick way to see what's running on these machines.

**PRD Reference:** [§3 Feature Inventory - Ad-hoc Scanning](../prd.md#5-feature-inventory)

### Value Proposition

On-demand visibility into any SSH-accessible device. Audit trail of device states over time. Network discovery reveals devices that might otherwise be invisible.

### Success Metrics

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Transient device visibility | None | On-demand | Scan capability |
| Network device awareness | None | Discoverable | Network scan |
| Scan history | None | 30+ days | Database records |

## Scope

### In Scope

- Initiate scan from dashboard (hostname or IP)
- SSH-based connection (key authentication)
- Collect: OS info, disk usage, installed packages, running processes
- Scan types: quick (basic info) and full (detailed)
- Scan results display
- Scan history storage
- Network discovery (find devices on LAN)
- SSH key management (stored in volume)

### Out of Scope

- Agent installation via scan
- Automatic/scheduled scanning
- Windows device scanning (SSH not standard)
- Continuous monitoring of scanned devices
- Security vulnerability scanning
- Credential-based SSH (keys only)

### Affected User Personas

- **Darren (Homelab Operator):** Audits transient devices, troubleshoots network issues

## Acceptance Criteria (Epic Level)

- [ ] Can initiate scan by entering hostname or IP
- [ ] Scan connects via SSH using configured keys
- [ ] Quick scan returns: OS, hostname, uptime, disk usage
- [ ] Full scan adds: installed packages, running processes, network interfaces
- [ ] Scan results displayed in dashboard
- [ ] Scan history stored and viewable
- [ ] Network discovery shows devices on LAN subnet
- [ ] Discovery results can be selected for scanning
- [ ] SSH keys configurable via mounted volume

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner | Notes |
|------------|------|--------|-------|-------|
| EP0001: Core Monitoring | Epic | Draft | Darren | Hub infrastructure |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| None | - | Standalone feature |

## Risks & Assumptions

### Assumptions

- Target devices have SSH enabled
- SSH key authentication is configured on target devices
- Hub has network access to target devices
- Devices are on same subnet or routable

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSH connection fails | Medium | Low | Clear error messages; connection testing |
| Scan commands fail on non-Linux | High | Medium | Document Linux-only support |
| Network discovery blocked by firewall | Medium | Low | Document network requirements |
| SSH key security | Low | High | Proper file permissions; volume mount |

## Technical Considerations

### Architecture Impact

- Scanner service in hub
- SSH client library (paramiko or similar)
- Scan entity in database
- Network discovery using ARP/ping

### Integration Points

- Dashboard → Scan API → SSH connection → Target device
- Network discovery → Device list → Scan initiation
- Scan results → Database storage → History view

### Data Considerations

- Scan results stored as JSON (flexible schema)
- Scan history with retention policy
- No sensitive data in scan results (package lists, not credentials)

**TRD Reference:** [§4 API Contracts - Scans](../trd.md#4-api-contracts)

## Sizing & Effort

**Estimated Story Count:** 6 stories (22 points)

**Complexity Factors:**

- SSH client integration
- Network discovery implementation
- Error handling for unreachable devices
- Results parsing and display

## Stakeholders

| Role | Name | Interest |
|------|------|----------|
| Product Owner | Darren | Network audit capability |
| Developer | Darren/Claude | Implementation |

## Story Breakdown

| ID | Title | Points | Status |
|----|-------|--------|--------|
| [US0037](../stories/US0037-ssh-key-configuration.md) | SSH Key Configuration | 3 | Done |
| [US0038](../stories/US0038-scan-initiation.md) | Scan Initiation | 5 | Done |
| [US0039](../stories/US0039-scan-results-display.md) | Scan Results Display | 3 | Done |
| [US0040](../stories/US0040-scan-history.md) | Scan History View | 3 | Done |
| [US0041](../stories/US0041-network-discovery.md) | Network Discovery | 5 | Done |
| [US0042](../stories/US0042-scan-dashboard-integration.md) | Scan Dashboard Integration | 3 | Done |

**Total:** 6 stories, 22 points (6 Done)

### Dependency Graph

```
US0037 (SSH Key Config)
  └─► US0038 (Scan Initiation)
        └─► US0039 (Results Display)
              └─► US0040 (Scan History)
        └─► US0041 (Network Discovery)
  └─► US0042 (Dashboard Integration)
        └─► US0038 (Scan Initiation)
        └─► US0040 (Scan History)
        └─► US0041 (Network Discovery)
```

### Implementation Order

1. **US0037** - SSH Key Configuration (foundation)
2. **US0038** - Scan Initiation
3. **US0039** - Scan Results Display
4. **US0040** - Scan History View
5. **US0041** - Network Discovery
6. **US0042** - Scan Dashboard Integration (integrates all)

## Test Plan

Test specs to be created when stories move to Ready status.

| Test Spec | Coverage | Status |
|-----------|----------|--------|
| TS00XX | SSH scanning, network discovery, scan history | Pending |

## Open Questions

None

### Resolved Questions

- [x] Network discovery method - **TCP port 22 check** (resolved 2026-01-21)
  - Fast, no elevated privileges needed
  - Only finds SSH-enabled devices (which are the scannable ones anyway)
- [x] Scan result retention policy - **30 days with auto-prune** (resolved 2026-01-21)
  - Daily scheduled job removes scans older than 30 days
  - Balances storage vs audit trail needs

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial epic creation from PRD |
| 2026-01-20 | Claude | Added Inherited Constraints and Test Plan sections |
| 2026-01-21 | Claude | Story review: resolved open questions; all 6 stories marked Ready |
| 2026-01-21 | Claude | Epic review: 5 stories Done, 1 Ready; status changed to In Progress |
| 2026-01-21 | Claude | US0042 implemented; all 6 stories Done; Epic status changed to Done |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
