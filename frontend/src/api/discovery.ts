/**
 * API client for network discovery endpoints.
 *
 * US0041: Network Discovery
 * US0069: Service Discovery During Agent Installation
 */

import { api } from './client';
import type {
  DiscoveryRequest,
  DiscoveryResponse,
  DiscoverySettings,
  DiscoverySettingsUpdate,
  ServiceDiscoveryRequest,
  ServiceDiscoveryResponse,
} from '../types/discovery';

// =============================================================================
// Service Discovery API (US0069)
// =============================================================================

/**
 * Discover running systemd services on a remote host via SSH.
 *
 * @param request - SSH connection details
 * @param includeSystem - Include system services (default: false)
 * @returns List of discovered services
 */
export async function discoverServices(
  request: ServiceDiscoveryRequest,
  includeSystem = false
): Promise<ServiceDiscoveryResponse> {
  const params = new URLSearchParams();
  if (includeSystem) {
    params.set('include_system', 'true');
  }
  const queryString = params.toString();
  const url = `/api/v1/discovery/services${queryString ? `?${queryString}` : ''}`;
  return api.post<ServiceDiscoveryResponse>(url, request);
}

// =============================================================================
// Network Discovery API (US0041)
// =============================================================================

/**
 * Start a new network discovery scan.
 * If a discovery is already running, returns the existing discovery.
 *
 * @param request - Optional request with subnet override
 * @returns Discovery response with ID and initial status
 */
export async function startDiscovery(request?: DiscoveryRequest): Promise<DiscoveryResponse> {
  return api.post<DiscoveryResponse>('/api/v1/discovery', request ?? {});
}

/**
 * Get discovery status and results by ID.
 *
 * @param discoveryId - The discovery ID to fetch
 * @returns Discovery response with progress or results
 */
export async function getDiscovery(discoveryId: number): Promise<DiscoveryResponse> {
  return api.get<DiscoveryResponse>(`/api/v1/discovery/${discoveryId}`);
}

/**
 * Get discovery settings including default subnet.
 *
 * @returns Discovery settings
 */
export async function getDiscoverySettings(): Promise<DiscoverySettings> {
  return api.get<DiscoverySettings>('/api/v1/settings/discovery');
}

/**
 * Update discovery settings.
 *
 * @param update - Settings to update
 * @returns Updated discovery settings
 */
export async function updateDiscoverySettings(
  update: DiscoverySettingsUpdate
): Promise<DiscoverySettings> {
  return api.put<DiscoverySettings>('/api/v1/settings/discovery', update);
}
