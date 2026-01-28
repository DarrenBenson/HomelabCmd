import { Search, X } from 'lucide-react';
import { FilterChip } from './FilterChip';

export type StatusFilter = 'all' | 'online' | 'offline' | 'warning' | 'paused';
export type TypeFilter = 'all' | 'server' | 'workstation';

interface DashboardFiltersProps {
  /** Current search query */
  searchQuery: string;
  /** Search query change handler */
  onSearchChange: (query: string) => void;
  /** Current status filter */
  statusFilter: StatusFilter;
  /** Status filter change handler */
  onStatusChange: (status: StatusFilter) => void;
  /** Current machine type filter */
  typeFilter: TypeFilter;
  /** Type filter change handler */
  onTypeChange: (type: TypeFilter) => void;
  /** Clear all filters handler */
  onClear: () => void;
  /** Whether any filters are active */
  hasActiveFilters: boolean;
}

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'warning', label: 'Warning' },
  { value: 'paused', label: 'Paused' },
];

const typeFilters: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'server', label: 'Servers' },
  { value: 'workstation', label: 'Workstations' },
];

/**
 * US0112: Dashboard filter controls.
 *
 * Provides search box and filter chips for filtering the server list.
 * Supports keyboard navigation (Escape to clear search).
 */
export function DashboardFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  onClear,
  hasActiveFilters,
}: DashboardFiltersProps) {
  return (
    <div className="space-y-3" data-testid="dashboard-filters">
      {/* Search box */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Search servers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onSearchChange('');
            }
          }}
          className="w-full pl-10 pr-10 py-2 bg-bg-secondary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-status-info focus:border-transparent"
          data-testid="search-input"
          aria-label="Search servers"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-text-tertiary hover:text-text-primary rounded"
            aria-label="Clear search"
            data-testid="clear-search-button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filters */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {statusFilters.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              active={statusFilter === filter.value}
              onClick={() => onStatusChange(filter.value)}
              testId={`status-filter-${filter.value}`}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border-default" aria-hidden="true" />

        {/* Type filters */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
          {typeFilters.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              active={typeFilter === filter.value}
              onClick={() => onTypeChange(filter.value)}
              testId={`type-filter-${filter.value}`}
            />
          ))}
        </div>

        {/* Clear button */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-6 bg-border-default" aria-hidden="true" />
            <button
              type="button"
              onClick={onClear}
              className="px-3 py-1 text-sm font-medium text-text-tertiary hover:text-text-primary transition-colors"
              data-testid="clear-filters-button"
            >
              Clear filters
            </button>
          </>
        )}
      </div>
    </div>
  );
}
