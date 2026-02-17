/**
 * Device matching utility for unified discovery.
 *
 * EP0019: Unified Device Discovery - Single Pane of Glass
 *
 * Provides intelligent device deduplication when the same physical device
 * is discovered via both Network Scan and Tailscale.
 */

import type {
  UnifiedDevice,
  MergedDevice,
  MergedSource,
  MatchConfidence,
} from '../types/discovery';

/**
 * Normalise hostname for comparison.
 * Removes domain suffix, converts to lowercase, trims whitespace.
 */
export function normaliseHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .trim()
    .split('.')[0] // Remove domain suffix
    .replace(/[^a-z0-9-]/g, ''); // Keep only alphanumeric and hyphens
}

/**
 * Check if two hostnames match with confidence level.
 *
 * HIGH confidence: Exact normalised match
 * MEDIUM confidence: One is prefix of the other (handles Tailscale suffixes)
 * LOW confidence: 4+ character substring match
 *
 * Returns null if no match.
 */
export function matchHostnames(
  hostname1: string,
  hostname2: string
): MatchConfidence | null {
  const norm1 = normaliseHostname(hostname1);
  const norm2 = normaliseHostname(hostname2);

  // Empty hostnames don't match
  if (!norm1 || !norm2) {
    return null;
  }

  // HIGH: Exact match
  if (norm1 === norm2) {
    return 'high';
  }

  // MEDIUM: One is prefix of the other (e.g., "server1" matches "server1-tailscale")
  if (norm1.startsWith(norm2) || norm2.startsWith(norm1)) {
    // Require at least 3 characters for prefix match
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    if (shorter.length >= 3) {
      return 'medium';
    }
  }

  // LOW: 4+ character substring overlap
  const minSubstringLength = 4;
  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  const longer = norm1.length >= norm2.length ? norm1 : norm2;

  if (shorter.length >= minSubstringLength) {
    // Check if shorter hostname is a substring of longer
    if (longer.includes(shorter)) {
      return 'low';
    }

    // Check for common prefix of at least 4 characters
    let commonPrefix = 0;
    for (let i = 0; i < Math.min(norm1.length, norm2.length); i++) {
      if (norm1[i] === norm2[i]) {
        commonPrefix++;
      } else {
        break;
      }
    }
    if (commonPrefix >= minSubstringLength) {
      return 'low';
    }
  }

  return null;
}

/**
 * Check if two devices match by IP address.
 * Returns true if IPs are exactly equal (rare but possible).
 */
export function matchByIp(device1: UnifiedDevice, device2: UnifiedDevice): boolean {
  return device1.ip === device2.ip;
}

/**
 * Match a network device against a Tailscale device.
 * Returns the confidence level if matched, null otherwise.
 */
export function matchDevices(
  networkDevice: UnifiedDevice,
  tailscaleDevice: UnifiedDevice
): MatchConfidence | null {
  // 1. Try exact IP match (rare but possible with bridge networks)
  if (matchByIp(networkDevice, tailscaleDevice)) {
    return 'high';
  }

  // 2. Try hostname match
  const networkHostname = networkDevice.hostname;
  const tailscaleHostname = tailscaleDevice.hostname;

  return matchHostnames(networkHostname, tailscaleHostname);
}

/**
 * Determine recommended connection path for a merged device.
 *
 * - If only one source is available, use that
 * - If both available, prefer Tailscale (works remotely)
 * - If network has faster response time and available, consider that
 */
export function determineRecommendedPath(
  networkDevice: UnifiedDevice | undefined,
  tailscaleDevice: UnifiedDevice | undefined
): 'network' | 'tailscale' | undefined {
  const networkAvailable = networkDevice?.availability === 'available';
  const tailscaleAvailable = tailscaleDevice?.availability === 'available';

  if (tailscaleAvailable && !networkAvailable) {
    return 'tailscale';
  }
  if (networkAvailable && !tailscaleAvailable) {
    return 'network';
  }
  if (tailscaleAvailable && networkAvailable) {
    // Prefer Tailscale as it works remotely
    return 'tailscale';
  }

  return undefined;
}

/**
 * Create a merged device from network and/or Tailscale sources.
 */
export function createMergedDevice(
  networkDevice: UnifiedDevice | undefined,
  tailscaleDevice: UnifiedDevice | undefined,
  matchConfidence?: MatchConfidence
): MergedDevice {
  // Determine merged source
  let mergedSource: MergedSource;
  if (networkDevice && tailscaleDevice) {
    mergedSource = 'both';
  } else if (networkDevice) {
    mergedSource = 'network';
  } else {
    mergedSource = 'tailscale';
  }

  // Use Tailscale device as primary if available (more stable ID)
  const primaryDevice = tailscaleDevice || networkDevice!;

  // Determine combined availability
  const networkAvailable = networkDevice?.availability === 'available';
  const tailscaleAvailable = tailscaleDevice?.availability === 'available';
  let availability = primaryDevice.availability;
  let unavailableReason = primaryDevice.unavailableReason;

  if (mergedSource === 'both') {
    // Available if either source is available
    if (networkAvailable || tailscaleAvailable) {
      availability = 'available';
      unavailableReason = null;
    }
  }

  // Determine recommended path
  const recommendedPath = determineRecommendedPath(networkDevice, tailscaleDevice);

  // Build merged device
  const merged: MergedDevice = {
    // Use Tailscale ID as primary if available, otherwise network IP
    id: tailscaleDevice?.id || networkDevice!.id,

    // Use shorter hostname if available, preferring network (local DNS resolution)
    hostname: networkDevice?.hostname || tailscaleDevice!.hostname,

    // Primary IP (Tailscale IP if available, otherwise network IP)
    ip: tailscaleDevice?.ip || networkDevice!.ip,

    // OS - prefer Tailscale as it has better OS detection
    os: tailscaleDevice?.os || networkDevice!.os,

    // Keep source as the primary source for backward compatibility
    source: tailscaleDevice ? 'tailscale' : 'network',

    // Combined availability
    availability,
    unavailableReason,

    // Monitored status - true if either source shows as monitored
    isMonitored: networkDevice?.isMonitored || tailscaleDevice?.isMonitored || false,
    serverId: networkDevice?.serverId || tailscaleDevice?.serverId,

    // Network-specific fields
    responseTimeMs: networkDevice?.responseTimeMs ?? null,
    sshKeyUsed: networkDevice?.sshKeyUsed || tailscaleDevice?.sshKeyUsed || null,

    // Tailscale-specific fields
    lastSeen: tailscaleDevice?.lastSeen ?? null,
    tailscaleDeviceId: tailscaleDevice?.tailscaleDeviceId,
    tailscaleHostname: tailscaleDevice?.tailscaleHostname,
    tailscaleOnline: tailscaleDevice?.tailscaleOnline,

    // Merged device fields
    mergedSource,
    networkIp: networkDevice?.ip,
    tailscaleIp: tailscaleDevice?.ip,
    matchConfidence: mergedSource === 'both' ? matchConfidence : undefined,
    recommendedPath,
    networkDevice,
    tailscaleDevice,
  };

  return merged;
}

/**
 * Match result for device merging.
 */
interface MatchResult {
  networkIndex: number;
  tailscaleIndex: number;
  confidence: MatchConfidence;
}

/**
 * Merge network and Tailscale device lists into a unified list.
 *
 * Algorithm:
 * 1. Find all matches between network and Tailscale devices
 * 2. Sort matches by confidence (high > medium > low)
 * 3. Greedily assign matches (each device can only be in one match)
 * 4. Create merged devices for matches
 * 5. Add unmatched devices as single-source entries
 */
export function mergeDevices(
  networkDevices: UnifiedDevice[],
  tailscaleDevices: UnifiedDevice[]
): MergedDevice[] {
  // Find all potential matches with confidence levels
  const matches: MatchResult[] = [];

  for (let ni = 0; ni < networkDevices.length; ni++) {
    for (let ti = 0; ti < tailscaleDevices.length; ti++) {
      const confidence = matchDevices(networkDevices[ni], tailscaleDevices[ti]);
      if (confidence) {
        matches.push({
          networkIndex: ni,
          tailscaleIndex: ti,
          confidence,
        });
      }
    }
  }

  // Sort by confidence: high > medium > low
  const confidenceOrder: Record<MatchConfidence, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  matches.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);

  // Greedily assign matches (each device can only be matched once)
  const usedNetwork = new Set<number>();
  const usedTailscale = new Set<number>();
  const finalMatches: MatchResult[] = [];

  for (const match of matches) {
    if (!usedNetwork.has(match.networkIndex) && !usedTailscale.has(match.tailscaleIndex)) {
      finalMatches.push(match);
      usedNetwork.add(match.networkIndex);
      usedTailscale.add(match.tailscaleIndex);
    }
  }

  // Build result list
  const result: MergedDevice[] = [];

  // Add matched devices (both sources)
  for (const match of finalMatches) {
    const networkDevice = networkDevices[match.networkIndex];
    const tailscaleDevice = tailscaleDevices[match.tailscaleIndex];
    result.push(createMergedDevice(networkDevice, tailscaleDevice, match.confidence));
  }

  // Add unmatched network devices
  for (let i = 0; i < networkDevices.length; i++) {
    if (!usedNetwork.has(i)) {
      result.push(createMergedDevice(networkDevices[i], undefined));
    }
  }

  // Add unmatched Tailscale devices
  for (let i = 0; i < tailscaleDevices.length; i++) {
    if (!usedTailscale.has(i)) {
      result.push(createMergedDevice(undefined, tailscaleDevices[i]));
    }
  }

  // Sort by hostname for consistent display
  result.sort((a, b) => a.hostname.localeCompare(b.hostname));

  return result;
}
