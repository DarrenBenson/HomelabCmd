/**
 * TypeScript types for configuration pack application and removal.
 *
 * Part of EP0010: Configuration Management:
 * - US0119: Apply Configuration Pack
 * - US0123: Remove Configuration Pack
 */

// Request types

export interface ApplyRequest {
  pack_name: string;
  dry_run: boolean;
}

// Dry-run preview item types

export interface DryRunFileItem {
  action: 'create_file' | 'update_file';
  path: string;
  mode: string;
  description: string;
}

export interface DryRunPackageItem {
  action: 'install_package' | 'upgrade_package';
  package: string;
  version?: string | null;
  description: string;
}

export interface DryRunSettingItem {
  action: 'set_env_var' | 'set_config';
  key: string;
  value: string;
  description: string;
}

// Result item type

export interface ApplyItemResult {
  item: string;
  action: string;
  success: boolean;
  error?: string | null;
}

// Response types

export type ApplyStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ApplyPreviewResponse {
  server_id: string;
  pack_name: string;
  dry_run: true;
  files: readonly DryRunFileItem[];
  packages: readonly DryRunPackageItem[];
  settings: readonly DryRunSettingItem[];
  total_items: number;
}

export interface ApplyInitiatedResponse {
  apply_id: number;
  server_id: string;
  pack_name: string;
  status: ApplyStatus;
  started_at?: string | null;
}

export interface ApplyStatusResponse {
  apply_id: number;
  server_id: string;
  pack_name: string;
  status: ApplyStatus;
  progress: number;
  current_item?: string | null;
  items_total: number;
  items_completed: number;
  items_failed: number;
  items: readonly ApplyItemResult[];
  started_at?: string | null;
  completed_at?: string | null;
  error?: string | null;
}

// Type guard for preview response
export function isPreviewResponse(
  response: ApplyPreviewResponse | ApplyInitiatedResponse
): response is ApplyPreviewResponse {
  return 'dry_run' in response && response.dry_run === true;
}

// US0123: Remove Configuration Pack Types

// Request types

export interface RemoveRequest {
  pack_name: string;
  confirm: boolean;
}

// Remove preview item types

export interface RemovePreviewFileItem {
  action: 'delete';
  path: string;
  backup_path: string;
  note: string;
}

export interface RemovePreviewPackageItem {
  action: 'skip';
  package: string;
  note: string;
}

export interface RemovePreviewSettingItem {
  action: 'remove';
  key: string;
  note: string;
}

// Remove result item type

export interface RemoveItemResult {
  item: string;
  item_type: 'file' | 'package' | 'setting';
  action: 'deleted' | 'skipped' | 'removed' | 'failed';
  success: boolean;
  backup_path?: string | null;
  note?: string | null;
  error?: string | null;
}

// Remove response types

export interface RemovePreviewResponse {
  server_id: string;
  pack_name: string;
  preview: true;
  files: readonly RemovePreviewFileItem[];
  packages: readonly RemovePreviewPackageItem[];
  settings: readonly RemovePreviewSettingItem[];
  total_items: number;
  warning: string;
}

export interface RemoveResponse {
  server_id: string;
  pack_name: string;
  success: boolean;
  items: readonly RemoveItemResult[];
  items_deleted: number;
  items_skipped: number;
  items_removed: number;
  items_failed: number;
  removed_at: string;
}

// Type guard for remove preview response
export function isRemovePreviewResponse(
  response: RemovePreviewResponse | RemoveResponse
): response is RemovePreviewResponse {
  return 'preview' in response && response.preview === true;
}
