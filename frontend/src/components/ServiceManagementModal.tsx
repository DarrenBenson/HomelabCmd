/**
 * Modal for managing expected services on a server.
 *
 * Provides service discovery via SSH and CRUD operations for expected services.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  Search,
  Plus,
  Pencil,
  Trash2,
  Check,
  XCircle,
} from 'lucide-react';
import {
  discoverServices,
  createExpectedService,
  updateExpectedService,
  deleteExpectedService,
  getServerServices,
} from '../api/services';
import { listSSHKeys } from '../api/scans';
import type {
  DiscoveredService,
  ExpectedService,
  ExpectedServiceCreate,
} from '../types/service';
import type { SSHKeyMetadata } from '../types/scan';
import type { ServerDetail } from '../types/server';
import { cn } from '../lib/utils';

interface ServiceManagementModalProps {
  /** Server to manage services for */
  server: ServerDetail;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when services are modified */
  onServicesChanged?: () => void;
}

interface SelectedService {
  name: string;
  isCritical: boolean;
}

export function ServiceManagementModal({
  server,
  onClose,
  onServicesChanged,
}: ServiceManagementModalProps) {
  // SSH keys state
  const [sshKeys, setSSHKeys] = useState<SSHKeyMetadata[]>([]);
  const [sshKeysLoading, setSSHKeysLoading] = useState(true);
  const [selectedKeyId, setSelectedKeyId] = useState<string>(''); // Empty = attempt all keys

  // Discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discoveredServices, setDiscoveredServices] = useState<DiscoveredService[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<Map<string, SelectedService>>(
    new Map()
  );

  // Manual add state
  const [manualServiceName, setManualServiceName] = useState('');
  const [manualDisplayName, setManualDisplayName] = useState('');
  const [manualIsCritical, setManualIsCritical] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Current services state
  const [currentServices, setCurrentServices] = useState<ExpectedService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editIsCritical, setEditIsCritical] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [updatingService, setUpdatingService] = useState<string | null>(null);
  const [deletingService, setDeletingService] = useState<string | null>(null);

  // General state
  const [addingSelected, setAddingSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load SSH keys and current services on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [keysResponse, servicesData] = await Promise.all([
          listSSHKeys(),
          getServerServices(server.id),
        ]);
        setSSHKeys(keysResponse.keys);
        setCurrentServices(servicesData.services);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoadingServices(false);
        setSSHKeysLoading(false);
      }
    }

    loadInitialData();
  }, [server.id]);

  const refreshServices = useCallback(async () => {
    try {
      const servicesData = await getServerServices(server.id);
      setCurrentServices(servicesData.services);
      onServicesChanged?.();
    } catch (err) {
      console.error('Failed to refresh services:', err);
    }
  }, [server.id, onServicesChanged]);

  // Discover services via SSH
  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoveryError(null);
    setDiscoveredServices([]);
    setSelectedServices(new Map());

    try {
      // Use tailscale_hostname if available, otherwise hostname
      const hostname = server.tailscale_hostname || server.hostname;
      // Find selected key's username if specified
      const selectedKey = selectedKeyId
        ? sshKeys.find((k) => k.id === selectedKeyId)
        : null;
      const username = server.ssh_username || selectedKey?.username || 'root';

      const result = await discoverServices({
        hostname,
        port: 22,
        username,
        key_id: selectedKeyId || null,
      });

      // Filter out services we're already monitoring
      const monitoredNames = new Set(currentServices.map((s) => s.service_name));
      const newServices = result.services.filter((s) => !monitoredNames.has(s.name));
      setDiscoveredServices(newServices);

      if (newServices.length === 0 && result.services.length > 0) {
        setDiscoveryError('All discovered services are already being monitored.');
      }
    } catch (err) {
      setDiscoveryError(
        err instanceof Error ? err.message : 'Failed to discover services'
      );
    } finally {
      setDiscovering(false);
    }
  };

  // Toggle service selection
  const toggleServiceSelection = (name: string) => {
    setSelectedServices((prev) => {
      const next = new Map(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.set(name, { name, isCritical: false });
      }
      return next;
    });
  };

  // Update criticality for selected service
  const updateSelectedCriticality = (name: string, isCritical: boolean) => {
    setSelectedServices((prev) => {
      const next = new Map(prev);
      const service = next.get(name);
      if (service) {
        next.set(name, { ...service, isCritical });
      }
      return next;
    });
  };

  // Add selected services
  const handleAddSelected = async () => {
    if (selectedServices.size === 0) return;

    setAddingSelected(true);
    setError(null);

    try {
      const createPromises = Array.from(selectedServices.values()).map((service) =>
        createExpectedService(server.id, {
          service_name: service.name,
          is_critical: service.isCritical,
        })
      );

      await Promise.all(createPromises);
      await refreshServices();

      // Clear selection and discovered services
      setSelectedServices(new Map());
      // Remove added services from discovered list
      const addedNames = new Set(selectedServices.keys());
      setDiscoveredServices((prev) => prev.filter((s) => !addedNames.has(s.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add services');
    } finally {
      setAddingSelected(false);
    }
  };

  // Add manual service
  const handleAddManual = async () => {
    if (!manualServiceName.trim()) return;

    setAddingManual(true);
    setManualError(null);

    try {
      const data: ExpectedServiceCreate = {
        service_name: manualServiceName.trim().toLowerCase(),
        is_critical: manualIsCritical,
      };
      if (manualDisplayName.trim()) {
        data.display_name = manualDisplayName.trim();
      }

      await createExpectedService(server.id, data);
      await refreshServices();

      // Clear form
      setManualServiceName('');
      setManualDisplayName('');
      setManualIsCritical(false);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Failed to add service');
    } finally {
      setAddingManual(false);
    }
  };

  // Start editing a service
  const startEditing = (service: ExpectedService) => {
    setEditingService(service.service_name);
    setEditIsCritical(service.is_critical);
    setEditDisplayName(service.display_name || '');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingService(null);
    setEditIsCritical(false);
    setEditDisplayName('');
  };

  // Save service edit
  const handleSaveEdit = async (serviceName: string) => {
    setUpdatingService(serviceName);

    try {
      await updateExpectedService(server.id, serviceName, {
        is_critical: editIsCritical,
        display_name: editDisplayName.trim() || null,
      });
      await refreshServices();
      cancelEditing();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
    } finally {
      setUpdatingService(null);
    }
  };

  // Delete a service
  const handleDelete = async (serviceName: string) => {
    setDeletingService(serviceName);

    try {
      await deleteExpectedService(server.id, serviceName);
      await refreshServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setDeletingService(null);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      data-testid="service-management-modal"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-border-default bg-bg-secondary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Manage Services - {server.display_name || server.hostname}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global error */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-md border border-status-error/30 bg-status-error/10 p-3">
            <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0" />
            <p className="text-sm text-status-error">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-status-error hover:text-status-error/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Discover Services Section */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            Discover Services
          </h3>
          <div className="rounded-md border border-border-default bg-bg-tertiary p-4">
            {/* SSH Key selector */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="ssh-key-select"
                  className="text-sm text-text-secondary"
                >
                  SSH Key:
                </label>
                <select
                  id="ssh-key-select"
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyId(e.target.value)}
                  disabled={sshKeysLoading || sshKeys.length === 0 || discovering}
                  className="px-3 py-1.5 text-sm bg-bg-secondary border border-border-default rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-status-info disabled:opacity-50"
                  data-testid="ssh-key-select"
                >
                  <option value="">Attempt all keys</option>
                  {sshKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name}
                      {key.username ? ` (${key.username})` : ''}
                      {key.is_default ? ' - Default' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {sshKeys.length === 0 && !sshKeysLoading && (
                <span className="text-xs text-text-tertiary">
                  No SSH keys configured - add keys in Settings
                </span>
              )}
            </div>

            <button
              onClick={handleDiscover}
              disabled={discovering || (sshKeys.length === 0 && !sshKeysLoading)}
              className="flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="scan-services-button"
            >
              {discovering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {discovering ? 'Scanning...' : 'Scan for Services'}
            </button>

            {/* Discovery error */}
            {discoveryError && (
              <div className="mt-4 text-sm text-status-warning">{discoveryError}</div>
            )}

            {/* Discovered services list */}
            {discoveredServices.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm text-text-secondary">
                  Found {discoveredServices.length} services not monitored:
                </p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {discoveredServices.map((service) => {
                    const selected = selectedServices.get(service.name);
                    return (
                      <div
                        key={service.name}
                        className="flex items-center gap-3 rounded-md border border-border-default bg-bg-secondary p-2"
                      >
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => toggleServiceSelection(service.name)}
                          className="h-4 w-4 rounded border-border-default text-status-info focus:ring-status-info"
                          data-testid={`checkbox-${service.name}`}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-sm text-text-primary">
                            {service.name}
                          </span>
                          {service.description && (
                            <p className="text-xs text-text-tertiary truncate">
                              {service.description}
                            </p>
                          )}
                        </div>
                        <select
                          value={selected?.isCritical ? 'core' : 'standard'}
                          onChange={(e) =>
                            updateSelectedCriticality(
                              service.name,
                              e.target.value === 'core'
                            )
                          }
                          disabled={!selected}
                          className="rounded-md border border-border-default bg-bg-tertiary px-2 py-1 text-xs text-text-primary focus:border-status-info focus:outline-none disabled:opacity-50"
                        >
                          <option value="standard">Standard</option>
                          <option value="core">Core</option>
                        </select>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleAddSelected}
                  disabled={selectedServices.size === 0 || addingSelected}
                  className="mt-4 flex items-center gap-2 rounded-md bg-status-success px-4 py-2 text-sm font-medium text-white hover:bg-status-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="add-selected-button"
                >
                  {addingSelected ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add Selected Services ({selectedServices.size})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Add Manually Section */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-text-primary">Add Manually</h3>
          <div className="rounded-md border border-border-default bg-bg-tertiary p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="manual-service-name"
                  className="mb-1 block text-xs font-medium text-text-secondary"
                >
                  Service name <span className="text-status-error">*</span>
                </label>
                <input
                  id="manual-service-name"
                  type="text"
                  value={manualServiceName}
                  onChange={(e) => setManualServiceName(e.target.value)}
                  placeholder="e.g., nginx"
                  disabled={addingManual}
                  className="w-full rounded-md border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none disabled:opacity-50"
                  data-testid="manual-service-name"
                />
              </div>
              <div>
                <label
                  htmlFor="manual-display-name"
                  className="mb-1 block text-xs font-medium text-text-secondary"
                >
                  Display name <span className="text-text-tertiary">(optional)</span>
                </label>
                <input
                  id="manual-display-name"
                  type="text"
                  value={manualDisplayName}
                  onChange={(e) => setManualDisplayName(e.target.value)}
                  placeholder="e.g., Nginx Web Server"
                  disabled={addingManual}
                  className="w-full rounded-md border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none disabled:opacity-50"
                  data-testid="manual-display-name"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4">
              <span className="text-xs font-medium text-text-secondary">Criticality:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="manual-criticality"
                  checked={!manualIsCritical}
                  onChange={() => setManualIsCritical(false)}
                  disabled={addingManual}
                  className="h-3.5 w-3.5 text-status-info focus:ring-status-info"
                />
                <span className="text-sm text-text-primary">Standard</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="manual-criticality"
                  checked={manualIsCritical}
                  onChange={() => setManualIsCritical(true)}
                  disabled={addingManual}
                  className="h-3.5 w-3.5 text-status-info focus:ring-status-info"
                />
                <span className="text-sm text-text-primary">Core</span>
              </label>
            </div>

            {manualError && (
              <div className="mt-3 text-sm text-status-error">{manualError}</div>
            )}

            <button
              onClick={handleAddManual}
              disabled={!manualServiceName.trim() || addingManual}
              className="mt-4 flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="add-manual-button"
            >
              {addingManual ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {addingManual ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>

        {/* Currently Monitored Section */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            Currently Monitored ({currentServices.length})
          </h3>
          <div className="rounded-md border border-border-default bg-bg-tertiary">
            {loadingServices && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
              </div>
            )}

            {!loadingServices && currentServices.length === 0 && (
              <div className="p-6 text-center text-sm text-text-tertiary">
                No services configured for monitoring.
              </div>
            )}

            {!loadingServices && currentServices.length > 0 && (
              <div className="divide-y divide-border-default">
                {currentServices.map((service) => {
                  const isEditing = editingService === service.service_name;
                  const isUpdating = updatingService === service.service_name;
                  const isDeleting = deletingService === service.service_name;

                  return (
                    <div
                      key={service.service_name}
                      className="flex items-center gap-3 p-3"
                      data-testid={`monitored-service-${service.service_name}`}
                    >
                      {isEditing ? (
                        // Edit mode
                        <>
                          <div className="flex-1 space-y-2">
                            <div className="font-mono text-sm text-text-primary">
                              {service.service_name}
                            </div>
                            <input
                              type="text"
                              value={editDisplayName}
                              onChange={(e) => setEditDisplayName(e.target.value)}
                              placeholder="Display name (optional)"
                              className="w-full rounded-md border border-border-default bg-bg-secondary px-2 py-1 text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none"
                            />
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`edit-criticality-${service.service_name}`}
                                  checked={!editIsCritical}
                                  onChange={() => setEditIsCritical(false)}
                                  className="h-3.5 w-3.5 text-status-info focus:ring-status-info"
                                />
                                <span className="text-xs text-text-primary">Standard</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`edit-criticality-${service.service_name}`}
                                  checked={editIsCritical}
                                  onChange={() => setEditIsCritical(true)}
                                  className="h-3.5 w-3.5 text-status-info focus:ring-status-info"
                                />
                                <span className="text-xs text-text-primary">Core</span>
                              </label>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(service.service_name)}
                              disabled={isUpdating}
                              className="p-1.5 text-status-success hover:bg-status-success/10 rounded transition-colors"
                              title="Save"
                            >
                              {isUpdating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={isUpdating}
                              className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded transition-colors"
                              title="Cancel"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        // View mode
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-text-primary">
                                {service.service_name}
                              </span>
                              <span
                                className={cn(
                                  'px-1.5 py-0.5 rounded text-xs font-medium',
                                  service.is_critical
                                    ? 'bg-status-warning/20 text-status-warning'
                                    : 'bg-text-tertiary/20 text-text-secondary'
                                )}
                              >
                                {service.is_critical ? 'Core' : 'Standard'}
                              </span>
                              {!service.enabled && (
                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-text-tertiary/20 text-text-tertiary">
                                  Disabled
                                </span>
                              )}
                            </div>
                            {service.display_name && (
                              <p className="text-xs text-text-tertiary mt-0.5">
                                {service.display_name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditing(service)}
                              disabled={isDeleting}
                              className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded transition-colors"
                              title="Edit"
                              data-testid={`edit-${service.service_name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(service.service_name)}
                              disabled={isDeleting}
                              className="p-1.5 text-text-tertiary hover:text-status-error hover:bg-status-error/10 rounded transition-colors"
                              title="Delete"
                              data-testid={`delete-${service.service_name}`}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <button
            onClick={handleClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
