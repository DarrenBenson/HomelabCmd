import { api } from './client';
import type {
  ExpectedService,
  ExpectedServiceCreate,
  ExpectedServiceUpdate,
  RestartActionResponse,
  ServiceDiscoveryRequest,
  ServiceDiscoveryResponse,
  ServicesResponse,
} from '../types/service';

/**
 * Fetch expected services for a server.
 * @param serverId - The server ID to fetch services for
 * @returns Promise resolving to ServicesResponse
 */
export function getServerServices(serverId: string): Promise<ServicesResponse> {
  return api.get<ServicesResponse>(`/api/v1/servers/${serverId}/services`);
}

/**
 * Queue a service restart action.
 * @param serverId - The server ID
 * @param serviceName - The service name to restart
 * @returns Promise resolving to RestartActionResponse
 */
export function restartService(
  serverId: string,
  serviceName: string
): Promise<RestartActionResponse> {
  return api.post<RestartActionResponse>(
    `/api/v1/servers/${serverId}/services/${serviceName}/restart`,
    {}
  );
}

// =============================================================================
// Service Discovery (US0069)
// =============================================================================

/**
 * Discover running systemd services on a remote host via SSH.
 * @param request - SSH connection details (hostname, port, username, key_id)
 * @returns Promise resolving to ServiceDiscoveryResponse with discovered services
 */
export function discoverServices(
  request: ServiceDiscoveryRequest
): Promise<ServiceDiscoveryResponse> {
  return api.post<ServiceDiscoveryResponse>('/api/v1/discovery/services', request);
}

// =============================================================================
// Expected Service Management
// =============================================================================

/**
 * Create an expected service for a server.
 * @param serverId - The server ID
 * @param data - Service creation data
 * @returns Promise resolving to created ExpectedService
 */
export function createExpectedService(
  serverId: string,
  data: ExpectedServiceCreate
): Promise<ExpectedService> {
  return api.post<ExpectedService>(`/api/v1/servers/${serverId}/services`, data);
}

/**
 * Update an expected service.
 * @param serverId - The server ID
 * @param serviceName - The service name to update
 * @param data - Service update data
 * @returns Promise resolving to updated ExpectedService
 */
export function updateExpectedService(
  serverId: string,
  serviceName: string,
  data: ExpectedServiceUpdate
): Promise<ExpectedService> {
  return api.put<ExpectedService>(
    `/api/v1/servers/${serverId}/services/${encodeURIComponent(serviceName)}`,
    data
  );
}

/**
 * Delete an expected service.
 * @param serverId - The server ID
 * @param serviceName - The service name to delete
 */
export function deleteExpectedService(
  serverId: string,
  serviceName: string
): Promise<void> {
  return api.delete(
    `/api/v1/servers/${serverId}/services/${encodeURIComponent(serviceName)}`
  );
}
