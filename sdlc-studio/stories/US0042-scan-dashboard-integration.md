# US0042: Scan Dashboard Integration

> **Status:** Done
> **Epic:** [EP0006: Ad-hoc Scanning](../epics/EP0006-adhoc-scanning.md)
> **Owner:** Darren
> **Created:** 2026-01-18
> **Story Points:** 3

## User Story

**As a** Darren (Homelab Operator)
**I want** to initiate scans from a dedicated scan page
**So that** I can easily scan and discover devices from one place

## Context

### Persona Reference

**Darren** - Wants a single page for all scanning activities: manual scan, network discovery, and scan history.

[Full persona details](../personas.md#darren-homelab-operator)

### Background

This story creates the main Scans page that brings together manual scan initiation, network discovery, and quick access to scan history. It's the entry point for all ad-hoc scanning activities.

## Inherited Constraints

Constraints inherited from parent Epic that apply to this Story.

### From Epic

| Type | Constraint | Story Impact |
|------|------------|--------------|
| Security | SSH key auth only | Form excludes password field |
| Scope | Ad-hoc scanning | Page focused on on-demand scan initiation |
| Architecture | Monolith deployment | Single page integrates all scan features |

### From PRD (via Epic)

| Type | Constraint | AC Implication |
|------|------------|----------------|
| Architecture | LAN-only | Form validates local network addresses |
| UX | On-demand visibility | Quick access to scan from navigation |
| Design | Brand guide compliance | Page layout follows brand-guide.md |

> **Validation:** Each inherited constraint MUST be addressed in either AC, Edge Cases, or Technical Notes.

## Acceptance Criteria

### AC1: Scans page accessible from navigation

- **Given** logged into the dashboard
- **When** viewing the navigation
- **Then** a "Scans" menu item is available

### AC2: Manual scan form present

- **Given** viewing the Scans page
- **When** the page loads
- **Then** a form for entering hostname/IP is displayed

### AC3: Quick and Full scan buttons

- **Given** the manual scan form
- **When** entering a hostname
- **Then** both "Quick Scan" and "Full Scan" buttons are available

### AC4: Recent scans shown

- **Given** scans have been performed
- **When** viewing the Scans page
- **Then** recent scans (last 5) are displayed

### AC5: Link to full history

- **Given** recent scans section
- **When** clicking "View All History"
- **Then** navigates to the full scan history page

## Scope

### In Scope

- /scans route
- Navigation menu item
- Manual scan form
- Network discovery section
- Recent scans widget
- Navigation to history

### Out of Scope

- Scan results display (US0039)
- Full history page (US0040)
- Discovery implementation (US0041)

## UI/UX Requirements

### Scans Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HomelabCmd                                                           │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ 🏠 Home│  Scans                                                         │
│ 🖥️ Srvr│                                                                │
│ 🔔 Alrt│  ┌─────────────────────────────────────────────────────────┐  │
│ 📋 Actn│  │ Scan a Device                                            │  │
│ 🔍 Scan│  │                                                          │  │
│ ⚙️ Sett│  │ Enter a hostname or IP address to scan                   │  │
│        │  │                                                          │  │
│        │  │ Hostname/IP: [______________________]                    │  │
│        │  │ Username:    [darren_______________] (optional)          │  │
│        │  │                                                          │  │
│        │  │                    [Quick Scan]  [Full Scan]             │  │
│        │  │                                                          │  │
│        │  └─────────────────────────────────────────────────────────┘  │
│        │                                                                │
│        │  ┌─────────────────────────────────────────────────────────┐  │
│        │  │ Network Discovery                                        │  │
│        │  │ [Component from US0041]                                  │  │
│        │  └─────────────────────────────────────────────────────────┘  │
│        │                                                                │
│        │  ┌─────────────────────────────────────────────────────────┐  │
│        │  │ Recent Scans                               [View All →] │  │
│        │  │                                                          │  │
│        │  │ • 192.168.1.100 (Quick) - 10 min ago      ✓ Complete    │  │
│        │  │ • dazzbook (Full) - 1 hour ago            ✓ Complete    │  │
│        │  │ • 192.168.1.105 (Quick) - 2 hours ago     ✗ Failed      │  │
│        │  │                                                          │  │
│        │  └─────────────────────────────────────────────────────────┘  │
│        │                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### Brand Guide Reference

- Page follows standard layout patterns
- Form styling per brand guide
- Recent scans compact list format

## Technical Notes

### API Contracts

Uses endpoints from:
- US0038 (POST /api/v1/scans)
- US0040 (GET /api/v1/scans?limit=5)
- US0041 (POST /api/v1/discovery)

### Data Requirements

- No new data structures
- Combines existing endpoints

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| Empty hostname | Disable scan buttons |
| Invalid IP format | Show validation error |
| No recent scans | Show "No scans yet" message |

## Test Scenarios

- [ ] Scans page loads
- [ ] Navigation menu item works
- [ ] Manual scan form validates input
- [ ] Quick scan initiates scan
- [ ] Full scan initiates scan
- [ ] Recent scans displayed
- [ ] View All link works

## Test Cases

| TC ID | Test Case | AC | Type | Status |
|-------|-----------|-----|------|--------|
| TC-US0042-01 | Scans menu item visible in navigation | AC1 | E2E | Pending |
| TC-US0042-02 | Manual scan form displays on page load | AC2 | E2E | Pending |
| TC-US0042-03 | Quick and Full scan buttons present | AC3 | E2E | Pending |
| TC-US0042-04 | Recent scans widget shows last 5 scans | AC4 | E2E | Pending |
| TC-US0042-05 | View All link navigates to history page | AC5 | E2E | Pending |
| TC-US0042-06 | Empty hostname disables scan buttons | Edge | E2E | Pending |

## Quality Checklist

### UI Stories (minimum requirements)

- [x] Edge cases: 3/8 minimum documented
- [x] Test scenarios: 7/10 minimum listed
- [x] Wireframe or mockup provided
- [x] Brand guide compliance noted

### All Stories

- [x] No ambiguous language
- [x] Open Questions: 0/0 resolved
- [x] Given/When/Then uses concrete values
- [x] Persona referenced with specific context

### Ready Status Gate

This story can be marked **Ready** when:
- [x] All critical Open Questions resolved
- [x] Minimum edge case count met
- [x] No "TBD" placeholders in acceptance criteria
- [x] Error scenarios documented

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| US0005: Dashboard Server List | Story | Done |
| US0038: Scan Initiation | Story | Ready |

## Estimation

**Story Points:** 3

**Complexity:** Low-Medium - page composition

## Open Questions

None

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Claude | Initial story creation |
| 2026-01-20 | Claude | Added Inherited Constraints, Test Cases, Quality Checklist sections |
| 2026-01-21 | Claude | Story review: fixed dependency statuses; marked Ready |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
