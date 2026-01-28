import { cn } from '../lib/utils';

interface GaugeProps {
  /** Percentage value (0-100), or null for no data */
  value: number | null;
  /** Label displayed below the gauge (e.g., "CPU", "RAM", "Disk") */
  label: string;
  /** Size of the gauge in pixels (default 120) */
  size?: number;
  /** Optional absolute value to display (e.g., "11/16 GB") */
  absoluteValue?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get the colour class based on the percentage value.
 * - 0-70%: Green (healthy)
 * - 70-85%: Amber (warning)
 * - 85-100%: Red (critical)
 */
function getColourClass(value: number): string {
  if (value >= 85) {
    return 'text-status-error';
  }
  if (value >= 70) {
    return 'text-status-warning';
  }
  return 'text-status-success';
}

/**
 * Get the stroke colour based on the percentage value.
 */
function getStrokeColour(value: number): string {
  if (value >= 85) {
    return '#F87171'; // Red Alert
  }
  if (value >= 70) {
    return '#FBBF24'; // Amber Alert
  }
  return '#4ADE80'; // Phosphor Green
}

/**
 * A circular gauge component that displays a percentage value with
 * threshold-based colouring.
 */
export function Gauge({
  value,
  label,
  size = 120,
  absoluteValue,
  className,
}: GaugeProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate stroke offset for the arc
  const normalizedValue = value !== null ? Math.min(100, Math.max(0, value)) : 0;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

  const hasValue = value !== null;
  const colourClass = hasValue ? getColourClass(normalizedValue) : 'text-text-muted';
  const strokeColour = hasValue ? getStrokeColour(normalizedValue) : '#6E7681';

  return (
    <div
      className={cn('flex flex-col items-center', className)}
      role="meter"
      aria-valuenow={hasValue ? normalizedValue : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${hasValue ? `${normalizedValue.toFixed(0)}%` : 'No data'}`}
      data-testid={`gauge-${label.toLowerCase()}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-bg-tertiary"
          />
          {/* Value arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColour}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn('font-mono text-2xl font-bold', colourClass)}
            data-testid={`gauge-${label.toLowerCase()}-value`}
          >
            {hasValue ? `${normalizedValue.toFixed(0)}%` : '--'}
          </span>
          {absoluteValue && (
            <span className="font-mono text-xs text-text-secondary">
              {absoluteValue}
            </span>
          )}
        </div>
      </div>
      <span className="mt-2 text-sm font-medium text-text-secondary">
        {label}
      </span>
    </div>
  );
}
