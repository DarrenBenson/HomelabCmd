/**
 * API client functions for configuration pack management.
 *
 * Part of EP0010: Configuration Management - US0121 Pack Assignment.
 */

import { api } from './client';
import type { ConfigPackListResponse } from '../types/config-pack';

/**
 * Get list of available configuration packs.
 *
 * @returns ConfigPackListResponse with pack metadata
 */
export async function getConfigPacks(): Promise<ConfigPackListResponse> {
  return api.get<ConfigPackListResponse>('/api/v1/config/packs');
}
