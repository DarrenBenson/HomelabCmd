/**
 * Connectivity settings API client for US0080.
 */

import { api } from './client';
import type {
  ConnectivityStatusResponse,
  ConnectivityUpdateRequest,
  ConnectivityUpdateResponse,
  ConnectivityStatusBarResponse,
} from '../types/connectivity';

/**
 * Get full connectivity configuration status.
 *
 * @returns Connectivity status with mode, tailscale info, and SSH config.
 */
export async function getConnectivityStatus(): Promise<ConnectivityStatusResponse> {
  return api.get<ConnectivityStatusResponse>('/api/v1/settings/connectivity');
}

/**
 * Update connectivity mode and settings.
 *
 * @param request - Mode and optional SSH username to set.
 * @returns Update result with success status.
 */
export async function updateConnectivityMode(
  request: ConnectivityUpdateRequest
): Promise<ConnectivityUpdateResponse> {
  return api.put<ConnectivityUpdateResponse>(
    '/api/v1/settings/connectivity',
    request
  );
}

/**
 * Get minimal status for dashboard status bar.
 *
 * @returns Status bar info with mode, display text, and health.
 */
export async function getConnectivityStatusBar(): Promise<ConnectivityStatusBarResponse> {
  return api.get<ConnectivityStatusBarResponse>(
    '/api/v1/settings/connectivity/status'
  );
}
