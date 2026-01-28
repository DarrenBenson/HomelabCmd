/**
 * Discovery Filters component.
 *
 * EP0016: Unified Discovery Experience (US0098)
 *
 * Shared filter controls for Status, OS, and SSH Key selection.
 */

import { Key } from 'lucide-react';
import type { SSHKeyMetadata } from '../types/scan';

type StatusFilter = 'all' | 'available' | 'unavailable';
type OsFilter = 'all' | 'linux' | 'windows' | 'macos' | 'other';

interface DiscoveryFiltersProps {
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  osFilter: OsFilter;
  onOsFilterChange: (filter: OsFilter) => void;
  selectedKeyId: string;
  onKeyIdChange: (keyId: string) => void;
  sshKeys: SSHKeyMetadata[];
  sshKeysLoading: boolean;
  showKeySelector: boolean;
  totalCount: number;
  filteredCount: number;
  availableCount: number;
}

export function DiscoveryFilters({
  statusFilter,
  onStatusFilterChange,
  osFilter,
  onOsFilterChange,
  selectedKeyId,
  onKeyIdChange,
  sshKeys,
  sshKeysLoading,
  showKeySelector,
  totalCount,
  filteredCount,
  availableCount,
}: DiscoveryFiltersProps) {
  const isFiltered = statusFilter !== 'all' || osFilter !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border-default bg-bg-secondary px-4 py-3">
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm text-text-secondary">
          Status:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          className="rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info"
        >
          <option value="all">All</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {/* OS filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="os-filter" className="text-sm text-text-secondary">
          OS:
        </label>
        <select
          id="os-filter"
          value={osFilter}
          onChange={(e) => onOsFilterChange(e.target.value as OsFilter)}
          className="rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info"
        >
          <option value="all">Any OS</option>
          <option value="linux">Linux</option>
          <option value="windows">Windows</option>
          <option value="macos">macOS</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* SSH Key selector (network tab only) */}
      {showKeySelector && (
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-text-tertiary" />
          <select
            value={selectedKeyId}
            onChange={(e) => onKeyIdChange(e.target.value)}
            disabled={sshKeysLoading || sshKeys.length === 0}
            className="rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info disabled:opacity-50"
            aria-label="SSH Key"
          >
            <option value="">Attempt all keys</option>
            {sshKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.name}
                {key.username ? ` (${key.username})` : ' (Default)'}
              </option>
            ))}
          </select>
          {sshKeys.length === 0 && !sshKeysLoading && (
            <span className="text-xs text-text-tertiary">No keys configured</span>
          )}
        </div>
      )}

      {/* Device count */}
      <div className="ml-auto text-sm text-text-secondary">
        {isFiltered ? (
          <span>
            Showing {filteredCount} of {totalCount} device{totalCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <span>
            {totalCount} device{totalCount !== 1 ? 's' : ''} found
            {availableCount > 0 && (
              <span className="text-status-success"> ({availableCount} available)</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
