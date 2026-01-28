/**
 * ScanProcessList - Displays running processes with sorting capability.
 *
 * Features:
 * - Sort by memory (default) or CPU
 * - Limit to top 50 processes
 * - Collapsible section
 *
 * US0039: Scan Results Display
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import type { ProcessInfo } from '../types/scan';
import { cn } from '../lib/utils';

interface ScanProcessListProps {
  /** Array of process information */
  processes: ProcessInfo[];
  /** Whether section starts collapsed */
  defaultCollapsed?: boolean;
}

type SortField = 'mem_percent' | 'cpu_percent';

const MAX_PROCESSES = 50;

export function ScanProcessList({ processes, defaultCollapsed = true }: ScanProcessListProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [sortField, setSortField] = useState<SortField>('mem_percent');
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  // Sort and limit processes
  const sortedProcesses = [...processes]
    .sort((a, b) => {
      const aVal = sortField === 'mem_percent' ? a.mem_percent : a.cpu_percent;
      const bVal = sortField === 'mem_percent' ? b.mem_percent : b.cpu_percent;
      return sortDesc ? bVal - aVal : aVal - bVal;
    })
    .slice(0, MAX_PROCESSES);

  const SortIcon = sortDesc ? ArrowDown : ArrowUp;

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
            Running Processes ({processes.length})
          </h3>
        </div>
        {processes.length > MAX_PROCESSES && (
          <span className="text-xs text-text-tertiary">Showing top {MAX_PROCESSES}</span>
        )}
      </button>

      {!isCollapsed && (
        <div className="border-t border-tertiary">
          {processes.length === 0 ? (
            <p className="p-4 text-text-tertiary">No process information available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tertiary text-text-tertiary">
                    <th className="px-4 py-2 text-left font-medium">PID</th>
                    <th className="px-4 py-2 text-left font-medium">Command</th>
                    <th className="px-4 py-2 text-left font-medium">User</th>
                    <th
                      className={cn(
                        'cursor-pointer px-4 py-2 text-right font-medium hover:text-text-primary',
                        sortField === 'mem_percent' && 'text-text-primary'
                      )}
                      onClick={() => handleSort('mem_percent')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Memory
                        {sortField === 'mem_percent' && <SortIcon className="h-3 w-3" />}
                      </span>
                    </th>
                    <th
                      className={cn(
                        'cursor-pointer px-4 py-2 text-right font-medium hover:text-text-primary',
                        sortField === 'cpu_percent' && 'text-text-primary'
                      )}
                      onClick={() => handleSort('cpu_percent')}
                    >
                      <span className="inline-flex items-center gap-1">
                        CPU
                        {sortField === 'cpu_percent' && <SortIcon className="h-3 w-3" />}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProcesses.map((proc) => (
                    <tr
                      key={proc.pid}
                      className="border-b border-tertiary/50 last:border-0 hover:bg-tertiary/30"
                    >
                      <td className="px-4 py-2 font-mono text-text-tertiary">{proc.pid}</td>
                      <td className="max-w-xs truncate px-4 py-2 text-text-primary" title={proc.command}>
                        {proc.command}
                      </td>
                      <td className="px-4 py-2 text-text-tertiary">{proc.user}</td>
                      <td className="px-4 py-2 text-right font-mono text-text-primary">
                        {proc.mem_percent.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-text-primary">
                        {proc.cpu_percent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
