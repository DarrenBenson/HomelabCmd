/**
 * Source Badge component for unified discovery.
 *
 * EP0019: Unified Device Discovery - Single Pane of Glass
 *
 * Shows [N], [T], or [N+T] badges to indicate discovery source(s).
 */

import { Wifi, Globe } from 'lucide-react';
import type { MergedSource, MatchConfidence } from '../types/discovery';

interface SourceBadgeProps {
  source: MergedSource;
  matchConfidence?: MatchConfidence;
  size?: 'sm' | 'md';
}

/**
 * Get badge styling based on source type.
 */
function getBadgeClasses(source: MergedSource, size: 'sm' | 'md'): string {
  const baseClasses = 'inline-flex items-center gap-1 rounded font-medium';
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';

  let colorClasses: string;
  switch (source) {
    case 'network':
      colorClasses = 'bg-blue-500/20 text-blue-400';
      break;
    case 'tailscale':
      colorClasses = 'bg-purple-500/20 text-purple-400';
      break;
    case 'both':
      colorClasses = 'bg-emerald-500/20 text-emerald-400';
      break;
  }

  return `${baseClasses} ${sizeClasses} ${colorClasses}`;
}

/**
 * Get tooltip text for the badge.
 */
function getTooltip(source: MergedSource, matchConfidence?: MatchConfidence): string {
  switch (source) {
    case 'network':
      return 'Discovered via Network Scan';
    case 'tailscale':
      return 'Discovered via Tailscale';
    case 'both': {
      const confidenceText =
        matchConfidence === 'high'
          ? 'exact hostname match'
          : matchConfidence === 'medium'
            ? 'hostname prefix match'
            : 'partial hostname match';
      return `Found via both sources (${confidenceText})`;
    }
  }
}

/**
 * Source badge showing discovery source(s) for a device.
 */
export function SourceBadge({
  source,
  matchConfidence,
  size = 'sm',
}: SourceBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <span
      className={getBadgeClasses(source, size)}
      title={getTooltip(source, matchConfidence)}
    >
      {source === 'network' && (
        <>
          <Wifi className={iconSize} />
          <span>N</span>
        </>
      )}
      {source === 'tailscale' && (
        <>
          <Globe className={iconSize} />
          <span>T</span>
        </>
      )}
      {source === 'both' && (
        <>
          <Wifi className={iconSize} />
          <span>+</span>
          <Globe className={iconSize} />
        </>
      )}
    </span>
  );
}

/**
 * Compact source indicator for space-constrained contexts.
 */
export function SourceIndicator({
  source,
  matchConfidence,
}: {
  source: MergedSource;
  matchConfidence?: MatchConfidence;
}) {
  const tooltip = getTooltip(source, matchConfidence);

  if (source === 'both') {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-emerald-400"
        title={tooltip}
      >
        <Wifi className="h-3 w-3" />
        <span className="text-xs">+</span>
        <Globe className="h-3 w-3" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center ${
        source === 'network' ? 'text-blue-400' : 'text-purple-400'
      }`}
      title={tooltip}
    >
      {source === 'network' ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <Globe className="h-3 w-3" />
      )}
    </span>
  );
}
