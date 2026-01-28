import { cn } from '../lib/utils';

interface FilterChipProps {
  /** Label to display on the chip */
  label: string;
  /** Whether this chip is currently selected */
  active: boolean;
  /** Click handler */
  onClick: () => void;
  /** Optional count badge */
  count?: number;
  /** Optional test ID for testing */
  testId?: string;
}

/**
 * US0112: Filter chip component for dashboard filters.
 *
 * A clickable chip that indicates filter selection state.
 * Supports keyboard navigation (Enter/Space to activate).
 */
export function FilterChip({
  label,
  active,
  onClick,
  count,
  testId,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'px-3 py-1 text-sm font-medium rounded-full transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-status-info focus:ring-offset-2 focus:ring-offset-bg-primary',
        active
          ? 'bg-status-info text-bg-primary'
          : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
      )}
      aria-pressed={active}
      data-testid={testId}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
            active
              ? 'bg-bg-primary/20 text-bg-primary'
              : 'bg-text-tertiary/20 text-text-tertiary',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
