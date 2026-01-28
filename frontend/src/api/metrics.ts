/**
 * Metrics API client.
 *
 * US0113: Sparkline data fetching for inline metric charts.
 */

import { api } from './client';

/**
 * A single data point for sparkline display.
 */
export interface SparklinePoint {
  timestamp: string;
  value: number | null;
}

/**
 * Response from the sparkline endpoint.
 */
export interface SparklineResponse {
  server_id: string;
  metric: string;
  period: string;
  data: SparklinePoint[];
}

/**
 * Supported metric types for sparklines.
 */
export type SparklineMetric = 'cpu_percent' | 'memory_percent' | 'disk_percent';

/**
 * Supported time periods for sparklines.
 */
export type SparklinePeriod = '30m' | '1h' | '6h';

/**
 * Fetch sparkline data for a server metric.
 *
 * @param serverId - Server identifier
 * @param metric - Metric type (default: cpu_percent)
 * @param period - Time period (default: 30m)
 * @returns Promise resolving to sparkline data
 */
export async function getSparklineData(
  serverId: string,
  metric: SparklineMetric = 'cpu_percent',
  period: SparklinePeriod = '30m'
): Promise<SparklineResponse> {
  return api.get<SparklineResponse>(
    `/api/v1/servers/${serverId}/metrics/sparkline?metric=${metric}&period=${period}`
  );
}
