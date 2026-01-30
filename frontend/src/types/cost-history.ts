/**
 * Types for historical cost tracking (US0183).
 *
 * EP0005: Cost Tracking - Historical Cost Tracking
 */

/** Single cost history record */
export interface CostHistoryItem {
  /** ISO date string or period label (e.g., '2026-01', 'W01') */
  date: string;
  /** Estimated kWh consumed */
  estimated_kwh: number;
  /** Estimated cost in configured currency */
  estimated_cost: number;
  /** Electricity rate per kWh */
  electricity_rate: number;
  /** Server ID (if filtered) */
  server_id?: string;
  /** Server hostname (if available) */
  server_hostname?: string;
}

/** Aggregation level for cost history queries */
export type AggregationType = 'daily' | 'weekly' | 'monthly';

/** Response from GET /costs/history */
export interface CostHistoryResponse {
  /** Cost history records */
  items: CostHistoryItem[];
  /** Aggregation level used */
  aggregation: AggregationType;
  /** Start of date range */
  start_date: string;
  /** End of date range */
  end_date: string;
  /** Currency symbol */
  currency_symbol: string;
}

/** Monthly cost summary record */
export interface MonthlySummaryItem {
  /** Year-month string 'YYYY-MM' */
  year_month: string;
  /** Total cost for the month */
  total_cost: number;
  /** Total kWh for the month */
  total_kwh: number;
  /** Previous month's cost (null for first month) */
  previous_month_cost: number | null;
  /** Month-over-month change percentage */
  change_percent: number | null;
}

/** Response from GET /costs/summary/monthly */
export interface MonthlySummaryResponse {
  /** Monthly cost summaries */
  months: MonthlySummaryItem[];
  /** Year of the summary */
  year: number;
  /** Year-to-date total cost */
  year_to_date_cost: number;
  /** Currency symbol */
  currency_symbol: string;
}

/** Period options for server cost history */
export type CostHistoryPeriod = '7d' | '30d' | '90d' | '12m';

/** Response from GET /servers/{id}/costs/history */
export interface ServerCostHistoryResponse {
  /** Server identifier */
  server_id: string;
  /** Server hostname */
  hostname: string;
  /** Period used for the query */
  period: CostHistoryPeriod;
  /** Cost history records */
  items: CostHistoryItem[];
  /** Currency symbol */
  currency_symbol: string;
}
