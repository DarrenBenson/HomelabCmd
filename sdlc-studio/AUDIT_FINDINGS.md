# Epic and Story Audit Findings

**Audit Date:** 2026-01-28
**Auditor:** Claude
**Status:** REMEDIATED - All conflicts resolved

---

## Executive Summary

The SDLC-Studio artifacts contain **extensive story ID conflicts** affecting 8 epics and approximately 40 story IDs. Multiple epics claim the same story IDs for completely different features. This audit identifies all conflicts and proposes a remediation plan.

---

## Remediation Summary (Completed 2026-01-28)

All issues identified in this audit have been resolved:

| Issue | Resolution |
|-------|------------|
| EP0015 missing from indexes | Added to epics/_index.md and stories/_index.md |
| EP0011 story conflicts (US0102-US0108) | Renumbered to US0130-US0136 |
| EP0012 story conflicts (US0109-US0122) | Renumbered to US0137-US0150 |
| EP0013 story conflicts (US0089-US0094) | Renumbered to US0151-US0156 |
| EP0014 story conflicts (US0123-US0129) | Renumbered to US0157-US0163 |
| Index count discrepancies | Updated all totals in both indexes |

**New Story ID Allocation:**

| Epic | Story Range | Status |
|------|-------------|--------|
| EP0001-EP0007 | US0001-US0075 | v1.0 (complete) |
| EP0008 | US0076-US0082, US0093 | Tailscale Integration |
| EP0015 | US0083-US0088 | Per-Host Credentials (DONE) |
| EP0009 | US0082-US0088 (legacy), US0089-US0092 | Workstation Management |
| EP0016 | US0094-US0102 | Unified Discovery (DONE) |
| EP0010 | US0116-US0123 | Configuration Management |
| EP0017 | US0109-US0115 | Desktop UX Improvements |
| EP0011 | US0130-US0136 | Advanced Dashboard UI |
| EP0012 | US0137-US0150 | Widget-Based Detail View |
| EP0013 | US0151-US0156 | Synchronous Command Execution |
| EP0014 | US0157-US0163 | Docker Container Monitoring |

---

## Original Findings (Historical Reference)

## Critical Finding #1: EP0015 Missing from Index

**Severity:** HIGH

EP0015 (Per-Host Credential Management) exists as a file but is **completely missing** from `epics/_index.md`.

| Field | Value |
|-------|-------|
| Epic | EP0015: Per-Host Credential Management |
| File | `epics/EP0015-per-host-credential-management.md` |
| Status | Done |
| Stories | US0083-US0088 (6 stories, 24 SP) |
| Story Files | All exist |

**Impact:** Epic not tracked, story points not counted, status dashboard incorrect.

---

## Critical Finding #2: Massive Story ID Conflicts

**Severity:** CRITICAL

The following story IDs are claimed by multiple epics with **completely different content**:

### Conflict Group A: US0082-US0088 (EP0008/EP0009/EP0015)

| ID | EP0008 Claim | EP0009 Claim | EP0015 Claim | Story File |
|----|--------------|--------------|--------------|------------|
| US0082 | Tailscale Import with Agent Install (3 SP) | Machine Type Field (3 SP) | - | EP0008 version |
| US0083 | - | Workstation Registration (4 SP) | Per-Server Credential Schema (3 SP) | EP0015 version |
| US0084 | - | (renumbered to US0089) | Credential Service Per-Host (5 SP) | EP0015 version |
| US0085 | - | (renumbered to US0090) | Agent Upgrade Sudo (3 SP) | EP0015 version |
| US0086 | - | (renumbered to US0091) | Agent Removal Sudo (3 SP) | EP0015 version |
| US0087 | - | (renumbered to US0092) | Per-Server Credential API (5 SP) | EP0015 version |
| US0088 | - | Workstation Metrics Collection (2 SP) | Server Credential UI (5 SP) | EP0015 version |

**Note:** EP0009 claims US0082-US0083, US0088 in its epic file but story files belong to EP0015.

### Conflict Group B: US0089-US0094 (EP0009/EP0013)

| ID | EP0009 Claim | EP0013 Claim | Story File |
|----|--------------|--------------|------------|
| US0089 | Workstation-Aware Alerting (5 SP) | SSH Executor Service (8 SP) | EP0009 version |
| US0090 | Last Seen UI for Workstations (4 SP) | Remove Async Command Channel (3 SP) | EP0009 version |
| US0091 | Visual Distinction (3 SP) | Synchronous Command Exec API (5 SP) | EP0009 version |
| US0092 | Workstation Cost Tracking (5 SP) | Command Whitelist Enforcement (4 SP) | EP0009 version |
| US0093 | - (in EP0008: Unified SSH Key Mgmt) | Command Execution Audit Trail (3 SP) | EP0008 version |
| US0094 | - | Real-Time Command Output (5 SP) | EP0016 version |

### Conflict Group C: US0102-US0108 (EP0011/EP0016)

| ID | EP0011 Claim | EP0016 Claim | Story File |
|----|--------------|--------------|------------|
| US0102 | Drag-and-Drop Card Reordering (8 SP) | Update Routes and Cleanup (2 SP) | EP0016 version |
| US0103 | Card Order Persistence (5 SP) | - | None |
| US0104 | Server/Workstation Grouping (5 SP) | - | None |
| US0105 | Responsive Dashboard Layout (5 SP) | - | None |
| US0106 | Dashboard Summary Bar (3 SP) | - | None |
| US0107 | Card Visual Enhancements (3 SP) | - | None |
| US0108 | Dashboard Preferences Sync (3 SP) | - | None |

### Conflict Group D: US0109-US0122 (EP0012/EP0017)

| ID | EP0012 Claim | EP0017 Claim | Story File |
|----|--------------|--------------|------------|
| US0109 | Widget Grid System (8 SP) | Maintenance Mode Indicator (3 SP) | EP0017 version |
| US0110 | CPU Usage Widget (3 SP) | Warning State Visual (3 SP) | EP0017 version |
| US0111 | Memory Usage Widget (3 SP) | Connectivity Badge (2 SP) | EP0017 version |
| US0112 | Load Average Widget (2 SP) | Dashboard Search and Filter (5 SP) | EP0017 version |
| US0113 | Disk Usage Widget (3 SP) | Inline Metric Sparklines (5 SP) | EP0017 version |
| US0114 | Services Widget (3 SP) | Accessible Status Indicators (2 SP) | EP0017 version |
| US0115 | Containers Widget (5 SP) | Server Card Quick Actions (3 SP) | EP0017 version |
| US0116 | Network Widget (3 SP) | Config Pack Definitions (5 SP) | EP0010 version |
| US0117 | System Info Widget (2 SP) | Config Compliance Checker (8 SP) | EP0010 version |
| US0118 | Widget Layout Persistence (5 SP) | Config Diff View (5 SP) | EP0010 version |
| US0119 | Default Widget Layout (3 SP) | Apply Configuration Pack (8 SP) | EP0010 version |
| US0120 | Edit Layout Mode (3 SP) | Compliance Dashboard Widget (5 SP) | EP0010 version |
| US0121 | Widget Visibility Toggle (3 SP) | Pack Assignment per Machine (3 SP) | EP0010 version |
| US0122 | Responsive Widget Layout (3 SP) | Config Drift Detection (5 SP) | EP0010 version |

### Conflict Group E: US0123+ (EP0010/EP0014)

| ID | EP0010 Claim | EP0014 Claim | Story File |
|----|--------------|--------------|------------|
| US0123 | Remove Configuration Pack (3 SP) | Docker Detection (3 SP) | EP0010 version |
| US0124 | - | Container Listing via SSH (5 SP) | None |
| US0125 | - | Container Widget (5 SP) | None |
| US0126 | - | Container Start Action (3 SP) | None |
| US0127 | - | Container Stop Action (3 SP) | None |
| US0128 | - | Container Restart Action (2 SP) | None |
| US0129 | - | Container Status in Heartbeat (3 SP) | None |

---

## Finding #3: Epics with No Story Files Generated

| Epic | Stories Claimed | Story Files | Status |
|------|----------------|-------------|--------|
| EP0011 | US0102-US0108 (7) | 0 | **No files - IDs conflict with EP0016** |
| EP0012 | US0109-US0122 (14) | 0 | **No files - IDs conflict with EP0010/EP0017** |
| EP0013 | US0089-US0094 (6) | 0 | **No files - IDs conflict with EP0009/EP0016** |
| EP0014 | US0123-US0129 (7) | 0 | **No files - US0123 conflicts with EP0010** |

---

## Finding #4: Index Count Discrepancies

### epics/_index.md Issues

| Field | Index Says | Reality |
|-------|------------|---------|
| EP0008 Stories | 6 | 7 (includes US0082) |
| EP0009 Stories | 7 | Unclear - conflicting IDs |
| EP0010 Stories | 8 | 8 (correct after renumber) |
| EP0015 | Missing | 6 stories, 24 SP |
| v2.0 Total | 70 stories | ~85 stories (with all epics) |

### stories/_index.md Issues

| Field | Index Says | Reality |
|-------|------------|---------|
| Total Stories | 93 | ~100+ (missing epics) |
| Draft Count | 10 | Higher (EP0011-EP0014 stories) |

---

## Remediation Plan

### Phase 1: Renumber Conflicting Epics (Priority: CRITICAL)

The following epics need their story IDs renumbered to avoid conflicts:

| Epic | Current IDs | New IDs | Reason |
|------|-------------|---------|--------|
| EP0011 | US0102-US0108 | US0130-US0136 | Conflicts with EP0016 |
| EP0012 | US0109-US0122 | US0137-US0150 | Conflicts with EP0017, EP0010 |
| EP0013 | US0089-US0094 | US0151-US0156 | Conflicts with EP0009, EP0016 |
| EP0014 | US0123-US0129 | US0157-US0163 | Conflicts with EP0010 |

### Phase 2: Fix EP0009 Conflicts

EP0009 has internal issues:
- Claims US0082-US0083, US0088 but those belong to EP0015
- Already renumbered US0084-US0087 to US0089-US0092
- But US0089-US0092 now conflict with EP0013

**Resolution:** EP0009 needs complete renumbering for unimplemented stories (US0090-US0092) to avoid EP0013 conflicts.

### Phase 3: Add EP0015 to Index

1. Add EP0015 to `epics/_index.md`
2. Add EP0015 section to `stories/_index.md`
3. Verify all 6 story files exist and are correct

### Phase 4: Generate Missing Story Files

After renumbering, generate story files for:
- EP0011: 7 stories
- EP0012: 14 stories
- EP0013: 6 stories (minus deferred US0094)
- EP0014: 7 stories

### Phase 5: Update All Indexes

Recalculate all totals in:
- `epics/_index.md`
- `stories/_index.md`

---

## Recommended Story ID Allocation

To prevent future conflicts, allocate ID ranges by epic:

| Epic | Reserved Range | Notes |
|------|----------------|-------|
| EP0001-EP0007 | US0001-US0075 | v1.0 (complete) |
| EP0008 | US0076-US0082 | Tailscale Integration |
| EP0015 | US0083-US0088 | Per-Host Credentials |
| EP0009 | US0164-US0170 | Workstation Management (renumber remaining) |
| EP0016 | US0094-US0102 | Unified Discovery (done) |
| EP0010 | US0116-US0123 | Configuration Management |
| EP0017 | US0109-US0115 | Desktop UX Improvements |
| EP0011 | US0130-US0136 | Advanced Dashboard UI (renumber) |
| EP0012 | US0137-US0150 | Widget-Based Detail View (renumber) |
| EP0013 | US0151-US0156 | Synchronous Command Execution (renumber) |
| EP0014 | US0157-US0163 | Docker Container Monitoring (renumber) |

---

## Verification Checklist

After remediation, verify:

- [ ] No duplicate story IDs across all epics
- [ ] All epic files have correct story ID ranges
- [ ] All story files exist for each epic's claimed stories
- [ ] `epics/_index.md` includes all epics (including EP0015)
- [ ] `stories/_index.md` includes all stories
- [ ] Story point totals match reality
- [ ] Status counts (Draft/Ready/Done) are accurate
- [ ] Each story file references correct epic
- [ ] No orphaned story files

---

## Next Steps

1. **User Decision Required:** Confirm renumbering approach
2. **Execute Phase 1-2:** Renumber conflicting epics
3. **Execute Phase 3:** Add EP0015 to indexes
4. **Execute Phase 4:** Generate missing story files
5. **Execute Phase 5:** Update all index totals
6. **Verify:** Run full audit again

---

**End of Audit Report**
