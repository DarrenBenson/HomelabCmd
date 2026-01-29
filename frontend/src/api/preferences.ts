import { api } from './client';
import type {
  CardOrderSaveResponse,
  CardOrderLoadResponse,
  SectionCardOrder,
  SectionCardOrderResponse,
  CollapsedSectionsResponse,
  DashboardPreferences,
  DashboardPreferencesSaveRequest,
  DashboardPreferencesSaveResponse,
} from '../types/preferences';

export async function saveCardOrder(order: string[]): Promise<CardOrderSaveResponse> {
  return api.put<CardOrderSaveResponse>('/api/v1/preferences/card-order', { order });
}

export async function getCardOrder(): Promise<CardOrderLoadResponse> {
  return api.get<CardOrderLoadResponse>('/api/v1/preferences/card-order');
}

// US0132: Section-specific API functions

export async function saveSectionOrder(
  order: SectionCardOrder
): Promise<CardOrderSaveResponse> {
  return api.put<CardOrderSaveResponse>('/api/v1/preferences/section-order', order);
}

export async function getSectionOrder(): Promise<SectionCardOrderResponse> {
  return api.get<SectionCardOrderResponse>('/api/v1/preferences/section-order');
}

export async function saveCollapsedSections(
  collapsed: string[]
): Promise<CardOrderSaveResponse> {
  return api.put<CardOrderSaveResponse>('/api/v1/preferences/collapsed-sections', {
    collapsed,
  });
}

export async function getCollapsedSections(): Promise<CollapsedSectionsResponse> {
  return api.get<CollapsedSectionsResponse>('/api/v1/preferences/collapsed-sections');
}

// US0136: Unified dashboard preferences API functions

export async function getDashboardPreferences(): Promise<DashboardPreferences> {
  return api.get<DashboardPreferences>('/api/v1/preferences/dashboard');
}

export async function saveDashboardPreferences(
  preferences: DashboardPreferencesSaveRequest
): Promise<DashboardPreferencesSaveResponse> {
  return api.put<DashboardPreferencesSaveResponse>(
    '/api/v1/preferences/dashboard',
    preferences
  );
}
