/**
 * Tailscale API client functions.
 *
 * Part of EP0008: Tailscale Integration (US0076, US0077, US0078).
 */

import { api } from './client';
import type {
  TailscaleDeviceListParams,
  TailscaleDeviceListResponse,
  TailscaleImportCheckResponse,
  TailscaleImportRequest,
  TailscaleImportResponse,
  TailscaleStatusResponse,
  TailscaleTestResponse,
  TailscaleTokenResponse,
} from '../types/tailscale';

/**
 * Get the current Tailscale configuration status.
 *
 * Returns whether a token is configured and a masked version if so.
 */
export async function getTailscaleStatus(): Promise<TailscaleStatusResponse> {
  return api.get<TailscaleStatusResponse>('/api/v1/settings/tailscale/status');
}

/**
 * Save a Tailscale API token.
 *
 * The token is encrypted and stored in the database.
 *
 * @param token - The Tailscale API token to save.
 */
export async function saveTailscaleToken(
  token: string
): Promise<TailscaleTokenResponse> {
  return api.post<TailscaleTokenResponse>('/api/v1/settings/tailscale/token', {
    token,
  });
}

/**
 * Remove the stored Tailscale API token.
 *
 * Note: Uses a custom fetch since the standard api.delete doesn't return a body.
 */
export async function removeTailscaleToken(): Promise<TailscaleTokenResponse> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';
  const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-change-me';

  const response = await fetch(
    `${API_BASE_URL}/api/v1/settings/tailscale/token`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
    }
  );

  if (!response.ok) {
    let message = `API error: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail?.message) {
        message = errorData.detail.message;
      } else if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      }
    } catch {
      // Ignore JSON parse errors, use default message
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Test connection to the Tailscale API using the stored token.
 *
 * Validates the token and returns tailnet information on success.
 */
export async function testTailscaleConnection(): Promise<TailscaleTestResponse> {
  return api.post<TailscaleTestResponse>('/api/v1/settings/tailscale/test', {});
}

// =============================================================================
// Device Discovery Functions (US0077)
// =============================================================================

/**
 * Get list of Tailscale devices.
 *
 * Part of US0077: Tailscale Device Discovery.
 * EP0016: Added test_ssh parameter for SSH status testing.
 *
 * @param params - Optional filter parameters
 * @param params.online - Filter by online status (true/false)
 * @param params.os - Filter by OS type (linux, windows, macos, ios, android)
 * @param params.refresh - Bypass cache and fetch fresh data
 * @param params.test_ssh - Test SSH connectivity for online devices
 */
export async function getTailscaleDevices(
  params?: TailscaleDeviceListParams & { test_ssh?: boolean }
): Promise<TailscaleDeviceListResponse> {
  const searchParams = new URLSearchParams();

  if (params?.online !== undefined) {
    searchParams.append('online', String(params.online));
  }
  if (params?.os) {
    searchParams.append('os', params.os);
  }
  if (params?.refresh) {
    searchParams.append('refresh', 'true');
  }

  // Use the with-ssh endpoint if test_ssh is requested
  if (params?.test_ssh) {
    searchParams.append('test_ssh', 'true');
    const queryString = searchParams.toString();
    const url = `/api/v1/tailscale/devices/with-ssh${queryString ? `?${queryString}` : ''}`;
    return api.get<TailscaleDeviceListResponse>(url);
  }

  const queryString = searchParams.toString();
  const url = `/api/v1/tailscale/devices${queryString ? `?${queryString}` : ''}`;

  return api.get<TailscaleDeviceListResponse>(url);
}

// =============================================================================
// Device Import Functions (US0078)
// =============================================================================

/**
 * Import a Tailscale device as a monitored server.
 *
 * Part of US0078: Machine Registration via Tailscale.
 *
 * @param request - Import request with device details
 * @returns Import response with created machine details
 */
export async function importTailscaleDevice(
  request: TailscaleImportRequest
): Promise<TailscaleImportResponse> {
  return api.post<TailscaleImportResponse>('/api/v1/tailscale/import', request);
}

/**
 * Check if a Tailscale device has already been imported.
 *
 * Part of US0078: Machine Registration via Tailscale.
 *
 * @param hostname - Tailscale hostname to check
 * @returns Check response indicating if device is imported
 */
export async function checkTailscaleImport(
  hostname: string
): Promise<TailscaleImportCheckResponse> {
  const encodedHostname = encodeURIComponent(hostname);
  return api.get<TailscaleImportCheckResponse>(
    `/api/v1/tailscale/import/check?hostname=${encodedHostname}`
  );
}
