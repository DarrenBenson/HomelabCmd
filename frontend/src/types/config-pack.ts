/**
 * TypeScript types for configuration pack API.
 *
 * Part of EP0010: Configuration Management - US0121 Pack Assignment.
 */

export interface ConfigPackMetadata {
  name: string;
  display_name: string;
  description: string;
  item_count: number;
  extends: string | null;
  last_updated: string;
}

export interface ConfigPackListResponse {
  packs: ConfigPackMetadata[];
  total: number;
}
