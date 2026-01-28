import type { TimeRange } from '../types/server';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  disabled?: boolean;
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '12m', label: '12m' },
];

export function TimeRangeSelector({
  value,
  onChange,
  disabled = false,
}: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1" data-testid="time-range-selector">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          disabled={disabled}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            value === range.value
              ? 'bg-status-info text-white'
              : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          data-testid={`range-${range.value}`}
          aria-pressed={value === range.value}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
