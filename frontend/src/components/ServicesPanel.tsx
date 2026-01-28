import { useState, useEffect, useCallback } from 'react';
import { Boxes, Settings } from 'lucide-react';
import { getServerServices, restartService } from '../api/services';
import { getActions } from '../api/actions';
import { ServiceCard } from './ServiceCard';
import { ServiceManagementModal } from './ServiceManagementModal';
import { ApiError } from '../api/client';
import type { ExpectedService } from '../types/service';
import type { ServerDetail } from '../types/server';

interface ServicesPanelProps {
  serverId: string;
  /** Whether the server is inactive (agent removed) */
  isInactive?: boolean;
  /** Agent mode - when 'readonly', actions are disabled (BG0017) */
  agentMode?: 'readonly' | 'readwrite' | null;
  /** Server details for service management modal */
  server?: ServerDetail;
}

const POLLING_INTERVAL = 30000; // 30 seconds

/**
 * Panel displaying expected services for a server.
 * Fetches and polls service data independently.
 */
export function ServicesPanel({ serverId, isInactive = false, agentMode, server }: ServicesPanelProps) {
  const isReadonly = agentMode === 'readonly';
  const [services, setServices] = useState<ExpectedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restartingServices, setRestartingServices] = useState<Set<string>>(new Set());
  const [queuedServices, setQueuedServices] = useState<Set<string>>(new Set());
  const [restartMessage, setRestartMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);

  const fetchServices = useCallback(async (showLoading = false, ignore = false) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const [servicesData, actionsData] = await Promise.all([
        getServerServices(serverId),
        getActions({ server_id: serverId }), // Fetch all actions for this server
      ]);
      if (!ignore) {
        setServices(servicesData.services);
        // Track which services have in-progress restart actions (pending, approved, executing)
        const queued = new Set<string>();
        for (const action of actionsData.actions) {
          if (
            action.action_type === 'restart_service' &&
            action.service_name &&
            ['pending', 'approved', 'executing'].includes(action.status)
          ) {
            queued.add(action.service_name);
          }
        }
        setQueuedServices(queued);
      }
    } catch (err) {
      if (!ignore) {
        setError(err instanceof Error ? err.message : 'Failed to fetch services');
      }
    } finally {
      if (!ignore) {
        setLoading(false);
      }
    }
  }, [serverId]);

  useEffect(() => {
    let ignore = false;

    fetchServices(true, ignore);

    const interval = setInterval(() => {
      if (!ignore) {
        fetchServices(false, ignore);
      }
    }, POLLING_INTERVAL);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [fetchServices]);

  const handleRestart = useCallback(async (serviceName: string) => {
    setRestartingServices((prev) => new Set(prev).add(serviceName));
    setRestartMessage(null);

    try {
      const result = await restartService(serverId, serviceName);
      if (result.status === 'pending') {
        setRestartMessage({
          type: 'info',
          text: `Restart pending approval for ${serviceName} (server in maintenance mode)`,
        });
        // Add to queued services so button shows "Queued"
        setQueuedServices((prev) => new Set(prev).add(serviceName));
      } else {
        setRestartMessage({ type: 'success', text: `Restarting ${serviceName}...` });
      }
      // Auto-clear message after 5 seconds
      setTimeout(() => setRestartMessage(null), 5000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRestartMessage({ type: 'info', text: `Restart already pending for ${serviceName}` });
        // Also mark as queued since there's a pending action
        setQueuedServices((prev) => new Set(prev).add(serviceName));
      } else {
        setRestartMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to queue restart',
        });
      }
      // Auto-clear info/error message after 5 seconds
      setTimeout(() => setRestartMessage(null), 5000);
    } finally {
      setRestartingServices((prev) => {
        const next = new Set(prev);
        next.delete(serviceName);
        return next;
      });
    }
  }, [serverId]);

  return (
    <div
      className="rounded-lg border border-border-default bg-bg-secondary p-6"
      data-testid="services-panel"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-text-secondary" />
          <h2 className="text-lg font-semibold text-text-primary">Services</h2>
        </div>
        {server && !isInactive && (
          <button
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            title="Manage Services"
            data-testid="manage-services-button"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Manage</span>
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && services.length === 0 && (
        <div className="flex items-center justify-center py-8" data-testid="services-loading">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
        </div>
      )}

      {/* Error state */}
      {error && services.length === 0 && (
        <div className="py-8 text-center text-status-error" data-testid="services-error">
          {error}
        </div>
      )}

      {/* Inactive state (BG0011) */}
      {isInactive && (
        <div className="py-8 text-center" data-testid="services-inactive">
          <p className="text-text-tertiary">Agent Inactive</p>
          <p className="mt-1 text-sm text-text-tertiary">
            Service monitoring unavailable - agent has been removed.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !isInactive && services.length === 0 && (
        <div className="py-8 text-center text-text-secondary" data-testid="services-empty">
          No services configured for this server.
        </div>
      )}

      {/* Restart feedback message */}
      {restartMessage && (
        <div
          className={`mb-4 rounded-md p-3 text-sm ${
            restartMessage.type === 'success'
              ? 'bg-status-success/10 text-status-success'
              : restartMessage.type === 'info'
                ? 'bg-status-info/10 text-status-info'
                : 'bg-status-error/10 text-status-error'
          }`}
          data-testid="restart-message"
        >
          {restartMessage.text}
        </div>
      )}

      {/* Services list */}
      {!isInactive && services.length > 0 && (
        <div className="space-y-3" data-testid="services-list">
          {services.map((service) => (
            <ServiceCard
              key={service.service_name}
              service={service}
              onRestart={() => handleRestart(service.service_name)}
              isRestarting={restartingServices.has(service.service_name)}
              isQueued={queuedServices.has(service.service_name)}
              isReadonly={isReadonly}
            />
          ))}
        </div>
      )}

      {/* Service Management Modal */}
      {showManageModal && server && (
        <ServiceManagementModal
          server={server}
          onClose={() => setShowManageModal(false)}
          onServicesChanged={() => fetchServices(false)}
        />
      )}
    </div>
  );
}
