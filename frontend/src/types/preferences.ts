export interface CardOrderSaveResponse {
  status: string;
  timestamp: string;
}

export interface CardOrderLoadResponse {
  order: string[];
}

// US0132: Section-specific types

export interface SectionCardOrder {
  servers: string[];
  workstations: string[];
}

export interface SectionCardOrderResponse {
  servers: string[];
  workstations: string[];
}

export interface CollapsedSectionsResponse {
  collapsed: string[];
}

// US0136: Unified dashboard preferences types

export interface CardOrder {
  servers: string[];
  workstations: string[];
}

export interface DashboardPreferences {
  card_order: CardOrder;
  collapsed_sections: string[];
  view_mode: string;
  updated_at: string | null;
}

export interface DashboardPreferencesSaveRequest {
  card_order: CardOrder;
  collapsed_sections: string[];
  view_mode: string;
}

export interface DashboardPreferencesSaveResponse {
  status: string;
  updated_at: string;
}
