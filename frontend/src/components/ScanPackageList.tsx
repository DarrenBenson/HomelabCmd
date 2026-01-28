/**
 * ScanPackageList - Displays installed packages with search.
 *
 * Features:
 * - Shows total package count
 * - Searchable list of recent packages
 * - Collapsible section
 *
 * US0039: Scan Results Display
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { PackageInfo } from '../types/scan';

interface ScanPackageListProps {
  /** Package information */
  packages: PackageInfo | null;
  /** Whether section starts collapsed */
  defaultCollapsed?: boolean;
}

export function ScanPackageList({ packages, defaultCollapsed = true }: ScanPackageListProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [searchQuery, setSearchQuery] = useState('');

  const recentPackages = packages?.recent;
  const filteredPackages = useMemo(() => {
    if (!recentPackages) return [];
    if (!searchQuery.trim()) return recentPackages;
    const query = searchQuery.toLowerCase();
    return recentPackages.filter((pkg) => pkg.toLowerCase().includes(query));
  }, [recentPackages, searchQuery]);

  if (!packages) {
    return (
      <div className="rounded-lg border border-tertiary bg-secondary">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex w-full items-center gap-2 p-4 text-left hover:bg-tertiary/50"
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary" />
          )}
          <h3 className="text-sm font-medium text-text-secondary">Installed Packages</h3>
        </button>
        {!isCollapsed && (
          <div className="border-t border-tertiary p-4">
            <p className="text-text-tertiary">Package list not available</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-tertiary bg-secondary">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-tertiary/50"
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary" />
          )}
          <h3 className="text-sm font-medium text-text-secondary">
            Installed Packages ({packages.count.toLocaleString()})
          </h3>
        </div>
      </button>

      {!isCollapsed && (
        <div className="border-t border-tertiary p-4">
          {packages.recent.length === 0 ? (
            <p className="text-text-tertiary">No packages found</p>
          ) : (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded border border-tertiary bg-primary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredPackages.length === 0 ? (
                  <p className="text-text-tertiary">No matching packages</p>
                ) : (
                  <ul className="space-y-1">
                    {filteredPackages.map((pkg, idx) => (
                      <li key={idx} className="font-mono text-sm text-text-secondary">
                        {pkg}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {packages.count > packages.recent.length && (
                <p className="mt-2 text-xs text-text-tertiary">
                  Showing {packages.recent.length} of {packages.count.toLocaleString()} packages
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
