/**
 * API client for agent deployment endpoints.
 *
 * EP0007: Agent Management
 */

import { api } from './client';
import type {
  AgentVersionResponse,
  AgentInstallRequest,
  AgentInstallResponse,
  AgentUpgradeResponse,
  AgentRemoveRequest,
  AgentRemoveResponse,
  ServerActivateResponse,
} from '../types/agent';

/**
 * Get the current agent version available for deployment.
 *
 * @returns Agent version response
 */
export async function getAgentVersion(): Promise<AgentVersionResponse> {
  return api.get<AgentVersionResponse>('/api/v1/agents/version');
}

/**
 * Install agent on a remote device via SSH.
 *
 * @param request - Installation request with hostname and options
 * @returns Installation result
 */
export async function installAgent(
  request: AgentInstallRequest
): Promise<AgentInstallResponse> {
  return api.post<AgentInstallResponse>('/api/v1/agents/install', request);
}

/**
 * Upgrade agent on an existing server.
 *
 * @param serverId - Server identifier
 * @returns Upgrade result
 */
export async function upgradeAgent(serverId: string): Promise<AgentUpgradeResponse> {
  return api.post<AgentUpgradeResponse>(`/api/v1/agents/${serverId}/upgrade`, {});
}

/**
 * Remove agent from a server.
 *
 * @param serverId - Server identifier
 * @param request - Removal options
 * @returns Removal result
 */
export async function removeAgent(
  serverId: string,
  request: AgentRemoveRequest = {}
): Promise<AgentRemoveResponse> {
  return api.post<AgentRemoveResponse>(`/api/v1/agents/${serverId}/remove`, request);
}

/**
 * Re-activate an inactive server.
 *
 * @param serverId - Server identifier
 * @returns Activation result
 */
export async function activateServer(serverId: string): Promise<ServerActivateResponse> {
  return api.put<ServerActivateResponse>(`/api/v1/agents/${serverId}/activate`, {});
}
