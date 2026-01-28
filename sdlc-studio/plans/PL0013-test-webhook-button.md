# PL0013: Test Webhook Button - Implementation Plan

> **Status:** Complete
> **Story:** [US0049: Test Webhook Button](../stories/US0049-test-webhook-button.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-19
> **Language:** Python (Backend), TypeScript (Frontend)

## Overview

Add a "Test" button to the Settings page that sends a test message to the configured Slack webhook URL. Provides immediate feedback on whether the webhook integration is working.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Button visible when URL entered | Test button appears next to webhook URL input |
| AC2 | Button hidden when URL empty | No button when webhook field is empty |
| AC3 | Test sends sample message | Sends formatted test message to Slack |
| AC4 | Success feedback shown | Toast message on successful send |
| AC5 | Failure feedback shown | Error message with reason on failure |
| AC6 | Button shows loading state | Spinner and disabled state during request |

## Technical Context

### Language & Framework

- **Backend:** Python 3.12 with FastAPI, httpx for HTTP requests
- **Frontend:** TypeScript with React 18, Vite, TailwindCSS
- **Test Framework:** pytest (backend), Vitest (frontend)

### Relevant Best Practices

- Follow existing API patterns (`config.py` routes)
- Use httpx async client for Slack webhook request
- Match frontend toast pattern from Settings page

### Existing Patterns

**Backend Webhook Request (from notifier.py:135-172):**
```python
response = await self.client.post(self.webhook_url, json=payload)
if response.status_code == 429:
    # Rate limited
response.raise_for_status()
```

**Frontend API Client (from client.ts:31-38):**
```typescript
export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),
  put: <T>(endpoint: string, data: unknown) => ...
  // Need to add: post method
};
```

**Settings Page Toast Pattern (from Settings.tsx:335-351):**
```tsx
{saveSuccess && (
  <div className="mb-6 rounded-md border border-status-success/30 bg-status-success/10 p-4 text-status-success">
    {saveSuccess}
  </div>
)}
```

## Recommended Approach

**Strategy:** Test-After
**Rationale:** Simple endpoint with well-defined behaviour. Minimal code changes, extending existing patterns.

### Test Priority

1. Backend endpoint sends request to provided URL
2. Backend returns appropriate error messages
3. Frontend shows/hides button based on URL value
4. Frontend displays success/error feedback

### Documentation Updates Required

- [ ] Update story status to Planned

## Implementation Steps

### Phase 1: Backend - Test Webhook Endpoint

**Goal:** Create endpoint that sends test message to provided webhook URL

#### Step 1.1: Create Request/Response Schemas

- [ ] Add `TestWebhookRequest` schema (webhook_url field)
- [ ] Add `TestWebhookResponse` schema (success, message/error fields)

**Files to modify:**
- `backend/src/homelab_cmd/api/schemas/config.py` - Add new schemas

**Code:**
```python
class TestWebhookRequest(BaseModel):
    """Request to test a Slack webhook URL."""
    webhook_url: str = Field(..., min_length=1)


class TestWebhookResponse(BaseModel):
    """Response from webhook test."""
    success: bool
    message: str | None = None
    error: str | None = None
```

#### Step 1.2: Create Test Webhook Endpoint

- [ ] Add POST `/config/test-webhook` endpoint
- [ ] Send test message to provided URL
- [ ] Handle success (200), error responses, and timeouts

**Files to modify:**
- `backend/src/homelab_cmd/api/routes/config.py` - Add new endpoint

**Code:**
```python
import httpx
from datetime import UTC, datetime

@router.post("/test-webhook", response_model=TestWebhookResponse)
async def test_webhook(
    request: TestWebhookRequest,
    _: str = Depends(verify_api_key),
) -> TestWebhookResponse:
    """Test a Slack webhook URL by sending a test message.

    Does not require or modify stored configuration - uses the URL
    provided in the request body.
    """
    # Format test message
    timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    payload = {
        "attachments": [
            {
                "color": "#3B82F6",  # Blue (info)
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "HomelabCmd Test"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Webhook configured successfully!"
                        }
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": f"Sent at {timestamp}"
                            }
                        ]
                    }
                ]
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(request.webhook_url, json=payload)

            if response.status_code == 200:
                return TestWebhookResponse(
                    success=True,
                    message="Test message sent successfully"
                )
            elif response.status_code == 404:
                return TestWebhookResponse(
                    success=False,
                    error="Invalid webhook URL"
                )
            elif response.status_code == 429:
                return TestWebhookResponse(
                    success=False,
                    error="Too many requests, try again later"
                )
            else:
                # Try to extract Slack error message
                try:
                    error_text = response.text
                except Exception:
                    error_text = f"HTTP {response.status_code}"
                return TestWebhookResponse(
                    success=False,
                    error=f"Slack returned error: {error_text}"
                )

    except httpx.TimeoutException:
        return TestWebhookResponse(
            success=False,
            error="Connection timed out"
        )
    except httpx.ConnectError:
        return TestWebhookResponse(
            success=False,
            error="Failed to connect to webhook URL"
        )
    except Exception as e:
        return TestWebhookResponse(
            success=False,
            error=str(e)
        )
```

### Phase 2: Frontend - API Client Extension

**Goal:** Add POST method to API client and test webhook function

#### Step 2.1: Add POST Method to API Client

- [ ] Add `post` method to api object

**Files to modify:**
- `frontend/src/api/client.ts` - Add post method

**Code:**
```typescript
export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),
  put: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  post: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
```

#### Step 2.2: Add Test Webhook API Function

- [ ] Add types for request/response
- [ ] Add `testWebhook` function

**Files to modify:**
- `frontend/src/types/config.ts` - Add types
- `frontend/src/api/config.ts` - Add function

**Types:**
```typescript
export interface TestWebhookRequest {
  webhook_url: string;
}

export interface TestWebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
}
```

**Function:**
```typescript
export async function testWebhook(
  webhookUrl: string
): Promise<TestWebhookResponse> {
  return api.post<TestWebhookResponse>('/api/v1/config/test-webhook', {
    webhook_url: webhookUrl,
  });
}
```

### Phase 3: Frontend - Settings Page Updates

**Goal:** Add Test button with loading state and feedback

#### Step 3.1: Add Test State and Handler

- [ ] Add `testing` state for loading indicator
- [ ] Add `testResult` state for success/error message
- [ ] Add `handleTestWebhook` function

**Files to modify:**
- `frontend/src/pages/Settings.tsx` - Add state and handler

**Code:**
```typescript
const [testing, setTesting] = useState(false);
const [testResult, setTestResult] = useState<{
  success: boolean;
  message: string;
} | null>(null);

const handleTestWebhook = async () => {
  if (!notifications.slack_webhook_url.trim()) return;

  setTesting(true);
  setTestResult(null);

  try {
    const response = await testWebhook(notifications.slack_webhook_url);
    setTestResult({
      success: response.success,
      message: response.success
        ? (response.message || 'Test message sent!')
        : (response.error || 'Test failed'),
    });
  } catch (err) {
    setTestResult({
      success: false,
      message: err instanceof Error ? err.message : 'Test failed',
    });
  } finally {
    setTesting(false);
  }
};
```

#### Step 3.2: Add Test Button to Webhook URL Row

- [ ] Add Test button next to webhook URL input
- [ ] Show button only when URL is non-empty
- [ ] Show loading spinner when testing

**Files to modify:**
- `frontend/src/pages/Settings.tsx` - Update webhook URL section

**Code (replace webhook URL div):**
```tsx
{/* Slack Webhook URL with Test button */}
<div>
  <label className="mb-2 block text-sm font-medium text-text-primary">
    Webhook URL
  </label>
  <div className="flex gap-2">
    <input
      type="url"
      value={notifications.slack_webhook_url}
      onChange={(e) =>
        setNotifications((prev) => ({
          ...prev,
          slack_webhook_url: e.target.value,
        }))
      }
      placeholder="https://hooks.slack.com/services/..."
      disabled={saving}
      className="flex-1 rounded-md border border-border-default bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary placeholder-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info"
      data-testid="slack-webhook-input"
    />
    {notifications.slack_webhook_url.trim() && (
      <button
        type="button"
        onClick={handleTestWebhook}
        disabled={testing || saving}
        className="rounded-md bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="test-webhook-button"
      >
        {testing ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
            <span>Testing...</span>
          </div>
        ) : (
          'Test'
        )}
      </button>
    )}
  </div>
  <p className="mt-1 text-sm text-text-tertiary">
    Leave empty to disable Slack notifications.
  </p>

  {/* Test result feedback */}
  {testResult && (
    <div
      className={`mt-2 rounded-md border p-2 text-sm ${
        testResult.success
          ? 'border-status-success/30 bg-status-success/10 text-status-success'
          : 'border-status-error/30 bg-status-error/10 text-status-error'
      }`}
      data-testid="test-result"
    >
      {testResult.message}
    </div>
  )}
</div>
```

### Phase 4: Testing & Validation

**Goal:** Verify all acceptance criteria are met

#### Step 4.1: Backend Tests

- [ ] Test successful webhook send (mock httpx)
- [ ] Test 404 error handling
- [ ] Test timeout handling
- [ ] Test connection error handling

**Files to create:**
- `tests/test_webhook.py` - New test file

**Test cases:**
```python
async def test_webhook_success(client, mocker):
    """Test successful webhook test."""
    mock_response = mocker.Mock()
    mock_response.status_code = 200

    mocker.patch('httpx.AsyncClient.post', return_value=mock_response)

    response = await client.post(
        '/api/v1/config/test-webhook',
        json={'webhook_url': 'https://hooks.slack.com/test'},
    )

    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True


async def test_webhook_invalid_url(client, mocker):
    """Test 404 response from Slack."""
    mock_response = mocker.Mock()
    mock_response.status_code = 404

    mocker.patch('httpx.AsyncClient.post', return_value=mock_response)

    response = await client.post(
        '/api/v1/config/test-webhook',
        json={'webhook_url': 'https://hooks.slack.com/invalid'},
    )

    data = response.json()
    assert data['success'] is False
    assert 'Invalid webhook URL' in data['error']


async def test_webhook_timeout(client, mocker):
    """Test timeout handling."""
    mocker.patch(
        'httpx.AsyncClient.post',
        side_effect=httpx.TimeoutException('timeout')
    )

    response = await client.post(
        '/api/v1/config/test-webhook',
        json={'webhook_url': 'https://hooks.slack.com/slow'},
    )

    data = response.json()
    assert data['success'] is False
    assert 'timed out' in data['error']
```

#### Step 4.2: Frontend Tests

- [ ] Test button visibility based on URL
- [ ] Test loading state during request
- [ ] Test success/error feedback display

**Files to modify:**
- `frontend/src/pages/Settings.test.tsx` - Add tests

#### Step 4.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Manual: Button visible when URL entered | Pending |
| AC2 | Manual: Button hidden when URL empty | Pending |
| AC3 | Manual: Test message received in Slack | Pending |
| AC4 | Manual: Success toast appears | Pending |
| AC5 | Manual: Error message with invalid URL | Pending |
| AC6 | Manual: Spinner shown during request | Pending |

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| Empty URL | Button hidden, no API call |
| Malformed URL | HTTP error from Slack (not validated client-side) |
| Slack returns 404 | Show "Invalid webhook URL" |
| Network timeout | Show "Connection timed out" |
| Rate limited (429) | Show "Too many requests, try again later" |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Slack changes API | Test messages fail | Use documented Block Kit format |
| Rate limiting | User can't test repeatedly | Clear error message, 10s timeout |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0043: System Settings Configuration | Story | Done - provides Settings page |
| httpx | Library | Already in dependencies |

## Open Questions

None - requirements are clear from story.

## Definition of Done Checklist

- [ ] All 6 acceptance criteria implemented
- [ ] Backend endpoint with error handling
- [ ] Frontend button with loading state
- [ ] Success/error feedback displayed
- [ ] Backend tests for endpoint
- [ ] No linting errors (ruff, eslint)
- [ ] Ready for code review

## Notes

**File Count:** ~5 files to modify
- Backend: 2 (schemas, routes)
- Frontend: 4 (client, types, api, Settings page)
- Tests: 1-2 new/modified

**Implementation Order:**
1. Backend schema + endpoint
2. Frontend API client + types
3. Settings page UI
4. Tests
