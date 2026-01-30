/**
 * API client functions for configuration pack application and removal.
 *
 * Part of EP0010: Configuration Management:
 * - US0119: Apply Configuration Pack
 * - US0123: Remove Configuration Pack
 */

import { api } from './client';
import type {
  ApplyPreviewResponse,
  ApplyInitiatedResponse,
  ApplyStatusResponse,
  RemovePreviewResponse,
  RemoveResponse,
} from '../types/config-apply';

/**
 * Get a dry-run preview of configuration changes to apply.
 *
 * @param serverId - Server identifier
 * @param packName - Configuration pack name
 * @returns ApplyPreviewResponse with grouped preview items
 */
export async function getApplyPreview(
  serverId: string,
  packName: string
): Promise<ApplyPreviewResponse> {
  return api.post<ApplyPreviewResponse>(
    `/api/v1/servers/${serverId}/config/apply`,
    { pack_name: packName, dry_run: true }
  );
}

/**
 * Start applying a configuration pack to a server.
 *
 * @param serverId - Server identifier
 * @param packName - Configuration pack name
 * @returns ApplyInitiatedResponse with apply_id for status polling
 */
export async function applyConfigPack(
  serverId: string,
  packName: string
): Promise<ApplyInitiatedResponse> {
  return api.post<ApplyInitiatedResponse>(
    `/api/v1/servers/${serverId}/config/apply`,
    { pack_name: packName, dry_run: false }
  );
}

/**
 * Get the status and progress of an apply operation.
 *
 * @param serverId - Server identifier
 * @param applyId - Apply operation ID
 * @returns ApplyStatusResponse with current status, progress, and results
 */
export async function getApplyStatus(
  serverId: string,
  applyId: number
): Promise<ApplyStatusResponse> {
  return api.get<ApplyStatusResponse>(
    `/api/v1/servers/${serverId}/config/apply/${applyId}`
  );
}

// US0123: Remove Configuration Pack API functions

/**
 * Get a preview of items to remove from a configuration pack.
 *
 * Part of US0123: AC5 - Confirmation Required.
 *
 * @param serverId - Server identifier
 * @param packName - Configuration pack name
 * @returns RemovePreviewResponse with items grouped by type
 */
export async function getRemovePreview(
  serverId: string,
  packName: string
): Promise<RemovePreviewResponse> {
  return api.delete<RemovePreviewResponse>(
    `/api/v1/servers/${serverId}/config/apply`,
    { data: { pack_name: packName, confirm: false } }
  );
}

/**
 * Remove a configuration pack from a server.
 *
 * Part of US0123: AC1 - Remove Endpoint.
 *
 * @param serverId - Server identifier
 * @param packName - Configuration pack name
 * @returns RemoveResponse with per-item results
 */
export async function removeConfigPack(
  serverId: string,
  packName: string
): Promise<RemoveResponse> {
  return api.delete<RemoveResponse>(
    `/api/v1/servers/${serverId}/config/apply`,
    { data: { pack_name: packName, confirm: true } }
  );
}
