import { Monitor, Server } from 'lucide-react';
import { formatUptime, formatCost } from '../../lib/formatters';
import { CategoryBadge } from '../CategoryBadge';
import { WidgetContainer } from './WidgetContainer';
import type { WidgetProps } from './types';
import type { MachineCategory } from '../../types/cost';

type MachineSource = 'auto' | 'user' | null;

interface SystemInfoWidgetProps extends WidgetProps {
  isEditMode?: boolean;
  onRemove?: () => void;
  tdpWatts?: number | null;
  idleWatts?: number | null;
  machineCategory?: MachineCategory | null;
  machineCategorySource?: MachineSource | null;
  estimatedPower?: number | null;
  dailyCost?: number | null;
  currencySymbol?: string;
  onPowerEdit?: () => void;
}

/**
 * System Information Widget
 *
 * Displays OS, kernel, architecture, CPU info, uptime, and power configuration.
 */
export function SystemInfoWidget({
  machine,
  isEditMode = false,
  onRemove,
  tdpWatts,
  machineCategory,
  machineCategorySource,
  estimatedPower,
  dailyCost,
  currencySymbol = '£',
  onPowerEdit,
}: SystemInfoWidgetProps) {
  const metrics = machine.latest_metrics;

  return (
    <WidgetContainer
      title="System"
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      <div className="space-y-3">
        {/* Hostname and machine type */}
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Hostname</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-text-primary" data-testid="hostname">
              {machine.hostname}
            </span>
            {machine.machine_type && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-0.5 text-xs text-text-secondary"
                data-testid="machine-type-badge"
                title={machine.machine_type === 'server' ? 'Server' : 'Workstation'}
              >
                {machine.machine_type === 'server' ? (
                  <Server className="h-3 w-3" />
                ) : (
                  <Monitor className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">OS</span>
          <span className="font-mono text-text-primary" data-testid="os-info">
            {machine.os_distribution || '--'} {machine.os_version || ''}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Kernel</span>
          <span className="font-mono text-text-primary" data-testid="kernel-version">
            {machine.kernel_version || '--'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Architecture</span>
          <span className="font-mono text-text-primary" data-testid="architecture">
            {machine.architecture || '--'}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-text-secondary shrink-0">CPU</span>
          <span
            className="truncate font-mono text-text-primary text-right"
            data-testid="cpu-model"
          >
            {machine.cpu_model || '--'}
          </span>
        </div>

        {machine.cpu_cores && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Cores</span>
            <span className="font-mono text-text-primary" data-testid="cpu-cores">
              {machine.cpu_cores}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-text-secondary">Uptime</span>
          <span className="font-mono text-text-primary" data-testid="uptime">
            {formatUptime(metrics?.uptime_seconds ?? null)}
          </span>
        </div>

        {/* Network identity */}
        {machine.ip_address && (
          <div className="flex justify-between">
            <span className="text-text-secondary">IP Address</span>
            <span className="font-mono text-text-primary" data-testid="ip-address">
              {machine.ip_address}
            </span>
          </div>
        )}

        {machine.tailscale_hostname && (
          <div className="flex justify-between gap-4">
            <span className="text-text-secondary shrink-0">Tailscale</span>
            <span className="truncate font-mono text-text-primary text-right" data-testid="tailscale-hostname">
              {machine.tailscale_hostname}
            </span>
          </div>
        )}

        {/* Power Configuration */}
        {(machineCategory || tdpWatts !== null) && (
          <div className="border-t border-border-default pt-3 mt-3">
            <div className="space-y-3">
              {machineCategory && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Category</span>
                  <div className="flex items-center gap-2">
                    <CategoryBadge
                      label={machineCategory}
                      source={machineCategorySource ?? null}
                    />
                    {onPowerEdit && (
                      <button
                        onClick={onPowerEdit}
                        className="rounded-md bg-bg-tertiary px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                        data-testid="power-edit-button"
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>
              )}

              {estimatedPower !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Est. Power</span>
                  <span
                    className="font-mono text-text-primary"
                    data-testid="tdp-display"
                  >
                    {estimatedPower}W
                  </span>
                </div>
              )}

              {dailyCost !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Est. Cost</span>
                  <span className="font-mono text-status-success" data-testid="daily-cost">
                    {formatCost(dailyCost ?? null, currencySymbol)}/day
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}
