# ADR-001: Heartbeat Response Schema

## Status

Accepted

## Context

The TRD (Technical Requirements Document) specifies the following heartbeat response schema:

```json
{
  "received": true,
  "server_time": "ISO8601",
  "pending_commands": [...]
}
```

During implementation of US0003 (Agent Heartbeat Endpoint), a different schema was adopted:

```json
{
  "status": "ok",
  "server_registered": false,
  "pending_commands": []
}
```

This creates a divergence between the TRD specification and the implemented API.

## Decision

We will keep the current implementation schema rather than align with the TRD, for the following reasons:

1. **Semantic clarity**: `status: "ok"` provides clear success indication that can later support error states (e.g., `status: "error"`)

2. **Agent registration feedback**: The `server_registered` field provides immediate feedback to the agent about whether it was auto-registered during this heartbeat, which is useful for agent-side logging and debugging

3. **Backwards compatibility**: The implementation is already in use and changing it would require coordinated agent updates

4. **Equivalent functionality**: Both schemas serve the same purpose - acknowledge receipt and deliver pending commands

## Consequences

### Positive

- Agents receive clearer feedback about their registration state
- Status field allows for richer response semantics in future
- No breaking changes to existing implementation

### Negative

- TRD and implementation are not aligned (requires TRD update)
- New developers must consult implementation rather than TRD for accurate schema

## Action Items

- [ ] Update TRD section 4.2 to reflect actual implementation schema
- [ ] Ensure agent development documentation matches implementation

## Date

2026-01-18
