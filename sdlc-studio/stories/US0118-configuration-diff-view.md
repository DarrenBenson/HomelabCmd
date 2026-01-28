# US0118: Configuration Diff View

> **Status:** Draft
> **Epic:** [EP0010: Configuration Management](../epics/EP0010-configuration-management.md)
> **Owner:** Darren
> **Reviewer:** -
> **Created:** 2026-01-28
> **Story Points:** 5

## User Story

**As a** system administrator
**I want** to see a diff between expected and actual configuration
**So that** I understand exactly what needs to change

## Context

### Persona Reference
**System Administrator** - Needs clear visibility into configuration differences
[Full persona details](../personas.md#system-administrator)

### Background

After running a compliance check (US0117), users need to see the specific differences between expected and actual configuration. This diff view should clearly show what's missing, what's different, and what the expected values are - similar to how git diff shows code changes.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
|--------|------|------------|----------------|
| TRD | Frontend | React + Tailwind | Use existing design system |
| Epic | UX | Colour-coded diffs | Green/red/yellow for clarity |

---

## Acceptance Criteria

### AC1: Diff Endpoint
- **Given** `GET /api/v1/servers/{id}/config/diff?pack={pack_name}`
- **When** called
- **Then** returns structured diff data for all mismatched items

### AC2: File Content Diff
- **Given** a file with different content
- **When** diff generated
- **Then** returns unified diff format showing:
  - Lines removed (expected but missing)
  - Lines added (present but unexpected)
  - Context lines around changes

### AC3: Package Version Diff
- **Given** a package version mismatch
- **When** diff generated
- **Then** shows:
  - Package name
  - Expected version (minimum)
  - Actual version installed

### AC4: Missing Item Diff
- **Given** a missing file or package
- **When** diff generated
- **Then** shows:
  - Item type and path/name
  - Expected state
  - Actual: "not found"

### AC5: Frontend Diff Display
- **Given** diff data
- **When** displayed in UI
- **Then** shows:
  - Colour-coded changes (green=addition, red=deletion, yellow=change)
  - Collapsible sections per mismatch type
  - Summary counts at top

### AC6: Check Again Button
- **Given** the diff view
- **When** "Check Again" clicked
- **Then** re-runs compliance check and refreshes diff

### AC7: Apply Pack Button
- **Given** mismatches exist
- **When** diff view displayed
- **Then** shows "Apply Pack" button (links to US0119)

---

## Scope

### In Scope
- `GET /api/v1/servers/{id}/config/diff` endpoint
- Unified diff format for file content
- Structured diff for packages and settings
- Frontend diff component with colour coding
- Collapsible mismatch sections

### Out of Scope
- Side-by-side diff view (unified only)
- Syntax highlighting for config files
- Inline editing
- Partial apply (individual items)

---

## Technical Notes

### API Response Format

```json
{
  "server_id": "studypc",
  "pack_name": "developer_max",
  "is_compliant": false,
  "summary": {
    "total_items": 45,
    "compliant": 42,
    "mismatched": 3
  },
  "mismatches": [
    {
      "type": "missing_file",
      "category": "files",
      "path": "~/.bashrc.d/aliases.sh",
      "expected": { "exists": true, "mode": "0644" },
      "actual": { "exists": false }
    },
    {
      "type": "wrong_version",
      "category": "packages",
      "package": "curl",
      "expected": ">= 8.5.0",
      "actual": "8.2.0"
    },
    {
      "type": "wrong_content",
      "category": "files",
      "path": "~/.config/ghostty/config",
      "diff": "--- expected\n+++ actual\n@@ -1,3 +1,3 @@\n font-size = 14\n-theme = catppuccin-mocha\n+theme = default"
    }
  ]
}
```

### Frontend Component Structure

```tsx
// ConfigDiffView.tsx
interface ConfigDiffViewProps {
  serverId: string;
  packName: string;
}

export function ConfigDiffView({ serverId, packName }: ConfigDiffViewProps) {
  const { data, refetch } = useConfigDiff(serverId, packName);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2>Configuration Compliance: {data.server_id}</h2>
        <Button onClick={refetch}>Check Again</Button>
      </div>

      {/* Summary */}
      <ComplianceSummary summary={data.summary} />

      {/* Mismatch sections - collapsible */}
      <MismatchSection
        title="Missing Files"
        items={data.mismatches.filter(m => m.type === 'missing_file')}
      />
      <MismatchSection
        title="Version Mismatches"
        items={data.mismatches.filter(m => m.type === 'wrong_version')}
      />
      <MismatchSection
        title="Content Differences"
        items={data.mismatches.filter(m => m.type === 'wrong_content')}
      />

      {/* Apply button */}
      {data.mismatches.length > 0 && (
        <Button variant="primary">Apply {packName} Pack</Button>
      )}
    </div>
  );
}
```

### Diff Styling

```css
/* Unified diff styling */
.diff-line-add { background: rgba(34, 197, 94, 0.2); }    /* green */
.diff-line-remove { background: rgba(239, 68, 68, 0.2); } /* red */
.diff-line-context { background: transparent; }

.diff-prefix-add { color: #22c55e; }
.diff-prefix-remove { color: #ef4444; }
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
|----------|-------------------|
| No mismatches (compliant) | Show success message, no diff sections |
| Binary file content | Show "Binary file differs" instead of diff |
| Very large diff (>1000 lines) | Truncate with "Show more" link |
| File content not retrievable | Show "Content unavailable" with reason |
| Diff endpoint fails | Show error message with retry button |
| Pack not assigned to server | Show warning, suggest assigning pack |

---

## Test Scenarios

- [ ] Verify diff endpoint returns structured data
- [ ] Verify missing file shows expected vs actual
- [ ] Verify version mismatch shows both versions
- [ ] Verify file content diff in unified format
- [ ] Verify frontend renders colour-coded diff
- [ ] Verify collapsible sections work
- [ ] Verify "Check Again" triggers new check
- [ ] Verify "Apply Pack" button visible when mismatches exist
- [ ] Verify compliant state shows success message

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| US0117 | Data | Compliance check results | Draft |

### External Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Tailwind CSS | Styling | Available |

---

## Estimation

**Story Points:** 5
**Complexity:** Medium (diff formatting, frontend component)

---

## Open Questions

None

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-28 | Claude | Initial story creation (renumbered from US0096) |
| 2026-01-28 | Claude | SDLC-Studio v2.1.0: Added Story Points to header |
