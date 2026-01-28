import { Network } from 'lucide-react';

interface TailscaleBadgeProps {
  /** Tailscale MagicDNS hostname for the server */
  tailscaleHostname?: string | null;
}

/**
 * US0111: Connectivity badge for servers connected via Tailscale.
 *
 * Displays a small badge with Tailscale indicator when the server
 * has a tailscale_hostname configured. Includes tooltip showing
 * the full hostname.
 */
export function TailscaleBadge({ tailscaleHostname }: TailscaleBadgeProps) {
  // AC4: No badge for non-Tailscale servers (null or empty string)
  if (!tailscaleHostname || tailscaleHostname.trim() === '') {
    return null;
  }

  // Edge case 2: Truncate very long hostnames in tooltip
  const displayHostname =
    tailscaleHostname.length > 50
      ? `${tailscaleHostname.slice(0, 47)}...`
      : tailscaleHostname;

  // AC3: Tooltip with hostname
  const tooltipText = `Connected via Tailscale: ${displayHostname}`;

  return (
    <span
      className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1"
      data-testid="tailscale-badge"
      title={tooltipText}
    >
      <Network className="w-3 h-3" aria-hidden="true" />
      <span>Tailscale</span>
    </span>
  );
}
