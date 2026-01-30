/**
 * TypeScript types for configuration compliance checking.
 *
 * Part of EP0010: Configuration Management - US0118 Configuration Diff View.
 */

export type MismatchType =
  | 'missing_file'
  | 'wrong_permissions'
  | 'wrong_content'
  | 'missing_package'
  | 'wrong_version'
  | 'wrong_setting';

export type MismatchCategory = 'files' | 'packages' | 'settings';

export interface MismatchExpected {
  exists?: boolean;
  mode?: string;
  hash?: string;
  installed?: boolean;
  min_version?: string;
  value?: string;
}

export interface MismatchActual {
  exists?: boolean;
  mode?: string;
  hash?: string;
  installed?: boolean;
  version?: string;
  value?: string;
}

export interface DiffMismatchItem {
  type: MismatchType;
  category: MismatchCategory;
  item: string;
  expected: MismatchExpected;
  actual: MismatchActual;
  diff?: string | null;
}

export interface DiffSummary {
  total_items: number;
  compliant: number;
  mismatched: number;
}

export interface ConfigDiffResponse {
  server_id: string;
  pack_name: string;
  is_compliant: boolean;
  summary: DiffSummary;
  mismatches: readonly DiffMismatchItem[];
  checked_at: string;
}

export interface ConfigCheckRequest {
  pack_name: string;
}

export interface ConfigCheckResponse {
  server_id: string;
  pack_name: string;
  is_compliant: boolean;
  mismatches: readonly DiffMismatchItem[];
  checked_at: string;
  check_duration_ms: number;
}

// US0120: Compliance Dashboard Widget types

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'never_checked';

export interface ComplianceMachineSummary {
  id: string;
  display_name: string;
  status: ComplianceStatus;
  pack: string | null;
  mismatch_count: number | null;
  checked_at: string | null;
}

export interface ComplianceSummaryStats {
  compliant: number;
  non_compliant: number;
  never_checked: number;
  total: number;
}

export interface ComplianceSummaryResponse {
  summary: ComplianceSummaryStats;
  machines: readonly ComplianceMachineSummary[];
}
