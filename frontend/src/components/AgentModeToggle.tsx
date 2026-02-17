/**
 * Toggle switch component for switching agent mode.
 *
 * Simplified toggle that attempts the switch directly without password prompt.
 * If sudo password is needed and not configured, the backend will return an error.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { switchAgentMode } from '../api/agents';
import { cn } from '../lib/utils';
import type { AgentMode } from '../types/agent';

interface AgentModeToggleProps {
  serverId: string;
  currentMode: AgentMode;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function AgentModeToggle({
  serverId,
  currentMode,
  onSuccess,
  onError,
}: AgentModeToggleProps) {
  const [loading, setLoading] = useState(false);

  const isReadWrite = currentMode === 'readwrite';
  const targetMode: AgentMode = isReadWrite ? 'readonly' : 'readwrite';

  const handleToggle = async () => {
    setLoading(true);

    try {
      const result = await switchAgentMode(serverId, { mode: targetMode });

      if (result.success) {
        onSuccess();
      } else {
        onError(result.error || 'Mode switch failed');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Mode switch failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-text-secondary">Read/Write Mode</span>
      <div className="flex items-center justify-end gap-2 w-[72px]">
        <button
          onClick={handleToggle}
          disabled={loading}
          className={cn(
            'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
            isReadWrite ? 'bg-status-success' : 'bg-text-tertiary',
            loading && 'opacity-50 cursor-not-allowed'
          )}
          data-testid="agent-mode-toggle"
          aria-label={isReadWrite ? 'Disable read/write mode' : 'Enable read/write mode'}
        >
          {loading ? (
            <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
          ) : (
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                isReadWrite ? 'translate-x-5' : 'translate-x-1'
              )}
            />
          )}
        </button>
        <span className="text-xs text-text-tertiary w-6">
          {isReadWrite ? 'On' : 'Off'}
        </span>
      </div>
    </div>
  );
}
