import { api } from './client';
import type {
  CostConfig,
  CostConfigUpdate,
  CostSummary,
  CostBreakdown,
} from '../types/cost';

/**
 * Get current cost configuration (electricity rate and currency).
 */
export async function getCostConfig(): Promise<CostConfig> {
  return api.get<CostConfig>('/api/v1/config/cost');
}

/**
 * Update cost configuration.
 */
export async function updateCostConfig(
  update: CostConfigUpdate
): Promise<CostConfig> {
  return api.put<CostConfig>('/api/v1/config/cost', update);
}

/**
 * Get cost summary (daily/monthly totals).
 */
export async function getCostSummary(): Promise<CostSummary> {
  return api.get<CostSummary>('/api/v1/costs/summary');
}

/**
 * Get cost breakdown per server.
 */
export async function getCostBreakdown(): Promise<CostBreakdown> {
  return api.get<CostBreakdown>('/api/v1/costs/breakdown');
}
