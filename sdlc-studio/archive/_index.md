# Archive Index

**Purpose:** Historical documents superseded by SDLC Studio artefacts.
**Status:** Reference only - do not edit.

---

## Archived Files

| File | Original Location | Superseded By | Archived |
|------|-------------------|---------------|----------|
| `HomelabCmd-prd.md` | `/HomelabCmd-prd.md` | `sdlc-studio/prd.md` | 2026-01-18 |
| `HomelabCmd-trd.md` | `/HomelabCmd-trd.md` | `sdlc-studio/trd.md` | 2026-01-18 |
| `LEGACY_AUDIT_REPORT.md` | `/LEGACY_AUDIT_REPORT.md` | Domain knowledge extracted to PRD/TRD | 2026-01-18 |

---

## Why Archived

### HomelabCmd-prd.md
Original Product Requirements Document created before adopting SDLC Studio structure. Content migrated and enhanced in `sdlc-studio/prd.md` with:
- Proper section numbering
- Goals and KPIs
- User Personas
- Release Phases with exit criteria
- Success Criteria
- User Flows
- Simplified technical sections (moved to TRD)

### HomelabCmd-trd.md
Original Technical Requirements Document. Content migrated to `sdlc-studio/trd.md` with:
- Default configuration values
- Agent installation script
- Slack message examples
- Proper cross-references to PRD

### LEGACY_AUDIT_REPORT.md
Audit of legacy HomeLab projects (`/home/darren/code/DarrenBenson/HomeLab` and `HomeLab-Ansible-Playbooks`). Key insights extracted:
- Server inventory → PRD Appendix A
- Domain knowledge → PRD context sections
- Useful patterns → TRD integration patterns
- Pain points → PRD problem statement

---

## Retrieval

If historical content is needed:
```bash
cat sdlc-studio/archive/HomelabCmd-prd.md
```

These files are retained for reference but should not be modified or used as source of truth.
