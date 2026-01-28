import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActions, approveAction, rejectAction } from './actions';
import { api } from './client';
import type { Action, ActionsResponse } from '../types/action';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockAction: Action = {
  id: 1,
  server_id: 'test-server',
  action_type: 'restart_service',
  status: 'pending',
  service_name: 'plex',
  command: 'systemctl restart plex',
  alert_id: null,
  created_at: '2026-01-19T10:00:00Z',
  created_by: 'dashboard',
  approved_at: null,
  approved_by: null,
  rejected_at: null,
  rejected_by: null,
  rejection_reason: null,
  executed_at: null,
  completed_at: null,
  exit_code: null,
  stdout: null,
  stderr: null,
};

/**
 * Actions API tests (US0030)
 * Spec Reference: sdlc-studio/stories/US0030-pending-actions-panel.md
 */
describe('Actions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActions', () => {
    it('calls /api/v1/actions endpoint without params', async () => {
      const mockResponse: ActionsResponse = { actions: [], total: 0, limit: 50, offset: 0 };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      await getActions();

      expect(api.get).toHaveBeenCalledWith('/api/v1/actions');
    });

    it('calls /api/v1/actions with status filter', async () => {
      const mockResponse: ActionsResponse = {
        actions: [mockAction],
        total: 1,
        limit: 50,
        offset: 0,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      await getActions({ status: 'pending' });

      expect(api.get).toHaveBeenCalledWith('/api/v1/actions?status=pending');
    });

    it('calls /api/v1/actions with multiple filters', async () => {
      const mockResponse: ActionsResponse = { actions: [], total: 0, limit: 10, offset: 0 };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      await getActions({ status: 'pending', server_id: 'test-server', limit: 10 });

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/actions?status=pending&server_id=test-server&limit=10'
      );
    });

    it('returns ActionsResponse shape', async () => {
      const mockResponse: ActionsResponse = {
        actions: [mockAction],
        total: 1,
        limit: 50,
        offset: 0,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await getActions({ status: 'pending' });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].id).toBe(1);
      expect(result.total).toBe(1);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('Network error');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getActions()).rejects.toThrow('Network error');
    });
  });

  describe('approveAction', () => {
    it('calls POST /api/v1/actions/{id}/approve', async () => {
      const approvedAction: Action = {
        ...mockAction,
        status: 'approved',
        approved_at: '2026-01-19T10:30:00Z',
        approved_by: 'dashboard',
      };
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(approvedAction);

      await approveAction(1);

      expect(api.post).toHaveBeenCalledWith('/api/v1/actions/1/approve', {});
    });

    it('returns Action with status approved', async () => {
      const approvedAction: Action = {
        ...mockAction,
        status: 'approved',
        approved_at: '2026-01-19T10:30:00Z',
        approved_by: 'dashboard',
      };
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(approvedAction);

      const result = await approveAction(1);

      expect(result.status).toBe('approved');
      expect(result.approved_at).toBe('2026-01-19T10:30:00Z');
      expect(result.approved_by).toBe('dashboard');
    });

    it('propagates errors from api.post', async () => {
      const error = new Error('404 Not Found');
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(approveAction(999)).rejects.toThrow('404 Not Found');
    });
  });

  describe('rejectAction', () => {
    it('calls POST /api/v1/actions/{id}/reject with reason', async () => {
      const rejectedAction: Action = {
        ...mockAction,
        status: 'rejected',
        rejected_at: '2026-01-19T10:30:00Z',
        rejected_by: 'dashboard',
        rejection_reason: 'Service recovered automatically',
      };
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(rejectedAction);

      await rejectAction(1, 'Service recovered automatically');

      expect(api.post).toHaveBeenCalledWith('/api/v1/actions/1/reject', {
        reason: 'Service recovered automatically',
      });
    });

    it('returns Action with status rejected', async () => {
      const rejectedAction: Action = {
        ...mockAction,
        status: 'rejected',
        rejected_at: '2026-01-19T10:30:00Z',
        rejected_by: 'dashboard',
        rejection_reason: 'Not needed',
      };
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(rejectedAction);

      const result = await rejectAction(1, 'Not needed');

      expect(result.status).toBe('rejected');
      expect(result.rejected_at).toBe('2026-01-19T10:30:00Z');
      expect(result.rejection_reason).toBe('Not needed');
    });

    it('propagates errors from api.post', async () => {
      const error = new Error('404 Not Found');
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(rejectAction(999, 'test')).rejects.toThrow('404 Not Found');
    });
  });
});
