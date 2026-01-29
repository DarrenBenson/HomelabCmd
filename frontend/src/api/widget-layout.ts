/**
 * Widget layout API client for US0173: Widget Layout Persistence
 */

import { api } from './client';
import type {
  WidgetLayoutResponse,
  WidgetLayoutRequest,
  WidgetLayoutSaveResponse,
} from '../types/widget-layout';

/**
 * Get the saved widget layout for a machine.
 * Returns null layouts if no custom layout has been saved.
 */
export async function getWidgetLayout(machineId: string): Promise<WidgetLayoutResponse> {
  return api.get<WidgetLayoutResponse>(`/api/v1/machines/${machineId}/layout`);
}

/**
 * Save widget layout for a machine.
 */
export async function saveWidgetLayout(
  machineId: string,
  layouts: WidgetLayoutRequest
): Promise<WidgetLayoutSaveResponse> {
  return api.put<WidgetLayoutSaveResponse>(
    `/api/v1/machines/${machineId}/layout`,
    layouts
  );
}

/**
 * Reset widget layout to default for a machine.
 * Deletes the saved layout so the frontend falls back to default.
 */
export async function deleteWidgetLayout(machineId: string): Promise<void> {
  await api.delete(`/api/v1/machines/${machineId}/layout`);
}
