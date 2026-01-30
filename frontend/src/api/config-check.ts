/**
 * API client functions for configuration compliance checking.
 *
 * Part of EP0010: Configuration Management - US0118 Configuration Diff View.
 */

import { api } from './client';
import type {
  ConfigDiffResponse,
  ConfigCheckResponse,
  ConfigCheckRequest,
  ComplianceSummaryResponse,
} from '../types/config-check';

/**
 * Get configuration diff for a server.
 *
 * @param serverId - Server identifier
 * @param packName - Configuration pack name
 * @returns ConfigDiffResponse with summary and mismatches
 */
export async function getConfigDiff(
  serverId: string,
  packName: string
): Promise<ConfigDiffResponse> {
  return api.get<ConfigDiffResponse>(
    `/api/v1/servers/${serverId}/config/diff?pack=${encodeURIComponent(packName)}`
  );
}

/**
 * Trigger a new compliance check for a server.
 *
 * @param serverId - Server identifier
 * @param request - Configuration check request with pack name
 * @returns ConfigCheckResponse with check results
 */
export async function checkCompliance(
  serverId: string,
  request: ConfigCheckRequest
): Promise<ConfigCheckResponse> {
  return api.post<ConfigCheckResponse>(
    `/api/v1/servers/${serverId}/config/check`,
    request
  );
}

/**
 * Get fleet-wide compliance summary for dashboard widget.
 *
 * Part of EP0010: Configuration Management - US0120 Compliance Dashboard Widget.
 *
 * @returns ComplianceSummaryResponse with summary counts and per-machine status
 */
export async function getComplianceSummary(): Promise<ComplianceSummaryResponse> {
  return api.get<ComplianceSummaryResponse>('/api/v1/config/compliance');
}
