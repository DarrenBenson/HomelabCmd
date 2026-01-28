/**
 * Format bytes to human-readable string (KB, MB, GB, TB).
 * @param bytes - Number of bytes, or null
 * @returns Formatted string like "1.23 GB" or "--" if null
 */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) {
    return '--';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, units.length - 1);

  const value = bytes / Math.pow(k, index);

  // Use appropriate decimal places
  if (value >= 100) {
    return `${value.toFixed(0)} ${units[index]}`;
  } else if (value >= 10) {
    return `${value.toFixed(1)} ${units[index]}`;
  } else {
    return `${value.toFixed(2)} ${units[index]}`;
  }
}

/**
 * Format uptime seconds to human-readable string.
 * @param seconds - Uptime in seconds, or null
 * @returns Formatted string like "12d 5h 23m" or "--" if null
 */
export function formatUptime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) {
    return '--';
  }

  if (seconds < 0) {
    return '--';
  }

  if (seconds === 0) {
    return '0m';
  }

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const years = Math.floor(days / 365);

  if (years > 0) {
    const remainingDays = days % 365;
    return `${years}y ${remainingDays}d`;
  }

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Format a percentage value with optional decimal places.
 * @param value - Percentage value (0-100), or null
 * @param decimals - Number of decimal places (default 1)
 * @returns Formatted string like "67.2%" or "--" if null
 */
export function formatPercent(value: number | null, decimals: number = 1): string {
  if (value === null || value === undefined) {
    return '--';
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format memory in MB to human-readable string.
 * @param mb - Memory in megabytes, or null
 * @returns Formatted string like "8.2 GB" or "--" if null
 */
export function formatMemoryMB(mb: number | null): string {
  if (mb === null || mb === undefined) {
    return '--';
  }
  return formatBytes(mb * 1024 * 1024);
}

/**
 * Format memory usage as compact "used/total GB" string.
 * @param usedMb - Used memory in MB
 * @param totalMb - Total memory in MB
 * @returns Formatted string like "53/63 GB" or undefined if null
 */
export function formatMemoryCompact(usedMb: number | null, totalMb: number | null): string | undefined {
  if (usedMb === null || totalMb === null) {
    return undefined;
  }
  const usedGb = usedMb / 1024;
  const totalGb = totalMb / 1024;
  return `${Math.round(usedGb)}/${Math.round(totalGb)} GB`;
}

/**
 * Format disk space in GB to human-readable string.
 * @param gb - Disk space in gigabytes, or null
 * @returns Formatted string like "512 GB" or "--" if null
 */
export function formatDiskGB(gb: number | null): string {
  if (gb === null || gb === undefined) {
    return '--';
  }
  if (gb >= 1000) {
    return `${(gb / 1000).toFixed(2)} TB`;
  }
  if (gb >= 100) {
    return `${gb.toFixed(0)} GB`;
  }
  return `${gb.toFixed(1)} GB`;
}

/**
 * Format disk usage as compact "used/total" string with appropriate unit.
 * @param usedGb - Used disk space in GB
 * @param totalGb - Total disk space in GB
 * @returns Formatted string like "271/916 GB" or "1.2/2.0 TB" or undefined if null
 */
export function formatDiskCompact(usedGb: number | null, totalGb: number | null): string | undefined {
  if (usedGb === null || totalGb === null) {
    return undefined;
  }
  if (totalGb >= 1000) {
    // Use TB
    return `${(usedGb / 1000).toFixed(1)}/${(totalGb / 1000).toFixed(1)} TB`;
  }
  // Use GB
  return `${Math.round(usedGb)}/${Math.round(totalGb)} GB`;
}

/**
 * Format load average value.
 * @param load - Load average value, or null
 * @returns Formatted string like "1.25" or "--" if null
 */
export function formatLoadAverage(load: number | null): string {
  if (load === null || load === undefined) {
    return '--';
  }
  return load.toFixed(2);
}

/**
 * Format a relative time since a given ISO timestamp.
 * @param isoTimestamp - ISO 8601 timestamp string, or null
 * @returns Formatted string like "30s ago" or "--" if null
 */
export function formatRelativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) {
    return '--';
  }

  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Format an action type for display.
 * @param actionType - Action type string (e.g., 'restart_service')
 * @returns Formatted string (e.g., 'Restart Service')
 */
export function formatActionType(actionType: string): string {
  const map: Record<string, string> = {
    restart_service: 'Restart Service',
    clear_logs: 'Clear Logs',
  };
  return map[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a cost value with currency symbol.
 * @param cost - Cost value, or null
 * @param currencySymbol - Currency symbol (default '£')
 * @param showPerDay - Whether to append '/day' suffix
 * @returns Formatted string like "£3.20" or "£3.20/day" or "--" if null
 */
export function formatCost(
  cost: number | null,
  currencySymbol: string = '£',
  showPerDay: boolean = false
): string {
  if (cost === null || cost === undefined) {
    return '--';
  }
  const formatted = `${currencySymbol}${cost.toFixed(2)}`;
  return showPerDay ? `${formatted}/day` : formatted;
}
