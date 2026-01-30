# EP0017: Desktop UX Improvements

> **Status:** Done
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Target Release:** Phase 2 (Beta)

## Summary

Comprehensive dashboard UX improvements based on market leader analysis (Uptime Kuma, Grafana, Datadog, Netdata, Proxmox VE, Unraid). Enhancements include visual status indicators, search/filter functionality, inline sparklines for metric trends, accessibility improvements, and quick actions on server cards. These improvements address scale usability, trend visibility, and WCAG compliance.

## Inherited Constraints

> See PRD and TRD for full constraint details. Key constraints for this epic:

| Source | Type | Constraint | Impact |
|--------|------|------------|--------|
| PRD | Performance | Dashboard must load <3s | Badge rendering must be efficient |
| PRD | Accessibility | WCAG 2.1 AA | Colour not sole indicator |
| TRD | Architecture | React + Tailwind CSS | Use existing component patterns |
| TRD | Data | Server model fields | Use existing `is_paused`, `status`, `tailscale_hostname` |

---

## Business Context

### Problem Statement

The current dashboard design has several usability gaps compared to market leaders:
- **No search/filter** - Unusable at scale (>20 servers)
- **No sparklines** - Cannot see if metrics are improving/worsening
- **Status colour only** - Accessibility concern (WCAG) for colour-blind users
- **Subtle maintenance indicator** - Easy to miss servers in maintenance mode
- **No quick actions** - Must navigate to detail page for simple operations

**PRD Reference:** [Dashboard Requirements](../prd.md#dashboard)

### Value Proposition

These enhancements bring HomelabCmd to feature parity with industry leaders:
- **Usable at scale**: Search/filter finds servers instantly regardless of count
- **Trend visibility**: Sparklines show metric direction at a glance
- **Accessible**: Shape + colour indicators meet WCAG 2.1 AA
- **Efficient workflows**: Quick actions reduce clicks for common tasks

### Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Status identification time | ~3s | <1s | User testing |
| Find server (20+ servers) | Manual scan | <2s with search | Task timing |
| Trend visibility | None | 100% with sparklines | Visual audit |
| WCAG compliance | Partial | AA compliant | Accessibility audit |
| Clicks to toggle pause | 3+ | 1 | Click tracking |

---

## Scope

### In Scope
- Enhanced maintenance mode indicator (border glow, icon) - US0109
- Warning state visual treatment (distinct from offline) - US0110
- Tailscale/SSH connectivity badge on cards - US0111
- Dashboard search and filter - US0112
- Inline metric sparklines (CPU trend) - US0113
- Accessible status indicators (shape + colour) - US0114
- Server card quick actions (pause, SSH, details) - US0115

### Out of Scope
- Drag-and-drop card reordering (EP0011)
- Card order persistence (EP0011)
- Server/workstation section grouping (EP0011)
- WebSocket real-time updates (future epic)
- RAM/Disk sparklines (future, after CPU sparklines validated)

### Affected Personas
- **System Administrator:** Primary beneficiary - faster status recognition

---

## Acceptance Criteria (Epic Level)

### Visual Indicators (P1)
- [x] Maintenance mode shows amber/orange glow border and wrench icon
- [x] Warning state shows distinct yellow/amber border (different from offline red)
- [x] Tailscale-connected machines show Tailscale badge with icon
- [x] All indicators have tooltips explaining the state

### Usability (P2)
- [x] Dashboard has search box filtering by name/hostname
- [x] Dashboard has filter chips for status and machine type
- [x] CPU sparkline shows 30-minute trend on each card
- [x] Status indicators use shape + colour (WCAG AA compliant)

### Efficiency (P3)
- [x] Inline pause/play toggle button on server cards
- [x] Toggle pause action available without navigation
- [x] Actions are keyboard accessible

---

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
|------------|------|--------|-------|
| EP0008 (Tailscale Integration) | Feature | Done | Darren |
| `tailscale_hostname` field on Server | Data | Done | - |
| `is_paused` field on Server | Data | Done | - |

### Blocking

| Item | Type | Impact |
|------|------|--------|
| None | - | - |

---

## Risks & Assumptions

### Assumptions
- Server model has `is_paused` for maintenance mode detection
- Server model has `status` field with 'warning' value
- Server model has `tailscale_hostname` to detect Tailscale connectivity

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Visual clutter with multiple badges | Medium | Medium | Design review, use subtle styling |
| Colour accessibility issues | Low | High | Use icons + patterns, not just colour |

---

## Technical Considerations

### Architecture Impact

**Frontend:**
- Update `ServerCard` component (indicators, sparklines, quick actions)
- New components: `DashboardFilters`, `ConnectivityBadge`, `CardActions`, `MetricSparkline`
- Update `StatusLED` component (accessible shapes)
- URL state management for filters

**Backend:**
- New endpoint: `GET /api/v1/servers/{id}/metrics/sparkline` (US0113)
- Add `active_alert_count` to server list response (US0110)

### Integration Points

- ServerCard component (all visual changes)
- StatusLED component (shape + colour)
- Dashboard page (filters, URL state)
- Recharts library (sparklines)
- Existing Tailwind design system

---

## Sizing

**Story Points:** 24
**Estimated Story Count:** 8

**Breakdown by Priority:**
| Priority | Stories | Points | Focus |
|----------|---------|--------|-------|
| P1 | US0109, US0110, US0111, US0180 | 9 | Visual indicators |
| P2 | US0112, US0113, US0114 | 12 | Usability |
| P3 | US0115 | 3 | Efficiency |

**Complexity Factors:**
- CSS styling changes (low)
- Component updates (medium)
- Backend endpoint for sparklines (medium)
- URL state management (medium)
- Accessibility compliance (medium)

---

## Story Breakdown

### P1: Visual Indicators (9 SP)
- [x] [US0109: Enhanced Maintenance Mode Indicator](../stories/US0109-maintenance-mode-indicator.md) (3 SP)
- [x] [US0110: Warning State Visual Treatment](../stories/US0110-warning-state-visual.md) (3 SP)
- [x] [US0111: Connectivity Badge (Tailscale/SSH)](../stories/US0111-connectivity-badge.md) (2 SP)
- [x] [US0180: Detail Page Connectivity Badge](../stories/US0180-detail-page-connectivity-badge.md) (1 SP)

### P2: Usability (12 SP)
- [x] [US0112: Dashboard Search and Filter](../stories/US0112-dashboard-search-filter.md) (5 SP)
- [x] [US0113: Inline Metric Sparklines](../stories/US0113-inline-metric-sparklines.md) (5 SP)
- [x] [US0114: Accessible Status Indicators](../stories/US0114-accessible-status-indicators.md) (2 SP)

### P3: Efficiency (3 SP)
- [x] [US0115: Server Card Quick Actions](../stories/US0115-server-card-quick-actions.md) (3 SP)

---

## Test Plan

**Test Spec:** [TS0017: Desktop UX Improvements](../test-specs/TS0017-desktop-ux-improvements.md)

---

## Open Questions

None - all questions resolved.

### Resolved Questions

- [x] Should connectivity badge also show on detail page header? - **Yes** - Added to EP0012 (Widget-Based Detail View) scope. The detail page header will show the ConnectivityBadge component alongside the server name.

---

## Story Dependencies

```
US0109 (Maintenance Indicator) ── frontend only, no dependencies
US0110 (Warning State) ── needs active_alert_count from backend
US0111 (Connectivity Badge) ── frontend only, no dependencies

US0112 (Search/Filter) ── frontend only, no dependencies
US0113 (Sparklines) ── needs backend sparkline endpoint
US0114 (Accessibility) ── updates StatusLED component

US0115 (Quick Actions) ── depends on card layout updates
```

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial epic creation |
| 2026-01-28 | Claude | Removed drag-and-drop (EP0011 scope) |
| 2026-01-28 | Claude | Expanded scope: added US0112-US0115 from UX review |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Standardised header format, added Story Points |
| 2026-01-28 | Claude | Generated story files US0109-US0115, status → Ready |
| 2026-01-29 | Claude | Added US0180 (Detail Page Connectivity Badge) from resolved open question. Status → In Progress. 8 stories, 24 SP. |
| 2026-01-29 | Claude | US0180 implemented and tested. Epic complete: 8/8 stories Done. Status → Done. |
