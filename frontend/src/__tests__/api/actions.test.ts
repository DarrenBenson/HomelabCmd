/**
 * Tests for actions API client functions.
 *
 * Part of US0030: Actions management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getActions,
  approveAction,
  rejectAction,
  createAction,
  cancelAction,
  type GetActionsParams,
} from '../../api/actions';
import { ApiError } from '../../api/client';
import type { Action, ActionsResponse, CreateActionRequest } from '../../types/action';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockAction: Action = {
  id: 1,
  action_type: 'restart_service',
  status: 'pending',
  server_id: 'server-1',
  hostname: 'test-server',
  service_name: 'nginx.service',
  requires_approval: true,
  created_at: '2026-01-29T10:00:00Z',
  updated_at: '2026-01-29T10:00:00Z',
};

const mockActionsResponse: ActionsResponse = {
  actions: [mockAction],
  total: 1,
};

function createMockResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

function createMockErrorResponse(status: number, detail: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ detail }),
  } as Response;
}

describe('actions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getActions', () => {
    it('returns actions list without params', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockActionsResponse));

      const result = await getActions();

      expect(result).toEqual(mockActionsResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/actions', expect.any(Object));
    });

    it('applies status filter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockActionsResponse));
      const params: GetActionsParams = { status: 'pending' };

      await getActions(params);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/actions?status=pending',
        expect.any(Object)
      );
    });

    it('applies server_id filter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockActionsResponse));
      const params: GetActionsParams = { server_id: 'server-1' };

      await getActions(params);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/actions?server_id=server-1',
        expect.any(Object)
      );
    });

    it('applies limit and offset', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockActionsResponse));
      const params: GetActionsParams = { limit: 10, offset: 20 };

      await getActions(params);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=10');
      expect(calledUrl).toContain('offset=20');
    });

    it('combines multiple params', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockActionsResponse));
      const params: GetActionsParams = {
        status: 'approved',
        server_id: 'server-1',
        limit: 5,
      };

      await getActions(params);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=approved');
      expect(calledUrl).toContain('server_id=server-1');
      expect(calledUrl).toContain('limit=5');
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getActions()).rejects.toThrow('Network error');
    });
  });

  describe('approveAction', () => {
    it('approves action successfully', async () => {
      const approvedAction: Action = {
        ...mockAction,
        status: 'approved',
      };
      mockFetch.mockResolvedValue(createMockResponse(approvedAction));

      const result = await approveAction(1);

      expect(result.status).toBe('approved');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/actions/1/approve',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('throws ApiError on 404 not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Action not found'));

      await expect(approveAction(999)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 invalid status', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Action is not pending'));

      await expect(approveAction(1)).rejects.toThrow(ApiError);
    });
  });

  describe('rejectAction', () => {
    it('rejects action with reason', async () => {
      const rejectedAction: Action = {
        ...mockAction,
        status: 'rejected',
      };
      mockFetch.mockResolvedValue(createMockResponse(rejectedAction));

      const result = await rejectAction(1, 'Not needed');

      expect(result.status).toBe('rejected');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/actions/1/reject',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'Not needed' }),
        })
      );
    });

    it('throws ApiError on 404 not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Action not found'));

      await expect(rejectAction(999, 'reason')).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 invalid status', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Action is not pending'));

      await expect(rejectAction(1, 'reason')).rejects.toThrow(ApiError);
    });
  });

  describe('createAction', () => {
    it('creates action successfully', async () => {
      const createdAction: Action = {
        ...mockAction,
        id: 2,
      };
      mockFetch.mockResolvedValue(createMockResponse(createdAction));
      const request: CreateActionRequest = {
        action_type: 'restart_service',
        server_id: 'server-1',
        service_name: 'nginx.service',
      };

      const result = await createAction(request);

      expect(result.id).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/actions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });

    it('throws ApiError on 400 validation error', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Invalid action type'));
      const request: CreateActionRequest = {
        action_type: 'invalid',
        server_id: 'server-1',
      };

      await expect(createAction(request)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 404 server not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));
      const request: CreateActionRequest = {
        action_type: 'restart_service',
        server_id: 'nonexistent',
      };

      await expect(createAction(request)).rejects.toThrow(ApiError);
    });
  });

  describe('cancelAction', () => {
    it('cancels action successfully', async () => {
      const cancelledAction: Action = {
        ...mockAction,
        status: 'cancelled',
      };
      mockFetch.mockResolvedValue(createMockResponse(cancelledAction));

      const result = await cancelAction(1);

      expect(result.status).toBe('cancelled');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/actions/1/cancel',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('throws ApiError on 404 not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Action not found'));

      await expect(cancelAction(999)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 cannot cancel', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Cannot cancel completed action'));

      await expect(cancelAction(1)).rejects.toThrow(ApiError);
    });
  });
});
