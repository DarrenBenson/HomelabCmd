/**
 * API client for scan endpoints.
 *
 * US0039: Scan Results Display
 * US0040: Scan History View
 */

import { api } from './client';
import type {
  ScanStatusResponse,
  ScanListResponse,
  ScanListFilters,
  SSHConfig,
  SSHConfigUpdate,
  SSHConfigResponse,
  SSHKeyMetadata,
  SSHKeyListResponse,
  SSHKeyUploadRequest,
  SetDefaultKeyResponse,
} from '../types/scan';

/**
 * Get scan status and results by ID.
 * @param scanId - The scan ID to fetch
 * @returns Scan status response with results if completed
 */
export async function getScan(scanId: number): Promise<ScanStatusResponse> {
  return api.get<ScanStatusResponse>(`/api/v1/scans/${scanId}`);
}

/**
 * List scans with optional filtering.
 * US0040: Scan History View
 *
 * @param filters - Optional filters for hostname, status, scan_type, pagination
 * @returns Paginated list of scans
 */
export async function getScans(filters?: ScanListFilters): Promise<ScanListResponse> {
  const params = new URLSearchParams();

  if (filters?.hostname) {
    params.append('hostname', filters.hostname);
  }
  if (filters?.status) {
    params.append('scan_status', filters.status);
  }
  if (filters?.scan_type) {
    params.append('scan_type', filters.scan_type);
  }
  if (filters?.limit !== undefined) {
    params.append('limit', filters.limit.toString());
  }
  if (filters?.offset !== undefined) {
    params.append('offset', filters.offset.toString());
  }

  const queryString = params.toString();
  const url = queryString ? `/api/v1/scans?${queryString}` : '/api/v1/scans';

  return api.get<ScanListResponse>(url);
}

/**
 * Delete a scan by ID.
 * US0040: Scan History View
 *
 * @param scanId - The scan ID to delete
 */
export async function deleteScan(scanId: number): Promise<void> {
  await api.delete(`/api/v1/scans/${scanId}`);
}

/**
 * Get SSH configuration for ad-hoc scanning.
 * US0037: SSH Key Configuration
 *
 * @returns SSH configuration including key path and defaults
 */
export async function getSSHConfig(): Promise<SSHConfig> {
  return api.get<SSHConfig>('/api/v1/settings/ssh');
}

/**
 * Update SSH configuration.
 * US0037: SSH Key Configuration
 *
 * @param update - Settings to update
 * @returns Response with updated fields and current config
 */
export async function updateSSHConfig(update: SSHConfigUpdate): Promise<SSHConfigResponse> {
  return api.put<SSHConfigResponse>('/api/v1/settings/ssh', update);
}

// =============================================================================
// US0071: SSH Key Manager UI
// =============================================================================

/**
 * List all SSH keys with metadata.
 * US0071: SSH Key Manager UI - AC1
 *
 * @returns List of SSH key metadata (never includes private key content)
 */
export async function listSSHKeys(): Promise<SSHKeyListResponse> {
  return api.get<SSHKeyListResponse>('/api/v1/settings/ssh/keys');
}

/**
 * Upload a new SSH key.
 * US0071: SSH Key Manager UI - AC2
 *
 * @param request - Key name and private key content
 * @returns Metadata for the uploaded key
 */
export async function uploadSSHKey(request: SSHKeyUploadRequest): Promise<SSHKeyMetadata> {
  return api.post<SSHKeyMetadata>('/api/v1/settings/ssh/keys', request);
}

/**
 * Delete an SSH key.
 * US0071: SSH Key Manager UI - AC3
 *
 * @param keyId - The key ID (filename) to delete
 */
export async function deleteSSHKey(keyId: string): Promise<void> {
  await api.delete(`/api/v1/settings/ssh/keys/${encodeURIComponent(keyId)}`);
}

/**
 * Set a key as the default SSH key.
 * US0093: Unified SSH Key Management - AC5
 *
 * @param keyId - The key ID to set as default
 * @returns Response with success status and message
 */
export async function setDefaultKey(keyId: string): Promise<SetDefaultKeyResponse> {
  return api.put<SetDefaultKeyResponse>(
    `/api/v1/settings/ssh/keys/${encodeURIComponent(keyId)}/default`,
    {}
  );
}
