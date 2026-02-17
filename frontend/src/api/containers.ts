/**
 * Container API client (US0159, US0160, US0161 - EP0014).
 */

import { api } from './client';
import type { ContainerActionResponse, ContainerListResponse } from '../types/container';

/**
 * List Docker containers on a server.
 *
 * @param serverId - Server identifier
 * @param refresh - Force refresh, bypassing cache
 * @returns Container list response
 */
export async function getContainers(
  serverId: string,
  refresh = false
): Promise<ContainerListResponse> {
  const params = new URLSearchParams();
  if (refresh) {
    params.set('refresh', 'true');
  }
  const query = params.toString();
  const url = `/api/v1/servers/${serverId}/containers${query ? `?${query}` : ''}`;
  return api.get<ContainerListResponse>(url);
}

/**
 * Start a stopped Docker container (US0160).
 *
 * @param serverId - Server identifier
 * @param containerId - Container ID or name to start
 * @returns Container action response
 */
export async function startContainer(
  serverId: string,
  containerId: string
): Promise<ContainerActionResponse> {
  return api.post<ContainerActionResponse>(
    `/api/v1/servers/${serverId}/containers/${containerId}/start`
  );
}

/**
 * Stop a running Docker container (US0161).
 *
 * @param serverId - Server identifier
 * @param containerId - Container ID or name to stop
 * @param timeout - Graceful shutdown timeout in seconds (default 10)
 * @returns Container action response
 */
export async function stopContainer(
  serverId: string,
  containerId: string,
  timeout = 10
): Promise<ContainerActionResponse> {
  const params = new URLSearchParams();
  if (timeout !== 10) {
    params.set('timeout', String(timeout));
  }
  const query = params.toString();
  return api.post<ContainerActionResponse>(
    `/api/v1/servers/${serverId}/containers/${containerId}/stop${query ? `?${query}` : ''}`
  );
}

/**
 * Restart a Docker container (US0162).
 *
 * @param serverId - Server identifier
 * @param containerId - Container ID or name to restart
 * @returns Container action response
 */
export async function restartContainer(
  serverId: string,
  containerId: string
): Promise<ContainerActionResponse> {
  return api.post<ContainerActionResponse>(
    `/api/v1/servers/${serverId}/containers/${containerId}/restart`
  );
}
