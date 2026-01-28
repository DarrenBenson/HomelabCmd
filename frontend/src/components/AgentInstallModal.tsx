/**
 * Modal for installing the monitoring agent on a remote device.
 *
 * EP0007: Agent Management (US0066)
 * US0069: Service Discovery During Agent Installation
 */

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, Download, Search } from 'lucide-react';
import { installAgent } from '../api/agents';
import { discoverServices } from '../api/discovery';
import type { AgentInstallRequest, AgentInstallResponse } from '../types/agent';
import type { DiscoveredService, ServiceConfig } from '../types/discovery';

interface AgentInstallModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Target device IP address (used for SSH connection) */
  ipAddress: string;
  /** Target device hostname (used for display name suggestion, optional) */
  hostname?: string;
  /** SSH username to use for discovery (optional) */
  sshUsername?: string;
  /** SSH port to use for discovery (optional) */
  sshPort?: number;
  /** SSH key ID to use for service discovery (optional, US0073) */
  sshKeyId?: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when installation succeeds */
  onSuccess?: (response: AgentInstallResponse) => void;
}

/**
 * Single service row with checkbox and core toggle.
 */
function ServiceRow({
  service,
  selected,
  isCore,
  onToggleSelect,
  onToggleCore,
  disabled,
}: {
  service: DiscoveredService;
  selected: boolean;
  isCore: boolean;
  onToggleSelect: () => void;
  onToggleCore: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-bg-tertiary/50 rounded">
      <label className="flex items-center gap-3 flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={disabled}
          className="h-4 w-4 rounded border-border-default text-status-info focus:ring-status-info"
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-text-primary font-medium">{service.name}</span>
          {service.description && (
            <p className="text-xs text-text-tertiary truncate" title={service.description}>
              {service.description}
            </p>
          )}
        </div>
      </label>
      {selected && (
        <button
          type="button"
          onClick={onToggleCore}
          disabled={disabled}
          className={`ml-2 px-2 py-1 text-xs rounded font-medium transition-colors ${
            isCore
              ? 'bg-status-error/20 text-status-error border border-status-error/30'
              : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'
          }`}
          title={isCore ? 'Critical alerts when down' : 'Warning alerts when down'}
        >
          {isCore ? 'Core' : 'Standard'}
        </button>
      )}
    </div>
  );
}

export function AgentInstallModal({
  isOpen,
  ipAddress,
  hostname,
  sshUsername = 'root',
  sshPort = 22,
  sshKeyId,
  onClose,
  onSuccess,
}: AgentInstallModalProps) {
  // Generate display name suggestion from hostname or IP
  function generateDisplayNameSuggestion(host: string): string {
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
    if (isIP) {
      return `Server ${host}`;
    }
    const baseName = host.split('.')[0];
    return baseName.charAt(0).toUpperCase() + baseName.slice(1).toLowerCase();
  }

  const displayNameSource = hostname || ipAddress;
  const suggestedDisplayName = generateDisplayNameSuggestion(displayNameSource);

  // Form state
  const [displayName, setDisplayName] = useState(suggestedDisplayName);
  const [manualServices, setManualServices] = useState('');
  const [commandExecutionEnabled, setCommandExecutionEnabled] = useState(false);
  const [useSudo, setUseSudo] = useState(false);
  const [sudoPassword, setSudoPassword] = useState('');

  // US0069: Service discovery state
  const [discoveredServices, setDiscoveredServices] = useState<DiscoveredService[]>([]);
  const [selectedServices, setSelectedServices] = useState<Map<string, boolean>>(new Map());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [showSystemServices, setShowSystemServices] = useState(false);
  const [hasDiscovered, setHasDiscovered] = useState(false);

  // Submission state
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AgentInstallResponse | null>(null);

  // Update display name when hostname/IP changes
  useEffect(() => {
    setDisplayName(generateDisplayNameSuggestion(hostname || ipAddress));
  }, [hostname, ipAddress]);

  // US0069: Handle service discovery
  // US0073: Pass key_id for SSH key selection
  async function handleDiscoverServices() {
    setIsDiscovering(true);
    setDiscoveryError(null);

    try {
      const response = await discoverServices(
        {
          hostname: ipAddress,
          port: sshPort,
          username: sshUsername,
          key_id: sshKeyId,
        },
        showSystemServices
      );
      setDiscoveredServices(response.services);
      setHasDiscovered(true);
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'Service discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  }

  // US0069: Toggle service selection
  function handleToggleService(serviceName: string) {
    setSelectedServices((prev) => {
      const next = new Map(prev);
      if (next.has(serviceName)) {
        next.delete(serviceName);
      } else {
        next.set(serviceName, false); // Default to Standard (not core)
      }
      return next;
    });
  }

  // US0069: Toggle core status
  function handleToggleCore(serviceName: string) {
    setSelectedServices((prev) => {
      const next = new Map(prev);
      if (next.has(serviceName)) {
        next.set(serviceName, !next.get(serviceName));
      }
      return next;
    });
  }

  // US0069: Re-discover when system services toggle changes
  useEffect(() => {
    if (hasDiscovered) {
      handleDiscoverServices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSystemServices]);

  // Handle form submission
  async function handleInstall() {
    setInstalling(true);
    setError(null);
    setSuccess(null);

    try {
      // US0069: Build service_config from selected services
      const serviceConfig: ServiceConfig[] = [];

      // Add discovered and selected services
      for (const [name, isCore] of selectedServices) {
        serviceConfig.push({ name, core: isCore });
      }

      // Add manually entered services (as standard by default)
      if (manualServices) {
        for (const name of manualServices.split(',').map((s) => s.trim())) {
          if (name && !selectedServices.has(name)) {
            serviceConfig.push({ name, core: false });
          }
        }
      }

      const request: AgentInstallRequest = {
        hostname: ipAddress,
        display_name: displayName || undefined,
        service_config: serviceConfig.length > 0 ? serviceConfig : undefined,
        command_execution_enabled: commandExecutionEnabled,
        use_sudo: useSudo,
        sudo_password: sudoPassword || undefined,
      };

      const response = await installAgent(request);

      if (response.success) {
        setSuccess(response);
        onSuccess?.(response);
      } else {
        setError(response.error || 'Installation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setInstalling(false);
    }
  }

  // Handle close
  function handleClose() {
    if (!installing) {
      setDisplayName(generateDisplayNameSuggestion(hostname || ipAddress));
      setManualServices('');
      setCommandExecutionEnabled(false);
      setUseSudo(false);
      setSudoPassword('');
      setError(null);
      setSuccess(null);
      // Reset discovery state
      setDiscoveredServices([]);
      setSelectedServices(new Map());
      setDiscoveryError(null);
      setHasDiscovered(false);
      onClose();
    }
  }

  if (!isOpen) return null;

  // Calculate selection counts
  const selectedCount = selectedServices.size;
  const coreCount = [...selectedServices.values()].filter(Boolean).length;
  const standardCount = selectedCount - coreCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      data-testid="agent-install-modal"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border-default bg-bg-secondary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-status-info" />
            <h2 className="text-lg font-semibold text-text-primary">
              Install Agent
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={installing}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success state */}
        {success && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-status-success/30 bg-status-success/10 p-4">
              <CheckCircle className="h-5 w-5 text-status-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-status-success">Agent installed successfully</p>
                <p className="text-sm text-text-secondary mt-1">
                  Server ID: <span className="font-mono">{success.server_id}</span>
                </p>
                <p className="text-sm text-text-secondary">
                  Agent version: <span className="font-mono">{success.agent_version}</span>
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !success && (
          <div className="mb-4 flex items-start gap-3 rounded-md border border-status-error/30 bg-status-error/10 p-3">
            <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0" />
            <p className="text-sm text-status-error">{error}</p>
          </div>
        )}

        {/* Form */}
        {!success && (
          <div className="space-y-5">
            {/* Target host (read-only) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Target Host
              </label>
              <div className="rounded-md border border-border-default bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary">
                {ipAddress}{hostname && ` (${hostname})`}
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label
                htmlFor="displayName"
                className="mb-2 block text-sm font-medium text-text-primary"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={suggestedDisplayName}
                disabled={installing}
                className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
                data-testid="display-name-input"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                The name shown in the dashboard. Edit to customise.
              </p>
            </div>

            {/* Sudo Password (optional) */}
            <div>
              <label
                htmlFor="sudoPassword"
                className="mb-2 block text-sm font-medium text-text-primary"
              >
                Sudo Password <span className="text-text-tertiary font-normal">(optional)</span>
              </label>
              <input
                id="sudoPassword"
                type="password"
                value={sudoPassword}
                onChange={(e) => setSudoPassword(e.target.value)}
                placeholder="Leave empty if user has passwordless sudo"
                disabled={installing}
                className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
                data-testid="sudo-password-input"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Required only if the SSH user needs a password for sudo commands.
              </p>
            </div>

            {/* US0069: Service Discovery Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-primary">
                  Monitored Services
                </label>
                <button
                  type="button"
                  onClick={handleDiscoverServices}
                  disabled={isDiscovering || installing}
                  className="flex items-center gap-2 rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  data-testid="discover-services-button"
                >
                  {isDiscovering ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  {isDiscovering ? 'Discovering...' : hasDiscovered ? 'Refresh' : 'Discover Services'}
                </button>
              </div>

              {/* Discovery error */}
              {discoveryError && (
                <div className="flex items-start gap-2 rounded-md border border-status-warning/30 bg-status-warning/10 p-2">
                  <AlertCircle className="h-4 w-4 text-status-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-status-warning">{discoveryError}</p>
                </div>
              )}

              {/* Discovered services list */}
              {hasDiscovered && discoveredServices.length > 0 && (
                <div className="rounded-md border border-border-default bg-bg-tertiary">
                  {/* Header with count and system services toggle */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
                    <span className="text-xs text-text-secondary">
                      {selectedCount > 0 ? (
                        <>
                          {selectedCount} selected
                          {coreCount > 0 && ` (${coreCount} core`}
                          {standardCount > 0 && coreCount > 0 && `, ${standardCount} standard`}
                          {coreCount > 0 && ')'}
                        </>
                      ) : (
                        `${discoveredServices.length} services found`
                      )}
                    </span>
                    <label className="flex items-center gap-2 text-xs text-text-tertiary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSystemServices}
                        onChange={(e) => setShowSystemServices(e.target.checked)}
                        disabled={isDiscovering || installing}
                        className="h-3 w-3 rounded border-border-default text-status-info focus:ring-status-info"
                      />
                      Show system services
                    </label>
                  </div>

                  {/* Scrollable service list */}
                  <div className="max-h-48 overflow-y-auto divide-y divide-border-default/50">
                    {discoveredServices.map((service) => (
                      <ServiceRow
                        key={service.name}
                        service={service}
                        selected={selectedServices.has(service.name)}
                        isCore={selectedServices.get(service.name) ?? false}
                        onToggleSelect={() => handleToggleService(service.name)}
                        onToggleCore={() => handleToggleCore(service.name)}
                        disabled={installing}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No services found */}
              {hasDiscovered && discoveredServices.length === 0 && !discoveryError && (
                <div className="rounded-md border border-border-default bg-bg-tertiary px-3 py-4 text-center">
                  <p className="text-sm text-text-tertiary">No running services found</p>
                  <button
                    type="button"
                    onClick={() => setShowSystemServices(true)}
                    className="mt-2 text-xs text-status-info hover:underline"
                    disabled={showSystemServices}
                  >
                    {showSystemServices ? 'Showing all services' : 'Try showing system services'}
                  </button>
                </div>
              )}

              {/* Manual entry fallback */}
              <div>
                <input
                  id="manualServices"
                  type="text"
                  value={manualServices}
                  onChange={(e) => setManualServices(e.target.value)}
                  placeholder="Additional services (comma-separated)"
                  disabled={installing}
                  className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info disabled:opacity-50"
                  data-testid="services-input"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  Type additional services not shown above, or use this if discovery is unavailable
                </p>
              </div>
            </div>

            {/* Command Execution */}
            <div className="space-y-3 rounded-md border border-border-default bg-bg-tertiary p-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={commandExecutionEnabled}
                  onChange={(e) => setCommandExecutionEnabled(e.target.checked)}
                  disabled={installing}
                  className="h-4 w-4 rounded border-border-default text-status-info focus:ring-status-info"
                />
                <span className="text-sm text-text-primary">Enable remote command execution</span>
              </label>

              {commandExecutionEnabled && (
                <label className="ml-7 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={useSudo}
                    onChange={(e) => setUseSudo(e.target.checked)}
                    disabled={installing}
                    className="h-4 w-4 rounded border-border-default text-status-info focus:ring-status-info"
                  />
                  <span className="text-sm text-text-primary">Use sudo for commands</span>
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={installing}
                className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="flex items-center gap-2 rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/90 transition-colors disabled:opacity-50"
                data-testid="install-button"
              >
                {installing && <Loader2 className="h-4 w-4 animate-spin" />}
                {installing ? 'Installing...' : 'Install Agent'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
