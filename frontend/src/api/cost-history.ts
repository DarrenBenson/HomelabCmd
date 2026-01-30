/**
 * API client for historical cost tracking (US0183).
 *
 * EP0005: Cost Tracking - Historical Cost Tracking
 */

import { fetchApi } from './client';
import type {
  AggregationType,
  CostHistoryPeriod,
  CostHistoryResponse,
  MonthlySummaryResponse,
  ServerCostHistoryResponse,
} from '../types/cost-history';

/**
 * Get historical cost data with optional filtering and aggregation.
 *
 * AC2: Historical cost API with date range, server filter, and aggregation.
 */
export async function getCostHistory(params: {
  startDate: string;
  endDate: string;
  serverId?: string;
  aggregation?: AggregationType;
}): Promise<CostHistoryResponse> {
  const searchParams = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });

  if (params.serverId) {
    searchParams.set('server_id', params.serverId);
  }

  if (params.aggregation) {
    searchParams.set('aggregation', params.aggregation);
  }

  return fetchApi<CostHistoryResponse>(`/costs/history?${searchParams.toString()}`);
}

/**
 * Get monthly cost summary with year-to-date totals.
 *
 * AC5: Monthly cost summary with month-over-month change and YTD.
 */
export async function getMonthlySummary(year?: number): Promise<MonthlySummaryResponse> {
  const searchParams = new URLSearchParams();

  if (year !== undefined) {
    searchParams.set('year', year.toString());
  }

  const queryString = searchParams.toString();
  const url = queryString ? `/costs/summary/monthly?${queryString}` : '/costs/summary/monthly';

  return fetchApi<MonthlySummaryResponse>(url);
}

/**
 * Get cost history for a specific server.
 *
 * AC4: Per-server cost history.
 */
export async function getServerCostHistory(
  serverId: string,
  period: CostHistoryPeriod = '30d'
): Promise<ServerCostHistoryResponse> {
  return fetchApi<ServerCostHistoryResponse>(
    `/servers/${serverId}/costs/history?period=${period}`
  );
}
