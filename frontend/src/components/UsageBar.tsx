/**
 * UsageBar - A progress bar component with threshold-based colouring.
 *
 * Colour thresholds (following brand guide):
 * - Green (#4ADE80): < 80%
 * - Amber (#FBBF24): 80-90%
 * - Red (#F87171): > 90%
 *
 * US0039: Scan Results Display
 */

import { cn } from '../lib/utils';

interface UsageBarProps {
  /** Percentage value (0-100) */
  value: number;
  /** Label to display (e.g., mount point) */
  label?: string;
  /** Formatted value string (e.g., "120 / 500 GB") */
  displayValue?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get the colour class based on usage percentage.
 */
function getColourClass(percent: number): string {
  if (percent >= 90) {
    return 'bg-red-400'; // #F87171
  }
  if (percent >= 80) {
    return 'bg-amber-400'; // #FBBF24
  }
  return 'bg-green-400'; // #4ADE80
}

export function UsageBar({ value, label, displayValue, className }: UsageBarProps) {
  // Clamp value to 0-100
  const percent = Math.max(0, Math.min(100, value));
  const colourClass = getColourClass(percent);

  return (
    <div className={cn('space-y-1', className)}>
      {(label || displayValue) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-text-secondary">{label}</span>}
          {displayValue && (
            <span className="font-mono text-text-primary">
              {displayValue} ({percent}%)
            </span>
          )}
        </div>
      )}
      <div
        className="h-2 w-full rounded-full bg-tertiary"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ? `${label} usage` : 'Usage'}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', colourClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
