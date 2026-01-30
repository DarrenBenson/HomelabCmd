export type AlertStatus = 'open' | 'acknowledged' | 'resolved';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Alert {
  id: number;
  server_id: string;
  server_name: string | null;
  alert_type: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string | null;
  threshold_value: number | null;
  actual_value: number | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  auto_resolved: boolean;
  can_acknowledge: boolean;
  can_resolve: boolean;
  service_name: string | null;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  limit: number;
  offset: number;
}

export interface AlertAcknowledgeResponse {
  id: number;
  status: AlertStatus;
  acknowledged_at: string;
}

export interface AlertResolveResponse {
  id: number;
  status: AlertStatus;
  resolved_at: string;
  auto_resolved: boolean;
}

export interface AlertFilters {
  status?: AlertStatus | 'all';
  severity?: AlertSeverity | 'all';
  server_id?: string;
  limit?: number;
  offset?: number;
}

/**
 * A pending breach - condition breached but sustained duration not yet met.
 */
export interface PendingBreach {
  server_id: string;
  server_name: string | null;
  metric_type: string;
  current_value: number | null;
  threshold_value: number;
  severity: AlertSeverity;
  first_breach_at: string;
  sustained_seconds: number;
  elapsed_seconds: number;
  time_until_alert: number;
}

export interface PendingBreachesResponse {
  pending: PendingBreach[];
  total: number;
}
