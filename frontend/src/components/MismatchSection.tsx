/**
 * Collapsible section component for displaying configuration mismatches.
 *
 * Part of EP0010: Configuration Management - US0118 Configuration Diff View.
 */

import { useState } from 'react';
import { cn } from '../lib/utils';

interface MismatchSectionProps {
  title: string;
  count: number;
  defaultExpanded?: boolean;
  variant?: 'error' | 'warning' | 'info';
  children: React.ReactNode;
}

export function MismatchSection({
  title,
  count,
  defaultExpanded = false,
  variant = 'error',
  children,
}: MismatchSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (count === 0) {
    return null;
  }

  const variantStyles = {
    error: {
      badge: 'bg-status-error/20 text-status-error',
      border: 'border-status-error/30',
    },
    warning: {
      badge: 'bg-status-warning/20 text-status-warning',
      border: 'border-status-warning/30',
    },
    info: {
      badge: 'bg-status-info/20 text-status-info',
      border: 'border-status-info/30',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'rounded-lg border bg-bg-secondary',
        styles.border
      )}
      data-testid={`mismatch-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-bg-tertiary/50 transition-colors rounded-lg"
        data-testid="mismatch-section-toggle"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-text-primary">{title}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              styles.badge
            )}
            data-testid="mismatch-count-badge"
          >
            {count}
          </span>
        </div>
        <svg
          className={cn(
            'h-5 w-5 text-text-secondary transition-transform',
            expanded && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div
          className="border-t border-border-default p-4 space-y-3"
          data-testid="mismatch-section-content"
        >
          {children}
        </div>
      )}
    </div>
  );
}
