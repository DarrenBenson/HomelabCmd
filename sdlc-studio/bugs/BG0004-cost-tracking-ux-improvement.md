# BG0004: Cost Tracking Settings Should Use Popup Dialog

> **Status:** Closed
> **Severity:** Low
> **Priority:** P3
> **Reporter:** User
> **Assignee:** Claude
> **Created:** 2026-01-21
> **Updated:** 2026-01-21

## Summary

The cost tracking configuration on the Settings page should be moved to the bottom of the page and appear as a popup dialog instead of inline. This dialog should be shared with the Electricity Costs page to improve UX consistency.

## Affected Area

- **Epic:** [EP0005: Cost Tracking](../epics/EP0005-cost-tracking.md)
- **Story:** [US0030: Cost Settings Configuration](../stories/US0030-cost-settings-configuration.md)
- **Component:** Frontend - Settings page, CostsPage

## Environment

- **Version:** 1.0.0
- **Platform:** All
- **Browser:** All browsers

## Reproduction Steps

1. Navigate to Settings page
2. Observe cost tracking configuration placement
3. Compare with Electricity Costs page

## Expected Behaviour

1. Cost tracking settings should appear at the bottom of the Settings page
2. Clicking to edit should open a popup/modal dialog
3. The same dialog component should be reusable on the Electricity Costs page
4. Consistent UX between both pages for cost configuration

## Actual Behaviour

Cost tracking configuration appears inline on Settings page (placement and interaction style not optimal for UX).

## Screenshots/Evidence

N/A - UX improvement request

## Root Cause Analysis

> *Not applicable - enhancement request*

This is a UX improvement, not a defect. Current implementation works but could be improved for better user experience and code reuse.

## Fix Description

### Changes Made

1. **Created shared `CostSettingsDialog` component** (`frontend/src/components/CostSettingsDialog.tsx`)
   - Modal dialog with backdrop click to close
   - Electricity rate input (number) and currency symbol input (text)
   - UK, US, EU preset buttons for common rates
   - Keyboard support (Enter to save, Escape to cancel)
   - Loading and saving states

2. **Updated Settings page** (`frontend/src/pages/Settings.tsx`)
   - Moved cost tracking to bottom of page
   - Shows compact summary card with current rate (e.g., "Current rate: £0.24/kWh")
   - Edit button opens the shared dialog
   - Success/error messages displayed after save

3. **Updated Costs page** (`frontend/src/pages/CostsPage.tsx`)
   - Replaced "Configure Rate" navigation link with dialog trigger
   - Opens same `CostSettingsDialog` component
   - Refreshes cost breakdown data after saving

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/CostSettingsDialog.tsx` | New shared dialog component |
| `frontend/src/pages/Settings.tsx` | Compact summary card at bottom, dialog integration |
| `frontend/src/pages/CostsPage.tsx` | Dialog trigger instead of navigation, dialog integration |
| `frontend/src/pages/Settings.test.tsx` | Updated 22 tests for dialog-based UX |
| `frontend/src/pages/CostsPage.test.tsx` | Updated navigation test to verify dialog opens |

### Tests Updated

| Test ID | Description | File |
|---------|-------------|------|
| TC-US034-01 | Displays cost tracking section at bottom | Settings.test.tsx |
| TC-US034-02 | Displays Edit button and opens dialog | Settings.test.tsx |
| TC-US034-03 | Dialog shows rate and currency inputs | Settings.test.tsx |
| TC-US034-04 | Populates values from API | Settings.test.tsx |
| TC-US034-05 | Preset buttons set rate and currency | Settings.test.tsx |
| TC-US034-06 | Save calls API and shows success | Settings.test.tsx |
| TC-US034-07 | Error handling on save failure | Settings.test.tsx |
| TC-US034-08 | Cancel and backdrop close dialog | Settings.test.tsx |
| TC-COSTS-01 | Opens cost settings dialog on Configure Rate click | CostsPage.test.tsx |

## Verification

### Verification Results

- [x] Cost settings at bottom of Settings page
  - Cost Tracking section at `Settings.tsx:771-798` (after Slack Integration)
  - Shows compact card with current rate and Edit button
- [x] Dialog opens on click
  - Edit button triggers `setCostDialogOpen(true)`
  - CostSettingsDialog rendered conditionally at `Settings.tsx:801-809`
- [x] Same dialog works on Costs page
  - Same `CostSettingsDialog` component used at `CostsPage.tsx:411-423`
  - "Configure Rate" button opens dialog instead of navigating
- [x] Settings save correctly from both locations
  - Settings page: `handleSaveCostConfig` calls API, updates state, closes dialog
  - Costs page: `handleCostConfigSave` calls API, refreshes breakdown data
- [x] No regression in existing functionality
  - 55 Settings tests passing
  - 28 Costs page tests passing
  - 874 total tests passing

**Verified by:** Claude
**Verification date:** 2026-01-21

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0030 | Cost Settings Configuration |
| Story | US0031 | Cost Dashboard Display |
| Epic | EP0005 | Cost Tracking |

## Notes

This is a UX enhancement rather than a bug fix. The shared dialog component provides consistent UX between Settings and Costs pages for editing electricity rate configuration.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-21 | User | Bug reported (UX enhancement) |
| 2026-01-21 | Claude | Status → In Progress |
| 2026-01-21 | Claude | Fix implemented: shared dialog, Settings/Costs page updates |
| 2026-01-21 | Claude | Status → Fixed, 874 tests passing |
| 2026-01-21 | Claude | Status → Verified, all checklist items confirmed |
