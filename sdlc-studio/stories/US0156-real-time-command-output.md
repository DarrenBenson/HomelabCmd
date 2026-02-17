# US0156: Real-Time Command Output

> **Status:** Done
> **Epic:** [EP0013: Synchronous Command Execution](../epics/EP0013-synchronous-command-execution.md)
> **Owner:** Darren
> **Reviewer:** TBD
> **Created:** 2026-01-29
> **Completed:** 2026-01-31
> **Story Points:** 5
> **Target Release:** v2.0

## User Story

**As a** system administrator
**I want** to see command output in real-time
**So that** I can monitor long-running commands

## Context

### Background

For long-running commands like package updates, users benefit from seeing output as it streams rather than waiting for completion.

### Implementation Note

Originally planned for WebSockets, but implemented using **Server-Sent Events (SSE)** for simpler unidirectional streaming. SSE provides real-time output without the complexity of WebSocket infrastructure.

---

## Acceptance Criteria

### AC1: SSE Streaming ✅
- **Given** a long-running command execution
- **When** output is produced
- **Then** stdout/stderr streams to the frontend via SSE

### AC2: Progress Indicator ✅
- **Given** a command with known progress patterns (apt updates)
- **When** progress markers are detected in output
- **Then** a visual progress indicator updates in the UI

### AC3: Terminal Display ✅
- **Given** streaming command output
- **When** displayed in the UI
- **Then** output appears in a terminal-style component with colour support

### AC4: Rate Limiting ✅
- **Given** multiple streaming requests
- **When** rate limit exceeded
- **Then** appropriate error returned (10 requests per 60 seconds)

---

## Implementation

### Backend

- **Endpoint:** `POST /api/v1/servers/{server_id}/commands/stream`
- **Service:** `progress_parser.py` extracts APT progress percentages
- **Rate limiting:** 10 requests per 60-second window per API key
- **Location:** `backend/src/homelab_cmd/api/routes/commands.py`

### Frontend

- **Hook:** `useCommandStream.ts` - manages SSE connection
- **Component:** `StreamingTerminal.tsx` - renders real-time output with colours
- **Integration:** `ActionDetailPanel.tsx` - uses streaming for command execution

### Test Coverage

- `frontend/src/__tests__/hooks/useCommandStream.test.ts`
- `frontend/src/__tests__/components/StreamingTerminal.test.tsx`

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
|-------|------|---------------|--------|
| [US0153](US0153-synchronous-command-execution-api.md) | Blocks | Synchronous Command Execution API | Done |
| [US0151](US0151-ssh-executor-service.md) | Blocks | SSH Executor | Done |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-29 | Claude | Initial story creation (status: Deferred - planned for WebSocket) |
| 2026-02-01 | Claude | Updated to Done - implemented using SSE instead of WebSocket |
