/**
 * Tests for service utility functions.
 * US0185: Grace period calculation tests.
 */

import { describe, it, expect } from 'vitest';
import {
  isInGracePeriod,
  formatGracePeriod,
  getDisplayStatus,
} from './serviceUtils';
import type { ExpectedService } from '../types/service';

const createService = (
  overrides: Partial<ExpectedService> = {}
): ExpectedService => ({
  service_name: 'test-service',
  display_name: 'Test Service',
  is_critical: false,
  enabled: true,
  current_status: null,
  last_restart_at: null,
  grace_period_remaining: null,
  ...overrides,
});

describe('serviceUtils', () => {
  describe('isInGracePeriod', () => {
    it('returns false when grace_period_remaining is null', () => {
      const service = createService({ grace_period_remaining: null });
      expect(isInGracePeriod(service)).toBe(false);
    });

    it('returns false when grace_period_remaining is 0', () => {
      const service = createService({ grace_period_remaining: 0 });
      expect(isInGracePeriod(service)).toBe(false);
    });

    it('returns false when grace_period_remaining is negative', () => {
      const service = createService({ grace_period_remaining: -5 });
      expect(isInGracePeriod(service)).toBe(false);
    });

    it('returns true when grace_period_remaining is positive', () => {
      const service = createService({ grace_period_remaining: 30 });
      expect(isInGracePeriod(service)).toBe(true);
    });

    it('returns true for small positive values', () => {
      const service = createService({ grace_period_remaining: 1 });
      expect(isInGracePeriod(service)).toBe(true);
    });
  });

  describe('formatGracePeriod', () => {
    it('returns empty string for null', () => {
      expect(formatGracePeriod(null)).toBe('');
    });

    it('returns empty string for 0', () => {
      expect(formatGracePeriod(0)).toBe('');
    });

    it('returns empty string for negative values', () => {
      expect(formatGracePeriod(-10)).toBe('');
    });

    it('formats seconds under 60 as Xs', () => {
      expect(formatGracePeriod(45)).toBe('45s');
      expect(formatGracePeriod(1)).toBe('1s');
      expect(formatGracePeriod(59)).toBe('59s');
    });

    it('formats exactly 60 seconds as 1m', () => {
      expect(formatGracePeriod(60)).toBe('1m');
    });

    it('formats minutes with no remaining seconds as Xm', () => {
      expect(formatGracePeriod(120)).toBe('2m');
      expect(formatGracePeriod(300)).toBe('5m');
    });

    it('formats minutes with remaining seconds as Xm Ys', () => {
      expect(formatGracePeriod(75)).toBe('1m 15s');
      expect(formatGracePeriod(125)).toBe('2m 5s');
      expect(formatGracePeriod(90)).toBe('1m 30s');
    });
  });

  describe('getDisplayStatus', () => {
    it('returns "restarting" when in grace period', () => {
      const service = createService({
        current_status: {
          status: 'stopped',
          status_reason: null,
          pid: null,
          memory_mb: null,
          cpu_percent: null,
          last_seen: '2024-01-01T00:00:00Z',
        },
        grace_period_remaining: 30,
      });
      expect(getDisplayStatus(service)).toBe('restarting');
    });

    it('returns actual status when not in grace period', () => {
      const runningService = createService({
        current_status: {
          status: 'running',
          status_reason: null,
          pid: 1234,
          memory_mb: 100,
          cpu_percent: 5.5,
          last_seen: '2024-01-01T00:00:00Z',
        },
        grace_period_remaining: null,
      });
      expect(getDisplayStatus(runningService)).toBe('running');

      const stoppedService = createService({
        current_status: {
          status: 'stopped',
          status_reason: null,
          pid: null,
          memory_mb: null,
          cpu_percent: null,
          last_seen: '2024-01-01T00:00:00Z',
        },
        grace_period_remaining: 0,
      });
      expect(getDisplayStatus(stoppedService)).toBe('stopped');
    });

    it('returns "unknown" when no current_status and not in grace period', () => {
      const service = createService({
        current_status: null,
        grace_period_remaining: null,
      });
      expect(getDisplayStatus(service)).toBe('unknown');
    });

    it('returns "restarting" even for running services if in grace period', () => {
      // Edge case: service came back up but still in grace period
      const service = createService({
        current_status: {
          status: 'running',
          status_reason: null,
          pid: 1234,
          memory_mb: 100,
          cpu_percent: 5.5,
          last_seen: '2024-01-01T00:00:00Z',
        },
        grace_period_remaining: 10,
      });
      expect(getDisplayStatus(service)).toBe('restarting');
    });
  });
});
