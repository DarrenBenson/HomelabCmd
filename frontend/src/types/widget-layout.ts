/**
 * Widget layout types for US0173: Widget Layout Persistence
 */

import type { LayoutItem } from 'react-grid-layout';

/**
 * Layout configuration for all responsive breakpoints.
 */
export interface WidgetLayouts {
  lg: LayoutItem[];
  md: LayoutItem[];
  sm: LayoutItem[];
  xs: LayoutItem[];
}

/**
 * Response from GET /api/v1/machines/{id}/layout
 */
export interface WidgetLayoutResponse {
  layouts: WidgetLayouts | null;
  updated_at: string | null;
}

/**
 * Request body for PUT /api/v1/machines/{id}/layout
 */
export interface WidgetLayoutRequest {
  layouts: WidgetLayouts;
}

/**
 * Response from PUT /api/v1/machines/{id}/layout
 */
export interface WidgetLayoutSaveResponse {
  status: string;
  updated_at: string;
}

/**
 * Response from DELETE /api/v1/machines/{id}/layout
 */
export interface WidgetLayoutDeleteResponse {
  status: string;
}
