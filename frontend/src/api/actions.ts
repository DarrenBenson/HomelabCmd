/**
 * Actions API client (US0030).
 */

import { api } from './client';
import type { Action, ActionsResponse, RejectActionRequest, CreateActionRequest } from '../types/action';

export interface GetActionsParams {
  status?: string;
  server_id?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get list of actions with optional filtering.
 */
export async function getActions(params?: GetActionsParams): Promise<ActionsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.server_id) searchParams.set('server_id', params.server_id);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const query = searchParams.toString();
  const url = query ? `/api/v1/actions?${query}` : '/api/v1/actions';
  return api.get<ActionsResponse>(url);
}

/**
 * Approve a pending action.
 */
export async function approveAction(actionId: number): Promise<Action> {
  return api.post<Action>(`/api/v1/actions/${actionId}/approve`, {});
}

/**
 * Reject a pending action with a reason.
 */
export async function rejectAction(actionId: number, reason: string): Promise<Action> {
  const body: RejectActionRequest = { reason };
  return api.post<Action>(`/api/v1/actions/${actionId}/reject`, body);
}

/**
 * Create a new action (US0052).
 */
export async function createAction(request: CreateActionRequest): Promise<Action> {
  return api.post<Action>('/api/v1/actions', request);
}

/**
 * Cancel a pending or approved action.
 */
export async function cancelAction(actionId: number): Promise<Action> {
  return api.post<Action>(`/api/v1/actions/${actionId}/cancel`, {});
}
