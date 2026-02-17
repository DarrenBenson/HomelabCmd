/**
 * Tests for device matching utility.
 *
 * EP0019: Unified Device Discovery - Single Pane of Glass
 */

import { describe, it, expect } from 'vitest';
import {
  normaliseHostname,
  matchHostnames,
  matchByIp,
  matchDevices,
  determineRecommendedPath,
  createMergedDevice,
  mergeDevices,
} from './deviceMatcher';
import type { UnifiedDevice } from '../types/discovery';

// Helper to create a mock network device
function createNetworkDevice(overrides: Partial<UnifiedDevice> = {}): UnifiedDevice {
  return {
    id: 'network-192.168.1.100',
    hostname: 'server1',
    ip: '192.168.1.100',
    os: 'linux',
    source: 'network',
    availability: 'available',
    unavailableReason: null,
    isMonitored: false,
    responseTimeMs: 5,
    lastSeen: null,
    sshKeyUsed: 'default',
    ...overrides,
  };
}

// Helper to create a mock Tailscale device
function createTailscaleDevice(overrides: Partial<UnifiedDevice> = {}): UnifiedDevice {
  return {
    id: 'tailscale-node-1',
    hostname: 'server1',
    ip: '100.64.0.1',
    os: 'linux',
    source: 'tailscale',
    availability: 'available',
    unavailableReason: null,
    isMonitored: false,
    responseTimeMs: null,
    lastSeen: '2026-01-29T10:00:00Z',
    sshKeyUsed: 'default',
    tailscaleDeviceId: 'node-1',
    tailscaleHostname: 'server1.tailnet.ts.net',
    tailscaleOnline: true,
    ...overrides,
  };
}

describe('normaliseHostname', () => {
  it('converts to lowercase', () => {
    expect(normaliseHostname('ServerOne')).toBe('serverone');
    expect(normaliseHostname('SERVER1')).toBe('server1');
  });

  it('removes domain suffix', () => {
    expect(normaliseHostname('server1.local')).toBe('server1');
    expect(normaliseHostname('server1.tailnet.ts.net')).toBe('server1');
    expect(normaliseHostname('server1.example.com')).toBe('server1');
  });

  it('removes non-alphanumeric characters except hyphens', () => {
    expect(normaliseHostname('server_1')).toBe('server1');
    expect(normaliseHostname('server.one')).toBe('server');
    expect(normaliseHostname('server-1')).toBe('server-1');
  });

  it('trims whitespace', () => {
    expect(normaliseHostname('  server1  ')).toBe('server1');
  });

  it('handles empty strings', () => {
    expect(normaliseHostname('')).toBe('');
  });
});

describe('matchHostnames', () => {
  describe('HIGH confidence matches', () => {
    it('matches exact normalised hostnames', () => {
      expect(matchHostnames('server1', 'server1')).toBe('high');
      expect(matchHostnames('Server1', 'server1')).toBe('high');
      expect(matchHostnames('server1.local', 'server1.tailnet.ts.net')).toBe('high');
    });
  });

  describe('MEDIUM confidence matches', () => {
    it('matches when one is prefix of the other', () => {
      expect(matchHostnames('server1', 'server1-tailscale')).toBe('medium');
      expect(matchHostnames('myhost', 'myhost-vpn')).toBe('medium');
    });

    it('requires minimum 3 character prefix', () => {
      expect(matchHostnames('ab', 'abc')).toBeNull();
      expect(matchHostnames('abc', 'abcd')).toBe('medium');
    });
  });

  describe('LOW confidence matches', () => {
    it('matches when shorter is substring of longer', () => {
      expect(matchHostnames('serv', 'myserver1')).toBe('low');
    });

    it('matches on 4+ character common prefix', () => {
      expect(matchHostnames('server1', 'server2')).toBe('low');
      expect(matchHostnames('homelab-box', 'homelab-nas')).toBe('low');
    });

    it('requires minimum 4 characters for substring match', () => {
      expect(matchHostnames('srv', 'myserver')).toBeNull();
    });
  });

  describe('no matches', () => {
    it('returns null for completely different hostnames', () => {
      expect(matchHostnames('server1', 'workstation2')).toBeNull();
      expect(matchHostnames('nas', 'router')).toBeNull();
    });

    it('returns null for empty hostnames', () => {
      expect(matchHostnames('', 'server1')).toBeNull();
      expect(matchHostnames('server1', '')).toBeNull();
    });
  });
});

describe('matchByIp', () => {
  it('returns true for matching IPs', () => {
    const device1 = createNetworkDevice({ ip: '192.168.1.100' });
    const device2 = createTailscaleDevice({ ip: '192.168.1.100' });
    expect(matchByIp(device1, device2)).toBe(true);
  });

  it('returns false for different IPs', () => {
    const device1 = createNetworkDevice({ ip: '192.168.1.100' });
    const device2 = createTailscaleDevice({ ip: '100.64.0.1' });
    expect(matchByIp(device1, device2)).toBe(false);
  });
});

describe('matchDevices', () => {
  it('returns high confidence for exact hostname match', () => {
    const networkDevice = createNetworkDevice({ hostname: 'server1' });
    const tailscaleDevice = createTailscaleDevice({ hostname: 'server1' });
    expect(matchDevices(networkDevice, tailscaleDevice)).toBe('high');
  });

  it('returns high confidence for IP match', () => {
    const networkDevice = createNetworkDevice({ hostname: 'different', ip: '100.64.0.1' });
    const tailscaleDevice = createTailscaleDevice({ hostname: 'server1', ip: '100.64.0.1' });
    expect(matchDevices(networkDevice, tailscaleDevice)).toBe('high');
  });

  it('returns medium confidence for prefix match', () => {
    const networkDevice = createNetworkDevice({ hostname: 'server1' });
    const tailscaleDevice = createTailscaleDevice({ hostname: 'server1-ts' });
    expect(matchDevices(networkDevice, tailscaleDevice)).toBe('medium');
  });

  it('returns null for no match', () => {
    const networkDevice = createNetworkDevice({ hostname: 'nas' });
    const tailscaleDevice = createTailscaleDevice({ hostname: 'router' });
    expect(matchDevices(networkDevice, tailscaleDevice)).toBeNull();
  });
});

describe('determineRecommendedPath', () => {
  it('recommends tailscale when only tailscale is available', () => {
    const networkDevice = createNetworkDevice({ availability: 'unavailable' });
    const tailscaleDevice = createTailscaleDevice({ availability: 'available' });
    expect(determineRecommendedPath(networkDevice, tailscaleDevice)).toBe('tailscale');
  });

  it('recommends network when only network is available', () => {
    const networkDevice = createNetworkDevice({ availability: 'available' });
    const tailscaleDevice = createTailscaleDevice({ availability: 'unavailable' });
    expect(determineRecommendedPath(networkDevice, tailscaleDevice)).toBe('network');
  });

  it('recommends tailscale when both are available', () => {
    const networkDevice = createNetworkDevice({ availability: 'available' });
    const tailscaleDevice = createTailscaleDevice({ availability: 'available' });
    expect(determineRecommendedPath(networkDevice, tailscaleDevice)).toBe('tailscale');
  });

  it('returns undefined when neither is available', () => {
    const networkDevice = createNetworkDevice({ availability: 'unavailable' });
    const tailscaleDevice = createTailscaleDevice({ availability: 'unavailable' });
    expect(determineRecommendedPath(networkDevice, tailscaleDevice)).toBeUndefined();
  });

  it('handles undefined devices', () => {
    expect(determineRecommendedPath(undefined, undefined)).toBeUndefined();
    expect(determineRecommendedPath(createNetworkDevice({ availability: 'available' }), undefined)).toBe('network');
    expect(determineRecommendedPath(undefined, createTailscaleDevice({ availability: 'available' }))).toBe('tailscale');
  });
});

describe('createMergedDevice', () => {
  it('creates network-only merged device', () => {
    const networkDevice = createNetworkDevice();
    const merged = createMergedDevice(networkDevice, undefined);

    expect(merged.mergedSource).toBe('network');
    expect(merged.networkIp).toBe('192.168.1.100');
    expect(merged.tailscaleIp).toBeUndefined();
    expect(merged.matchConfidence).toBeUndefined();
  });

  it('creates tailscale-only merged device', () => {
    const tailscaleDevice = createTailscaleDevice();
    const merged = createMergedDevice(undefined, tailscaleDevice);

    expect(merged.mergedSource).toBe('tailscale');
    expect(merged.tailscaleIp).toBe('100.64.0.1');
    expect(merged.networkIp).toBeUndefined();
    expect(merged.matchConfidence).toBeUndefined();
  });

  it('creates merged device from both sources', () => {
    const networkDevice = createNetworkDevice();
    const tailscaleDevice = createTailscaleDevice();
    const merged = createMergedDevice(networkDevice, tailscaleDevice, 'high');

    expect(merged.mergedSource).toBe('both');
    expect(merged.networkIp).toBe('192.168.1.100');
    expect(merged.tailscaleIp).toBe('100.64.0.1');
    expect(merged.matchConfidence).toBe('high');
    expect(merged.recommendedPath).toBe('tailscale');
  });

  it('uses Tailscale ID as primary when available', () => {
    const networkDevice = createNetworkDevice();
    const tailscaleDevice = createTailscaleDevice();
    const merged = createMergedDevice(networkDevice, tailscaleDevice, 'high');

    expect(merged.id).toBe('tailscale-node-1');
  });

  it('combines availability - available if either is available', () => {
    const networkDevice = createNetworkDevice({ availability: 'unavailable' });
    const tailscaleDevice = createTailscaleDevice({ availability: 'available' });
    const merged = createMergedDevice(networkDevice, tailscaleDevice, 'high');

    expect(merged.availability).toBe('available');
  });

  it('preserves monitored status from either source', () => {
    const networkDevice = createNetworkDevice({ isMonitored: true, serverId: 'srv-1' });
    const tailscaleDevice = createTailscaleDevice({ isMonitored: false });
    const merged = createMergedDevice(networkDevice, tailscaleDevice, 'high');

    expect(merged.isMonitored).toBe(true);
    expect(merged.serverId).toBe('srv-1');
  });

  it('prefers network hostname (local DNS)', () => {
    const networkDevice = createNetworkDevice({ hostname: 'server1.local' });
    const tailscaleDevice = createTailscaleDevice({ hostname: 'server1' });
    const merged = createMergedDevice(networkDevice, tailscaleDevice, 'high');

    expect(merged.hostname).toBe('server1.local');
  });

  it('stores original device references', () => {
    const networkDevice = createNetworkDevice();
    const tailscaleDevice = createTailscaleDevice();
    const merged = createMergedDevice(networkDevice, tailscaleDevice, 'high');

    expect(merged.networkDevice).toBe(networkDevice);
    expect(merged.tailscaleDevice).toBe(tailscaleDevice);
  });
});

describe('mergeDevices', () => {
  it('returns empty array for empty inputs', () => {
    expect(mergeDevices([], [])).toEqual([]);
  });

  it('returns network-only devices when no tailscale devices', () => {
    const networkDevices = [createNetworkDevice()];
    const result = mergeDevices(networkDevices, []);

    expect(result).toHaveLength(1);
    expect(result[0].mergedSource).toBe('network');
  });

  it('returns tailscale-only devices when no network devices', () => {
    const tailscaleDevices = [createTailscaleDevice()];
    const result = mergeDevices([], tailscaleDevices);

    expect(result).toHaveLength(1);
    expect(result[0].mergedSource).toBe('tailscale');
  });

  it('merges matching devices into single entry', () => {
    const networkDevices = [createNetworkDevice({ hostname: 'server1' })];
    const tailscaleDevices = [createTailscaleDevice({ hostname: 'server1' })];
    const result = mergeDevices(networkDevices, tailscaleDevices);

    expect(result).toHaveLength(1);
    expect(result[0].mergedSource).toBe('both');
  });

  it('keeps unmatched devices separate', () => {
    const networkDevices = [createNetworkDevice({ hostname: 'nas' })];
    const tailscaleDevices = [createTailscaleDevice({ hostname: 'router' })];
    const result = mergeDevices(networkDevices, tailscaleDevices);

    expect(result).toHaveLength(2);
    expect(result.filter(d => d.mergedSource === 'network')).toHaveLength(1);
    expect(result.filter(d => d.mergedSource === 'tailscale')).toHaveLength(1);
  });

  it('sorts results by hostname', () => {
    const networkDevices = [
      createNetworkDevice({ id: 'n1', hostname: 'zebra' }),
      createNetworkDevice({ id: 'n2', hostname: 'apple' }),
    ];
    const result = mergeDevices(networkDevices, []);

    expect(result[0].hostname).toBe('apple');
    expect(result[1].hostname).toBe('zebra');
  });

  it('prioritises high confidence matches', () => {
    const networkDevices = [
      createNetworkDevice({ id: 'n1', hostname: 'server1' }),
    ];
    const tailscaleDevices = [
      createTailscaleDevice({ id: 't1', hostname: 'server1' }), // exact match
      createTailscaleDevice({ id: 't2', hostname: 'server1-backup' }), // prefix match
    ];
    const result = mergeDevices(networkDevices, tailscaleDevices);

    // Should match server1 with server1 (high confidence), not server1-backup (medium)
    const merged = result.find(d => d.mergedSource === 'both');
    expect(merged).toBeDefined();
    expect(merged!.matchConfidence).toBe('high');

    // server1-backup should remain unmatched
    const unmatched = result.find(d => d.mergedSource === 'tailscale');
    expect(unmatched).toBeDefined();
  });

  it('handles multiple matching devices correctly', () => {
    const networkDevices = [
      createNetworkDevice({ id: 'n1', hostname: 'server1' }),
      createNetworkDevice({ id: 'n2', hostname: 'server2' }),
    ];
    const tailscaleDevices = [
      createTailscaleDevice({ id: 't1', hostname: 'server1' }),
      createTailscaleDevice({ id: 't2', hostname: 'server2' }),
    ];
    const result = mergeDevices(networkDevices, tailscaleDevices);

    expect(result).toHaveLength(2);
    expect(result.every(d => d.mergedSource === 'both')).toBe(true);
  });

  it('does not match same device twice', () => {
    const networkDevices = [
      createNetworkDevice({ id: 'n1', hostname: 'server' }),
      createNetworkDevice({ id: 'n2', hostname: 'server-backup' }),
    ];
    const tailscaleDevices = [
      createTailscaleDevice({ id: 't1', hostname: 'server' }),
    ];
    const result = mergeDevices(networkDevices, tailscaleDevices);

    // server should match with server (1 merged)
    // server-backup should remain unmatched (1 network-only)
    expect(result).toHaveLength(2);
    expect(result.filter(d => d.mergedSource === 'both')).toHaveLength(1);
    expect(result.filter(d => d.mergedSource === 'network')).toHaveLength(1);
  });
});
