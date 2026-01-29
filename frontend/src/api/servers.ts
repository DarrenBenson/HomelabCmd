import { api } from './client';
import type {
  ServersResponse,
  ServerDetail,
  MetricsHistoryResponse,
  TimeRange,
  PackagesResponse,
  ServerCredentialsResponse,
  SudoMode,
} from '../types/server';
import type { PowerConfigUpdate } from '../types/cost';

export async function getServers(): Promise<ServersResponse> {
  return api.get<ServersResponse>('/api/v1/servers');
}

export async function getServer(serverId: string): Promise<ServerDetail> {
  return api.get<ServerDetail>(`/api/v1/servers/${serverId}`);
}

export async function getMetricsHistory(
  serverId: string,
  range: TimeRange = '24h'
): Promise<MetricsHistoryResponse> {
  return api.get<MetricsHistoryResponse>(
    `/api/v1/servers/${serverId}/metrics?range=${range}`
  );
}

export async function pauseServer(serverId: string): Promise<ServerDetail> {
  return api.put<ServerDetail>(`/api/v1/servers/${serverId}/pause`, {});
}

export async function unpauseServer(serverId: string): Promise<ServerDetail> {
  return api.put<ServerDetail>(`/api/v1/servers/${serverId}/unpause`, {});
}

export async function getServerPackages(serverId: string): Promise<PackagesResponse> {
  return api.get<PackagesResponse>(`/api/v1/servers/${serverId}/packages`);
}

/**
 * Update server fields (power config, credential settings).
 */
export async function updateServer(
  serverId: string,
  update: PowerConfigUpdate | ServerUpdateRequest
): Promise<ServerDetail> {
  return api.put<ServerDetail>(`/api/v1/servers/${serverId}`, update);
}

// ===========================================================================
// Per-Server Credential API (US0088)
// ===========================================================================

export interface ServerUpdateRequest {
  ssh_username?: string | null;
  sudo_mode?: SudoMode;
  machine_type?: 'server' | 'workstation';
}

/**
 * Update server machine type (US0137: Cross-section drag-and-drop).
 * Changes a server between 'server' and 'workstation' types.
 */
export async function updateMachineType(
  serverId: string,
  machineType: 'server' | 'workstation'
): Promise<ServerDetail> {
  return api.put<ServerDetail>(`/api/v1/servers/${serverId}`, {
    machine_type: machineType,
  });
}

/**
 * Get credential status for a server.
 * Returns which credential types are configured and their scope (per-server vs global).
 * Never returns actual credential values.
 */
export async function getServerCredentials(
  serverId: string
): Promise<ServerCredentialsResponse> {
  return api.get<ServerCredentialsResponse>(
    `/api/v1/servers/${serverId}/credentials`
  );
}

/**
 * Store a per-server credential.
 * The value is encrypted before storage.
 */
export async function storeServerCredential(
  serverId: string,
  credentialType: string,
  value: string
): Promise<void> {
  await api.post(`/api/v1/servers/${serverId}/credentials`, {
    credential_type: credentialType,
    value,
  });
}

/**
 * Delete a per-server credential.
 * After deletion, the server falls back to global credential.
 */
export async function deleteServerCredential(
  serverId: string,
  credentialType: string
): Promise<void> {
  await api.delete(`/api/v1/servers/${serverId}/credentials/${credentialType}`);
}
