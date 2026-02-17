import { useState, useEffect, useCallback } from 'react';
import { Container, RefreshCw, ChevronDown, ChevronRight, Play, Square, RotateCw, X } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { cn } from '../../lib/utils';
import { getContainers, startContainer, stopContainer, restartContainer } from '../../api/containers';
import type { WidgetProps } from './types';
import type { ContainerInfo, ContainerState } from '../../types/container';

interface ContainersWidgetProps extends WidgetProps {
  isEditMode?: boolean;
  onRemove?: () => void;
}

const POLLING_INTERVAL = 60000; // 60 seconds (AC7)

/**
 * Get status indicator colour based on container state (AC4).
 */
function getStateColour(state: ContainerState): { bg: string; ring: string } {
  switch (state) {
    case 'running':
      return { bg: 'bg-status-success', ring: 'ring-status-success/30' };
    case 'exited':
    case 'created':
    case 'paused':
      return { bg: 'bg-text-muted', ring: 'ring-text-muted/30' };
    case 'restarting':
      return { bg: 'bg-status-warning', ring: 'ring-status-warning/30' };
    case 'dead':
    default:
      return { bg: 'bg-status-error', ring: 'ring-status-error/30' };
  }
}

/**
 * Format uptime seconds to human-readable string.
 */
function formatUptime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '-';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

/**
 * Truncate image name for display.
 */
function truncateImage(image: string, maxLen = 25): string {
  if (image.length <= maxLen) return image;
  // Try to show the tag if present
  const parts = image.split(':');
  if (parts.length === 2 && parts[1].length < 10) {
    const name = parts[0];
    const tag = parts[1];
    const availableLen = maxLen - tag.length - 4; // 3 for "..." + 1 for ":"
    if (availableLen > 5) {
      return `${name.substring(0, availableLen)}...:${tag}`;
    }
  }
  return `${image.substring(0, maxLen - 3)}...`;
}

interface ContainerRowProps {
  container: ContainerInfo;
  onStartAction?: (containerId: string) => Promise<void>;
  onStopAction?: (containerId: string) => void;
  onRestartAction?: (containerId: string) => Promise<void>;
  isStarting?: boolean;
  isStopping?: boolean;
  isRestarting?: boolean;
}

/**
 * Container row with expandable details (AC8) and action buttons (US0160, US0161, US0162).
 */
function ContainerRow({ container, onStartAction, onStopAction, onRestartAction, isStarting, isStopping, isRestarting }: ContainerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { bg } = getStateColour(container.state);
  const canStart = container.state !== 'running' && container.state !== 'restarting';
  const canStop = container.state === 'running';
  const canRestart = container.state === 'running' || container.state === 'exited';

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger expand
    if (onStartAction) {
      await onStartAction(container.name);
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger expand
    if (onStopAction) {
      onStopAction(container.name);
    }
  };

  const handleRestart = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger expand
    if (onRestartAction) {
      await onRestartAction(container.name);
    }
  };

  return (
    <div className="border-b border-border-default last:border-b-0">
      {/* Main row - using div with onClick instead of nested buttons */}
      <div
        className="flex w-full items-center gap-2 px-2 py-1.5 hover:bg-bg-tertiary cursor-pointer"
        data-testid={`container-${container.name}`}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        {/* Expand/collapse indicator */}
        {expanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-text-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-text-muted" />
        )}

        {/* Status indicator (AC4) */}
        <span
          className={cn('h-2 w-2 flex-shrink-0 rounded-full', bg)}
          data-testid={`container-status-${container.name}`}
        />

        {/* Container name */}
        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
          {container.name}
        </span>

        {/* Image (truncated) (AC5) */}
        <span
          className="hidden text-xs text-text-secondary sm:block"
          title={container.image}
        >
          {truncateImage(container.image)}
        </span>

        {/* Uptime or status (AC6) */}
        <span className="flex-shrink-0 text-xs text-text-muted">
          {container.state === 'running'
            ? formatUptime(container.uptime_seconds)
            : container.status.split(' ').slice(0, 2).join(' ')}
        </span>

        {/* Start button (US0160) - only for stopped containers */}
        {canStart && onStartAction && (
          <button
            onClick={handleStart}
            disabled={isStarting}
            className={cn(
              'ml-1 flex-shrink-0 rounded p-1 text-status-success hover:bg-status-success/10 transition-colors',
              isStarting && 'opacity-50 cursor-not-allowed'
            )}
            title="Start container"
            data-testid={`container-start-${container.name}`}
          >
            {isStarting ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border border-status-success border-t-transparent" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Stop button (US0161) - only for running containers */}
        {canStop && onStopAction && (
          <button
            onClick={handleStop}
            disabled={isStopping}
            className={cn(
              'ml-1 flex-shrink-0 rounded p-1 text-status-error hover:bg-status-error/10 transition-colors',
              isStopping && 'opacity-50 cursor-not-allowed'
            )}
            title="Stop container"
            data-testid={`container-stop-${container.name}`}
          >
            {isStopping ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border border-status-error border-t-transparent" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Restart button (US0162) - for running or exited containers */}
        {canRestart && onRestartAction && (
          <button
            onClick={handleRestart}
            disabled={isRestarting}
            className={cn(
              'ml-1 flex-shrink-0 rounded p-1 text-status-warning hover:bg-status-warning/10 transition-colors',
              isRestarting && 'opacity-50 cursor-not-allowed'
            )}
            title="Restart container"
            data-testid={`container-restart-${container.name}`}
          >
            {isRestarting ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border border-status-warning border-t-transparent" />
            ) : (
              <RotateCw className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Expanded details (AC8) */}
      {expanded && (
        <div
          className="bg-bg-tertiary px-6 py-2 text-xs text-text-secondary"
          data-testid={`container-details-${container.name}`}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-text-muted">Image:</span>
            <span className="break-all">{container.image}</span>

            <span className="text-text-muted">Status:</span>
            <span>{container.status}</span>

            {container.ports && (
              <>
                <span className="text-text-muted">Ports:</span>
                <span>{container.ports}</span>
              </>
            )}

            <span className="text-text-muted">ID:</span>
            <span className="font-mono">{container.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Containers Widget
 *
 * Displays Docker containers with status indicators and expandable details.
 * Only shown for machines with has_docker=true (AC2).
 * Refreshes every 60 seconds (AC7).
 * Provides start action for stopped containers (US0160).
 */
export function ContainersWidget({
  machine,
  isEditMode = false,
  onRemove,
}: ContainersWidgetProps) {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [startingContainers, setStartingContainers] = useState<Set<string>>(new Set());
  const [stoppingContainers, setStoppingContainers] = useState<Set<string>>(new Set());
  const [restartingContainers, setRestartingContainers] = useState<Set<string>>(new Set());
  const [confirmStop, setConfirmStop] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const displayedContainers = showAll ? containers : containers.slice(0, 5);

  // Fetch containers
  const fetchContainers = useCallback(async (showLoading = false, forceRefresh = false) => {
    if (showLoading) {
      setLoading(true);
    }
    if (forceRefresh) {
      setRefreshing(true);
    }
    setError(null);

    try {
      const response = await getContainers(machine.id, forceRefresh);
      if (response.error) {
        setError(response.error);
      } else {
        setContainers(response.containers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch containers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [machine.id]);

  // Initial fetch and polling (AC7)
  useEffect(() => {
    fetchContainers(true);

    const interval = setInterval(() => {
      fetchContainers(false);
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchContainers]);

  // Handle container start action (US0160)
  const handleStartContainer = useCallback(async (containerId: string) => {
    setStartingContainers(prev => new Set(prev).add(containerId));
    setActionMessage(null);

    try {
      const result = await startContainer(machine.id, containerId);
      if (result.success) {
        setActionMessage({ type: 'success', text: `Started ${containerId}` });
        // Refresh container list (AC5)
        fetchContainers(false, true);
      } else {
        setActionMessage({ type: 'error', text: result.output || `Failed to start ${containerId}` });
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to start ${containerId}`,
      });
    } finally {
      setStartingContainers(prev => {
        const next = new Set(prev);
        next.delete(containerId);
        return next;
      });
      // Auto-clear message after 5 seconds
      setTimeout(() => setActionMessage(null), 5000);
    }
  }, [machine.id, fetchContainers]);

  // Show confirmation dialog for stop (US0161 AC6)
  const handleStopClick = useCallback((containerId: string) => {
    setConfirmStop(containerId);
  }, []);

  // Handle confirmed container stop action (US0161)
  const handleConfirmStop = useCallback(async () => {
    if (!confirmStop) return;

    const containerId = confirmStop;
    setConfirmStop(null);
    setStoppingContainers(prev => new Set(prev).add(containerId));
    setActionMessage(null);

    try {
      const result = await stopContainer(machine.id, containerId);
      if (result.success) {
        setActionMessage({ type: 'success', text: `Stopped ${containerId}` });
        // Refresh container list (AC5)
        fetchContainers(false, true);
      } else {
        setActionMessage({ type: 'error', text: result.output || `Failed to stop ${containerId}` });
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to stop ${containerId}`,
      });
    } finally {
      setStoppingContainers(prev => {
        const next = new Set(prev);
        next.delete(containerId);
        return next;
      });
      // Auto-clear message after 5 seconds
      setTimeout(() => setActionMessage(null), 5000);
    }
  }, [confirmStop, machine.id, fetchContainers]);

  // Handle container restart action (US0162)
  const handleRestartContainer = useCallback(async (containerId: string) => {
    setRestartingContainers(prev => new Set(prev).add(containerId));
    setActionMessage(null);

    try {
      const result = await restartContainer(machine.id, containerId);
      if (result.success) {
        setActionMessage({ type: 'success', text: `Restarted ${containerId}` });
        // Refresh container list (AC4)
        fetchContainers(false, true);
      } else {
        setActionMessage({ type: 'error', text: result.output || `Failed to restart ${containerId}` });
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to restart ${containerId}`,
      });
    } finally {
      setRestartingContainers(prev => {
        const next = new Set(prev);
        next.delete(containerId);
        return next;
      });
      // Auto-clear message after 5 seconds
      setTimeout(() => setActionMessage(null), 5000);
    }
  }, [machine.id, fetchContainers]);

  // Count containers by state
  const runningCount = containers.filter(c => c.state === 'running').length;
  const stoppedCount = containers.length - runningCount;

  return (
    <WidgetContainer
      title="Containers"
      icon={<Container className="h-4 w-4" />}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      <div className="flex h-full flex-col">
        {/* Header with summary and refresh button */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-status-success" data-testid="containers-running-count">
              {runningCount} running
            </span>
            {stoppedCount > 0 && (
              <span className="text-text-muted" data-testid="containers-stopped-count">
                {stoppedCount} stopped
              </span>
            )}
          </div>
          <button
            onClick={() => fetchContainers(false, true)}
            disabled={refreshing}
            className="rounded p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50"
            title="Refresh"
            data-testid="containers-refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Loading state */}
        {loading && containers.length === 0 && (
          <div className="flex flex-1 items-center justify-center" data-testid="containers-loading">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
          </div>
        )}

        {/* Error state */}
        {error && containers.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-status-error" data-testid="containers-error">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && containers.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-text-secondary" data-testid="containers-empty">
            No containers found
          </div>
        )}

        {/* Action feedback message (US0160 AC6) */}
        {actionMessage && (
          <div
            className={cn(
              'mb-2 rounded-md px-3 py-2 text-xs',
              actionMessage.type === 'success'
                ? 'bg-status-success/10 text-status-success'
                : 'bg-status-error/10 text-status-error'
            )}
            data-testid="container-action-message"
          >
            {actionMessage.text}
          </div>
        )}

        {/* Container list (AC3) */}
        {containers.length > 0 && (
          <div className="flex-1 overflow-auto rounded border border-border-default" data-testid="containers-list">
            {displayedContainers.map((container) => (
              <ContainerRow
                key={container.id}
                container={container}
                onStartAction={handleStartContainer}
                onStopAction={handleStopClick}
                onRestartAction={handleRestartContainer}
                isStarting={startingContainers.has(container.name)}
                isStopping={stoppingContainers.has(container.name)}
                isRestarting={restartingContainers.has(container.name)}
              />
            ))}
          </div>
        )}

        {/* Show more/less toggle */}
        {containers.length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-2 flex items-center justify-center gap-1 text-xs text-text-secondary hover:text-text-primary"
            data-testid="containers-toggle"
          >
            <span>{showAll ? 'Show less' : `Show all (${containers.length})`}</span>
            <ChevronRight className={cn('h-3 w-3 transition-transform', showAll && 'rotate-90')} />
          </button>
        )}

        {/* Stop confirmation dialog (US0161 AC6) */}
        {confirmStop && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            data-testid="stop-confirm-dialog"
          >
            <div className="mx-4 w-full max-w-sm rounded-lg bg-bg-primary p-4 shadow-lg">
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-sm font-medium text-text-primary">Stop Container</h3>
                <button
                  onClick={() => setConfirmStop(null)}
                  className="rounded p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  data-testid="stop-confirm-close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-4 text-sm text-text-secondary">
                Are you sure you want to stop <span className="font-medium text-text-primary">{confirmStop}</span>?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmStop(null)}
                  className="rounded px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  data-testid="stop-confirm-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStop}
                  className="rounded bg-status-error px-3 py-1.5 text-sm text-white hover:bg-status-error/90"
                  data-testid="stop-confirm-button"
                >
                  Stop Container
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}
