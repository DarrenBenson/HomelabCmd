import { describe, it, expect } from 'vitest';
import { formatBytes, formatUptime, formatPercent, formatRelativeTime } from './formatters';

describe('formatBytes', () => {
  it('returns "--" for null', () => {
    expect(formatBytes(null)).toBe('--');
  });

  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
  });

  it('formats megabytes correctly', () => {
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(1572864)).toBe('1.50 MB');
  });

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1073741824)).toBe('1.00 GB');
    expect(formatBytes(1610612736)).toBe('1.50 GB');
  });

  it('formats terabytes correctly', () => {
    expect(formatBytes(1099511627776)).toBe('1.00 TB');
  });

  it('handles large values with appropriate decimal places', () => {
    // 123 GB
    expect(formatBytes(132070244352)).toBe('123 GB');
    // 12.3 GB
    expect(formatBytes(13207024435)).toBe('12.3 GB');
  });
});

describe('formatUptime', () => {
  it('returns "--" for null', () => {
    expect(formatUptime(null)).toBe('--');
  });

  it('returns "--" for negative values', () => {
    expect(formatUptime(-1)).toBe('--');
  });

  it('returns "0m" for zero', () => {
    expect(formatUptime(0)).toBe('0m');
  });

  it('formats minutes correctly', () => {
    expect(formatUptime(60)).toBe('1m');
    expect(formatUptime(120)).toBe('2m');
    expect(formatUptime(3599)).toBe('59m');
  });

  it('formats hours and minutes correctly', () => {
    expect(formatUptime(3600)).toBe('1h 0m');
    expect(formatUptime(3660)).toBe('1h 1m');
    expect(formatUptime(7200)).toBe('2h 0m');
    expect(formatUptime(86399)).toBe('23h 59m');
  });

  it('formats days and hours correctly', () => {
    expect(formatUptime(86400)).toBe('1d 0h');
    expect(formatUptime(90000)).toBe('1d 1h');
    expect(formatUptime(172800)).toBe('2d 0h');
    expect(formatUptime(1234567)).toBe('14d 6h');
  });

  it('formats years and days correctly', () => {
    // 1 year and 10 days
    expect(formatUptime(365 * 86400 + 10 * 86400)).toBe('1y 10d');
    // 2 years and 100 days
    expect(formatUptime(2 * 365 * 86400 + 100 * 86400)).toBe('2y 100d');
  });
});

describe('formatPercent', () => {
  it('returns "--" for null', () => {
    expect(formatPercent(null)).toBe('--');
  });

  it('formats percentage with default decimal places', () => {
    expect(formatPercent(50)).toBe('50.0%');
    expect(formatPercent(67.234)).toBe('67.2%');
  });

  it('formats percentage with custom decimal places', () => {
    expect(formatPercent(50, 0)).toBe('50%');
    expect(formatPercent(67.234, 2)).toBe('67.23%');
  });
});

describe('formatRelativeTime', () => {
  it('returns "--" for null', () => {
    expect(formatRelativeTime(null)).toBe('--');
  });

  it('returns "--" for empty string', () => {
    expect(formatRelativeTime('')).toBe('--');
  });

  it('formats seconds ago correctly', () => {
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30000).toISOString();
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('30s ago');
  });

  it('formats minutes ago correctly', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('formats hours ago correctly', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  it('formats days ago correctly', () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });
});
