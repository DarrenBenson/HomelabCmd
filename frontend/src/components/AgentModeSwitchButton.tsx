/**
 * Button component for switching agent mode remotely.
 *
 * US0188: Remote Agent Mode Switch
 */

import { useState } from 'react';
import { Loader2, ShieldCheck, Shield } from 'lucide-react';
import { switchAgentMode } from '../api/agents';
import { cn } from '../lib/utils';
import type { AgentMode } from '../types/agent';

interface AgentModeSwitchButtonProps {
  serverId: string;
  currentMode: AgentMode;
  sshConfigured: boolean;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function AgentModeSwitchButton({
  serverId,
  currentMode,
  sshConfigured,
  onSuccess,
  onError,
}: AgentModeSwitchButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [sudoPassword, setSudoPassword] = useState('');

  const targetMode: AgentMode = currentMode === 'readonly' ? 'readwrite' : 'readonly';
  const isUpgrade = targetMode === 'readwrite';

  const handleClick = () => {
    // Show password prompt for potential sudo requirement
    setShowPasswordPrompt(true);
  };

  const handleSwitch = async (withPassword: boolean) => {
    setLoading(true);
    setShowPasswordPrompt(false);

    try {
      const result = await switchAgentMode(serverId, {
        mode: targetMode,
        sudo_password: withPassword ? sudoPassword : undefined,
      });

      if (result.success) {
        onSuccess();
      } else {
        onError(result.error || 'Mode switch failed');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Mode switch failed');
    } finally {
      setLoading(false);
      setSudoPassword('');
    }
  };

  const handleCancel = () => {
    setShowPasswordPrompt(false);
    setSudoPassword('');
  };

  // Don't show button if SSH isn't configured
  if (!sshConfigured) {
    return (
      <div
        className="text-xs text-text-tertiary"
        title="SSH key must be configured in Settings to switch mode"
        data-testid="mode-switch-disabled-notice"
      >
        SSH not configured
      </div>
    );
  }

  // Password prompt dialog
  if (showPasswordPrompt) {
    return (
      <div className="space-y-2" data-testid="mode-switch-password-prompt">
        <div className="text-xs text-text-secondary">
          Switch to <strong>{targetMode}</strong> mode?
        </div>
        <div className="space-y-1">
          <input
            type="password"
            placeholder="Sudo password (optional)"
            value={sudoPassword}
            onChange={(e) => setSudoPassword(e.target.value)}
            className="w-full rounded-md border border-border-default bg-bg-tertiary px-2 py-1 text-xs text-text-primary placeholder-text-tertiary focus:border-status-info focus:outline-none"
            data-testid="mode-switch-password-input"
          />
          <div className="text-xs text-text-tertiary">
            Leave empty if passwordless sudo is configured
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSwitch(!!sudoPassword)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              isUpgrade
                ? 'bg-status-success text-white hover:bg-status-success/80'
                : 'bg-text-tertiary text-white hover:bg-text-tertiary/80'
            )}
            data-testid="mode-switch-confirm"
          >
            Switch
          </button>
          <button
            onClick={handleCancel}
            className="rounded-md bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary"
            data-testid="mode-switch-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
        isUpgrade
          ? 'bg-status-success/10 text-status-success hover:bg-status-success/20'
          : 'bg-text-tertiary/10 text-text-tertiary hover:bg-text-tertiary/20',
        loading && 'opacity-50 cursor-not-allowed'
      )}
      data-testid="mode-switch-button"
      title={`Switch to ${targetMode} mode`}
    >
      {loading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Switching...
        </>
      ) : isUpgrade ? (
        <>
          <ShieldCheck className="h-3 w-3" />
          Enable Read/Write
        </>
      ) : (
        <>
          <Shield className="h-3 w-3" />
          Switch to Read Only
        </>
      )}
    </button>
  );
}
