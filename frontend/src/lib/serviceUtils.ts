/**
 * Service-related utility functions.
 * US0185: Grace period calculation and display helpers.
 */

import type { ExpectedService } from '../types/service';

/**
 * Check if a service is currently in a restart grace period.
 * @param service The expected service to check
 * @returns true if service is in grace period (grace_period_remaining > 0)
 */
export function isInGracePeriod(service: ExpectedService): boolean {
  return service.grace_period_remaining !== null && service.grace_period_remaining > 0;
}

/**
 * Format seconds remaining as a human-readable string.
 * @param seconds Seconds remaining
 * @returns Formatted string like "45s" or "1m 15s"
 */
export function formatGracePeriod(seconds: number | null): string {
  if (seconds === null || seconds <= 0) {
    return '';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get the effective display status for a service, accounting for grace period.
 * @param service The expected service
 * @returns Status string for display: 'restarting' if in grace period, otherwise current status
 */
export function getDisplayStatus(service: ExpectedService): string {
  if (isInGracePeriod(service)) {
    return 'restarting';
  }

  return service.current_status?.status ?? 'unknown';
}
