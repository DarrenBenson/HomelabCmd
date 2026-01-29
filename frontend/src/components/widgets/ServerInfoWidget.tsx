import { StatusLED } from '../StatusLED';
import { cn } from '../../lib/utils';
import { formatRelativeTime } from '../../lib/formatters';
import { WidgetContainer } from './WidgetContainer';
import type { WidgetProps } from './types';
import type { SSHTestResponse } from '../../types/ssh';

interface ServerInfoWidgetProps extends WidgetProps {
  isEditMode?: boolean;
  onRemove?: () => void;
  onToggleMaintenance?: () => void;
  onTestSSH?: () => void;
  pauseLoading?: boolean;
  sshTesting?: boolean;
  sshTestResult?: SSHTestResponse | null;
}

/**
 * Server Information Widget
 *
 * Displays server status, hostname, IP, Tailscale info, last seen,
 * and maintenance mode controls.
 */
export function ServerInfoWidget({
  machine,
  isEditMode = false,
  onRemove,
  onToggleMaintenance,
  onTestSSH,
  pauseLoading = false,
  sshTesting = false,
  sshTestResult,
}: ServerInfoWidgetProps) {
  return (
    <WidgetContainer
      title="Server Information"
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <StatusLED status={machine.status} />
          <span className="text-text-primary capitalize">{machine.status}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Hostname</span>
          <span className="font-mono text-text-primary" data-testid="hostname">
            {machine.hostname}
          </span>
        </div>

        {machine.ip_address && (
          <div className="flex justify-between">
            <span className="text-text-secondary">IP Address</span>
            <span className="font-mono text-text-primary" data-testid="ip-address">
              {machine.ip_address}
            </span>
          </div>
        )}

        {machine.tailscale_hostname && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-text-secondary">Tailscale</span>
              <span className="font-mono text-text-primary" data-testid="tailscale-hostname">
                {machine.tailscale_hostname}
              </span>
            </div>
            {onTestSSH && (
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onTestSSH}
                  disabled={sshTesting}
                  className="px-3 py-1 text-xs font-medium rounded bg-status-info/20 text-status-info hover:bg-status-info/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="test-ssh-button"
                >
                  {sshTesting ? 'Testing...' : 'Test SSH'}
                </button>
              </div>
            )}
            {sshTestResult && (
              <div
                className={cn(
                  'rounded-md p-3 text-sm',
                  sshTestResult.success
                    ? 'bg-status-success/10 border border-status-success/30'
                    : 'bg-status-error/10 border border-status-error/30'
                )}
                data-testid="ssh-test-result"
              >
                {sshTestResult.success ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-status-success">
                      <span className="font-medium">Connected</span>
                    </div>
                    <div className="text-text-secondary">
                      Latency: {sshTestResult.latency_ms}ms
                    </div>
                    {sshTestResult.host_key_fingerprint && (
                      <div className="font-mono text-xs text-text-tertiary truncate" title={sshTestResult.host_key_fingerprint}>
                        {sshTestResult.host_key_fingerprint}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-status-error">
                    <span className="font-medium">Failed:</span>{' '}
                    {sshTestResult.error}
                    {sshTestResult.attempts > 1 && (
                      <span className="text-text-tertiary"> ({sshTestResult.attempts} attempts)</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-text-secondary">Last Seen</span>
          <span className="font-mono text-text-primary" data-testid="last-seen">
            {formatRelativeTime(machine.last_seen ?? null)}
          </span>
        </div>

        {/* Maintenance Mode */}
        {onToggleMaintenance && (
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Maintenance Mode</span>
            <div className="flex items-center gap-3">
              <span
                className={machine.is_paused ? 'text-status-warning' : 'text-text-primary'}
                data-testid="maintenance-status"
              >
                {machine.is_paused ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={onToggleMaintenance}
                disabled={pauseLoading}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-colors',
                  machine.is_paused
                    ? 'bg-status-success/20 text-status-success hover:bg-status-success/30'
                    : 'bg-status-warning/20 text-status-warning hover:bg-status-warning/30',
                  pauseLoading && 'opacity-50 cursor-not-allowed'
                )}
                data-testid="maintenance-toggle"
              >
                {pauseLoading ? '...' : machine.is_paused ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}
