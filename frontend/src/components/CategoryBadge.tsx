import { Settings } from 'lucide-react';

interface CategoryBadgeProps {
  label: string | null;
  source: 'auto' | 'user' | null;
  className?: string;
}

/**
 * Badge displaying machine category with source indicator.
 *
 * Shows:
 * - Category label (e.g., "Mini PC")
 * - Source indicator: "(auto)" for auto-detected, gear icon for user-set
 */
export function CategoryBadge({ label, source, className = '' }: CategoryBadgeProps) {
  if (!label) {
    return (
      <span className={`text-text-tertiary ${className}`} data-testid="category-badge-none">
        --
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-text-primary ${className}`}
      data-testid="category-badge"
    >
      {label}
      {source === 'auto' && (
        <span className="text-xs text-text-tertiary" data-testid="category-source-auto">
          (auto)
        </span>
      )}
      {source === 'user' && (
        <Settings
          className="h-3 w-3 text-text-tertiary"
          data-testid="category-source-user"
          aria-label="User configured"
        />
      )}
    </span>
  );
}
