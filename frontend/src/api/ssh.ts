/**
 * SSH API client functions.
 *
 * US0093: Unified SSH Key Management - cleaned up deprecated endpoints.
 * Key management now handled via api/scans.ts (SSHKeyManager).
 */

import { api } from './client';
import type { SSHTestResponse } from '../types/ssh';

/**
 * Test SSH connection to a server via Tailscale hostname.
 *
 * AC5: Connection health check endpoint.
 *
 * @param serverId - The server ID to test connection to
 * @returns Test result with success status, latency, and host key info
 */
export async function testSSHConnection(serverId: string): Promise<SSHTestResponse> {
  return api.post<SSHTestResponse>(`/api/v1/servers/${serverId}/test-ssh`, {});
}
