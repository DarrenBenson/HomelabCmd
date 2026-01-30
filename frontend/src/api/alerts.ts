import { api } from './client';
import type {
  Alert,
  AlertsResponse,
  AlertAcknowledgeResponse,
  AlertResolveResponse,
  AlertFilters,
  PendingBreachesResponse,
} from '../types/alert';

export async function getAlerts(filters?: AlertFilters): Promise<AlertsResponse> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    if (filters.severity && filters.severity !== 'all') {
      params.set('severity', filters.severity);
    }
    if (filters.server_id) {
      params.set('server_id', filters.server_id);
    }
    if (filters.limit !== undefined) {
      params.set('limit', filters.limit.toString());
    }
    if (filters.offset !== undefined) {
      params.set('offset', filters.offset.toString());
    }
  }

  const queryString = params.toString();
  const url = queryString ? `/api/v1/alerts?${queryString}` : '/api/v1/alerts';
  return api.get<AlertsResponse>(url);
}

export async function getAlert(alertId: number): Promise<Alert> {
  return api.get<Alert>(`/api/v1/alerts/${alertId}`);
}

export async function acknowledgeAlert(alertId: number): Promise<AlertAcknowledgeResponse> {
  return api.post<AlertAcknowledgeResponse>(`/api/v1/alerts/${alertId}/acknowledge`, {});
}

export async function resolveAlert(alertId: number): Promise<AlertResolveResponse> {
  return api.post<AlertResolveResponse>(`/api/v1/alerts/${alertId}/resolve`, {});
}

/**
 * Get pending breaches (conditions breached but sustained duration not yet met).
 */
export async function getPendingBreaches(): Promise<PendingBreachesResponse> {
  return api.get<PendingBreachesResponse>('/api/v1/alerts/pending');
}
