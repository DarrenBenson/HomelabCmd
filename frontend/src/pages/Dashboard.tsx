import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { MachineSection } from '../components/MachineSection';
import { SectionDropZone } from '../components/SectionDropZone';
import { ServerCard } from '../components/ServerCard';
import { DashboardFilters } from '../components/DashboardFilters';
import type { StatusFilter, TypeFilter } from '../components/DashboardFilters';
import { SummaryBar } from '../components/SummaryBar';
import type { SummaryFilterCallback } from '../components/SummaryBar';
import { AlertBanner } from '../components/AlertBanner';
import { AlertDetailPanel } from '../components/AlertDetailPanel';
import { PendingActionsPanel } from '../components/PendingActionsPanel';
import { RejectModal } from '../components/RejectModal';
import { CostBadge } from '../components/CostBadge';
import { ConnectivityStatusBar } from '../components/ConnectivityStatusBar';
import { AddServerModal } from '../components/AddServerModal';
import { getServers, updateMachineType } from '../api/servers';
import { getAlerts, acknowledgeAlert, resolveAlert } from '../api/alerts';
import { restartService } from '../api/services';
import { ApiError } from '../api/client';
import { getActions, approveAction, rejectAction } from '../api/actions';
import { useDashboardPreferences } from '../hooks/useDashboardPreferences';
import type { Server } from '../types/server';
import type { Alert, AlertSeverity, AlertStatus } from '../types/alert';
import type { Action } from '../types/action';
import { Loader2, ServerOff, AlertCircle, Settings, Radar, ListTodo, Plus, Globe, Check, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const POLL_INTERVAL_MS = 30000; // 30 seconds

// US0137: Undo state for machine type change
interface UndoState {
  machineId: string;
  machineName: string;
  previousType: 'server' | 'workstation';
  previousOrder: string[];
}

const severityOrder: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    // Sort by severity first (critical first)
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    // Then by created_at (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// Sort servers: active servers first, then inactive servers at the end (EP0007)
function sortServers(servers: Server[]): Server[] {
  return [...servers].sort((a, b) => {
    // Inactive servers go to the end
    if (a.is_inactive && !b.is_inactive) return 1;
    if (!a.is_inactive && b.is_inactive) return -1;
    // Then sort by display name or hostname
    const nameA = (a.display_name || a.hostname).toLowerCase();
    const nameB = (b.display_name || b.hostname).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [servers, setServers] = useState<Server[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingActions, setPendingActions] = useState<Action[]>([]);
  const [inProgressActions, setInProgressActions] = useState<Action[]>([]);
  const [acknowledgingIds, setAcknowledgingIds] = useState<Set<number>>(new Set());
  const [approvingIds, setApprovingIds] = useState<Set<number>>(new Set());
  const [rejectingAction, setRejectingAction] = useState<Action | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alertActionInProgress, setAlertActionInProgress] = useState(false);
  const [restartMessage, setRestartMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  // US0115: Quick action message state
  const [quickActionMessage, setQuickActionMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // US0137: Cross-section drag-and-drop state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'server' | 'workstation' | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [typeChangeMessage, setTypeChangeMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    showUndo: boolean;
  } | null>(null);
  const [typeChangeLoading, setTypeChangeLoading] = useState(false);

  // US0137: DnD sensors - lifted to Dashboard level for cross-section support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 5,
      },
    })
  );

  // US0137: Clear undo state after 5 seconds
  useEffect(() => {
    if (undoState) {
      const timer = setTimeout(() => {
        setUndoState(null);
        setTypeChangeMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [undoState]);

  // US0136: Unified dashboard preferences hook
  const {
    preferences,
    isLoading: preferencesLoading,
    loadError: preferencesLoadError,
    isSaving,
    showSavedIndicator,
    saveError,
    updateCardOrder,
    updateCollapsedSections,
    retrySave,
    dismissSaveError,
  } = useDashboardPreferences();

  // Track when preferences have been applied to server list
  const [preferencesApplied, setPreferencesApplied] = useState(false);

  // US0132: Handle section reorder (using unified hook)
  const handleServerReorder = useCallback((newOrder: string[]) => {
    updateCardOrder('servers', newOrder);
  }, [updateCardOrder]);

  const handleWorkstationReorder = useCallback((newOrder: string[]) => {
    updateCardOrder('workstations', newOrder);
  }, [updateCardOrder]);

  // US0132: Handle section collapse toggle (using unified hook)
  const handleToggleServerCollapse = useCallback(() => {
    const isCollapsed = preferences.collapsed_sections.includes('servers');
    const updated = isCollapsed
      ? preferences.collapsed_sections.filter((s) => s !== 'servers')
      : [...preferences.collapsed_sections, 'servers'];
    updateCollapsedSections(updated);
  }, [preferences.collapsed_sections, updateCollapsedSections]);

  const handleToggleWorkstationCollapse = useCallback(() => {
    const isCollapsed = preferences.collapsed_sections.includes('workstations');
    const updated = isCollapsed
      ? preferences.collapsed_sections.filter((s) => s !== 'workstations')
      : [...preferences.collapsed_sections, 'workstations'];
    updateCollapsedSections(updated);
  }, [preferences.collapsed_sections, updateCollapsedSections]);

  // US0137: Handle machine type change (cross-section drop)
  const handleMachineTypeChange = useCallback(
    async (machine: Server, newType: 'server' | 'workstation') => {
      const previousType = machine.machine_type as 'server' | 'workstation';
      const machineName = machine.display_name || machine.hostname;
      const previousOrderKey = previousType === 'server' ? 'servers' : 'workstations';
      const previousOrder = [...preferences.card_order[previousOrderKey]];

      // Optimistic update - move server to new section in UI
      setServers((current) =>
        current.map((s) =>
          s.id === machine.id ? { ...s, machine_type: newType } : s
        )
      );

      // Update card order - remove from old section, add to new
      const oldSectionKey = previousType === 'server' ? 'servers' : 'workstations';
      const newSectionKey = newType === 'server' ? 'servers' : 'workstations';
      updateCardOrder(
        oldSectionKey,
        preferences.card_order[oldSectionKey].filter((id) => id !== machine.id)
      );
      updateCardOrder(newSectionKey, [...preferences.card_order[newSectionKey], machine.id]);

      setTypeChangeLoading(true);

      try {
        await updateMachineType(machine.id, newType);

        // Store undo state
        setUndoState({
          machineId: machine.id,
          machineName,
          previousType,
          previousOrder,
        });

        // Show success toast with undo
        setTypeChangeMessage({
          type: 'success',
          text: `Changed ${machineName} to ${newType}`,
          showUndo: true,
        });
      } catch (err) {
        // Revert on error
        setServers((current) =>
          current.map((s) =>
            s.id === machine.id ? { ...s, machine_type: previousType } : s
          )
        );
        // Revert card order
        updateCardOrder(oldSectionKey, previousOrder);
        updateCardOrder(
          newSectionKey,
          preferences.card_order[newSectionKey].filter((id) => id !== machine.id)
        );

        setTypeChangeMessage({
          type: 'error',
          text: `Failed to change ${machineName} type: ${err instanceof Error ? err.message : 'Unknown error'}`,
          showUndo: false,
        });
        setTimeout(() => setTypeChangeMessage(null), 5000);
      } finally {
        setTypeChangeLoading(false);
      }
    },
    [preferences.card_order, updateCardOrder]
  );

  // US0137: Handle undo type change
  const handleUndoTypeChange = useCallback(async () => {
    if (!undoState) return;

    const { machineId, machineName, previousType, previousOrder } = undoState;
    const currentType = previousType === 'server' ? 'workstation' : 'server';

    setTypeChangeLoading(true);

    try {
      await updateMachineType(machineId, previousType);

      // Update UI
      setServers((current) =>
        current.map((s) =>
          s.id === machineId ? { ...s, machine_type: previousType } : s
        )
      );

      // Restore card order
      const oldSectionKey = previousType === 'server' ? 'servers' : 'workstations';
      const currentSectionKey = currentType === 'server' ? 'servers' : 'workstations';
      updateCardOrder(oldSectionKey, previousOrder);
      updateCardOrder(
        currentSectionKey,
        preferences.card_order[currentSectionKey].filter((id) => id !== machineId)
      );

      setUndoState(null);
      setTypeChangeMessage({
        type: 'success',
        text: `Reverted ${machineName} to ${previousType}`,
        showUndo: false,
      });
      setTimeout(() => setTypeChangeMessage(null), 3000);
    } catch (err) {
      setTypeChangeMessage({
        type: 'error',
        text: `Failed to undo: ${err instanceof Error ? err.message : 'Unknown error'}`,
        showUndo: false,
      });
      setTimeout(() => setTypeChangeMessage(null), 5000);
    } finally {
      setTypeChangeLoading(false);
    }
  }, [undoState, preferences.card_order, updateCardOrder]);

  // US0137: DnD drag start handler
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const machineId = event.active.id as string;
      setActiveDragId(machineId);

      // Determine which section the dragged item belongs to
      const machine = servers.find((m) => m.id === machineId);
      setActiveSection((machine?.machine_type as 'server' | 'workstation') || null);
    },
    [servers]
  );

  // US0137: DnD drag end handler - detects cross-section drops
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setActiveSection(null);

      if (!over) return;

      const overData = over.data.current;
      const machine = servers.find((m) => m.id === active.id);

      if (!machine) return;

      // Check if dropped on a section drop zone (cross-section drag)
      if (overData?.isDropZone) {
        const targetSection = overData.section as 'server' | 'workstation';
        if (machine.machine_type !== targetSection) {
          handleMachineTypeChange(machine, targetSection);
        }
        return;
      }

      // Same-section reorder - handle within-section card reordering
      const overId = over.id as string;
      const overMachine = servers.find((m) => m.id === overId);

      if (!overMachine || machine.id === overId) return;

      // Only reorder if both cards are in the same section
      if (machine.machine_type === overMachine.machine_type) {
        const sectionType = machine.machine_type as 'server' | 'workstation';
        const orderKey = sectionType === 'server' ? 'servers' : 'workstations';
        const currentOrder = preferences.card_order[orderKey];

        const oldIndex = currentOrder.indexOf(machine.id);
        const newIndex = currentOrder.indexOf(overId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
          updateCardOrder(orderKey, newOrder);

          // Update local servers array to reflect new order immediately
          setServers((current) => {
            const sectionMachines = current.filter((m) => m.machine_type === sectionType);
            const otherMachines = current.filter((m) => m.machine_type !== sectionType);

            // Create a map for fast lookup
            const machineMap = new Map(sectionMachines.map((m) => [m.id, m]));

            // Reorder section machines based on new order
            const reorderedSection: Server[] = [];
            for (const id of newOrder) {
              const m = machineMap.get(id);
              if (m) reorderedSection.push(m);
            }

            // Append any machines not in the order (shouldn't happen but be safe)
            for (const m of sectionMachines) {
              if (!newOrder.includes(m.id)) reorderedSection.push(m);
            }

            // Return servers first, then workstations
            return sectionType === 'server'
              ? [...reorderedSection, ...otherMachines]
              : [...otherMachines, ...reorderedSection];
          });
        }
      }
    },
    [servers, handleMachineTypeChange, preferences.card_order, updateCardOrder]
  );

  // US0137: DnD drag cancel handler
  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setActiveSection(null);
  }, []);

  // US0112: Filter state from URL parameters
  const searchQuery = searchParams.get('q') || '';
  const statusFilterParam = searchParams.get('status') || 'all';
  const typeFilterParam = searchParams.get('type') || 'all';

  // Validate status filter from URL
  const validStatuses: StatusFilter[] = ['all', 'online', 'offline', 'warning', 'paused'];
  const statusFilter: StatusFilter = validStatuses.includes(statusFilterParam as StatusFilter)
    ? (statusFilterParam as StatusFilter)
    : 'all';

  // Validate type filter from URL
  const validTypes: TypeFilter[] = ['all', 'server', 'workstation'];
  const typeFilter: TypeFilter = validTypes.includes(typeFilterParam as TypeFilter)
    ? (typeFilterParam as TypeFilter)
    : 'all';

  // US0112: Update URL when filters change
  const updateSearchParams = useCallback(
    (updates: { q?: string; status?: StatusFilter; type?: TypeFilter }) => {
      const newParams = new URLSearchParams(searchParams);

      if (updates.q !== undefined) {
        if (updates.q) {
          newParams.set('q', updates.q);
        } else {
          newParams.delete('q');
        }
      }

      if (updates.status !== undefined) {
        if (updates.status && updates.status !== 'all') {
          newParams.set('status', updates.status);
        } else {
          newParams.delete('status');
        }
      }

      if (updates.type !== undefined) {
        if (updates.type && updates.type !== 'all') {
          newParams.set('type', updates.type);
        } else {
          newParams.delete('type');
        }
      }

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // US0112: Filter handlers
  const handleSearchChange = useCallback(
    (query: string) => {
      updateSearchParams({ q: query });
    },
    [updateSearchParams]
  );

  const handleStatusChange = useCallback(
    (status: StatusFilter) => {
      updateSearchParams({ status });
    },
    [updateSearchParams]
  );

  const handleTypeChange = useCallback(
    (type: TypeFilter) => {
      updateSearchParams({ type });
    },
    [updateSearchParams]
  );

  const handleClearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  // US0134: Handle summary bar filter clicks
  const handleSummaryFilter: SummaryFilterCallback = useCallback(
    (status?: StatusFilter, type?: TypeFilter) => {
      updateSearchParams({
        status: status ?? 'all',
        type: type ?? 'all',
        q: '', // Clear search when using summary filters
      });
    },
    [updateSearchParams]
  );

  // US0112: Check if any filters are active
  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || typeFilter !== 'all';

  // US0112: Filter servers based on search and filters
  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      // Search filter (case-insensitive match on id, hostname, and display_name)
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        server.id.toLowerCase().includes(searchLower) ||
        server.hostname.toLowerCase().includes(searchLower) ||
        (server.display_name?.toLowerCase().includes(searchLower) ?? false);

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        if (statusFilter === 'paused') {
          matchesStatus = server.is_paused === true;
        } else if (statusFilter === 'warning') {
          // Warning: online server with active alerts
          matchesStatus =
            server.status === 'online' &&
            !server.is_paused &&
            (server.active_alert_count ?? 0) > 0;
        } else {
          // online/offline status (and not paused for online check)
          matchesStatus = server.status === statusFilter && !server.is_paused;
        }
      }

      // Type filter
      const matchesType =
        typeFilter === 'all' || server.machine_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [servers, searchQuery, statusFilter, typeFilter]);

  // US0115: Handle quick action message display
  const handleQuickActionMessage = useCallback((msg: { type: 'success' | 'info' | 'error'; text: string }) => {
    setQuickActionMessage(msg);
    setTimeout(() => setQuickActionMessage(null), 5000);
  }, []);

  // Function to refresh data (used by AddServerModal after token creation)
  const refreshData = useCallback(async () => {
    try {
      const [serverData, alertData, actionsData] = await Promise.all([
        getServers(),
        getAlerts({ status: 'open' }),
        getActions(),
      ]);
      setServers(sortServers(serverData.servers));
      setAlerts(sortAlerts(alertData.alerts));
      setPendingActions(actionsData.actions.filter((a) => a.status === 'pending'));
      setInProgressActions(
        actionsData.actions.filter((a) =>
          ['pending', 'approved', 'executing'].includes(a.status)
        )
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    }
  }, []);

  // US0134: Refreshing state for summary bar
  const [isRefreshing, setIsRefreshing] = useState(false);

  // US0134: Handle refresh with loading state
  const handleRefreshWithState = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshData]);

  // US0136: Apply preferences to server list when both servers and preferences are loaded
  useEffect(() => {
    if (preferencesLoading || servers.length === 0 || preferencesApplied) return;

    // Apply saved order from unified preferences
    const serverMap = new Map(servers.map((s: Server) => [s.id, s]));
    const orderedServers: Server[] = [];
    const orderedWorkstations: Server[] = [];
    const seenServers = new Set<string>();
    const seenWorkstations = new Set<string>();

    // Apply saved server order
    for (const id of preferences.card_order.servers) {
      const server = serverMap.get(id);
      if (server && server.machine_type === 'server') {
        orderedServers.push(server);
        seenServers.add(id);
      }
    }

    // Apply saved workstation order
    for (const id of preferences.card_order.workstations) {
      const server = serverMap.get(id);
      if (server && server.machine_type === 'workstation') {
        orderedWorkstations.push(server);
        seenWorkstations.add(id);
      }
    }

    // Append new machines not in saved order
    for (const server of servers) {
      if (server.machine_type === 'server' && !seenServers.has(server.id)) {
        orderedServers.push(server);
      } else if (server.machine_type === 'workstation' && !seenWorkstations.has(server.id)) {
        orderedWorkstations.push(server);
      } else if (!server.machine_type && !seenServers.has(server.id)) {
        // Default to server if no type set
        orderedServers.push(server);
      }
    }

    // Set servers with combined order (servers first, then workstations)
    setServers([...orderedServers, ...orderedWorkstations]);
    setPreferencesApplied(true);
  }, [preferencesLoading, servers.length, preferencesApplied, preferences.card_order, servers]);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      try {
        const [serverData, alertData, actionsData] = await Promise.all([
          getServers(),
          getAlerts({ status: 'open' }),
          getActions(), // Fetch all actions, filter client-side
        ]);
        if (!ignore) {
          if (!preferencesApplied) {
            // Initial load - set servers, preferences effect will reorder
            setServers(sortServers(serverData.servers));
          } else {
            // On refresh, preserve current section order but update server data
            setServers((currentServers) => {
              const serverMap = new Map(serverData.servers.map((s: Server) => [s.id, s]));
              const ordered: Server[] = [];
              const seen = new Set<string>();

              // Preserve current order for existing servers
              for (const server of currentServers) {
                const updated = serverMap.get(server.id);
                if (updated) {
                  ordered.push(updated);
                  seen.add(server.id);
                }
              }

              // Add new servers at the end
              for (const server of serverData.servers) {
                if (!seen.has(server.id)) {
                  ordered.push(server);
                }
              }

              return ordered;
            });
          }
          setAlerts(sortAlerts(alertData.alerts));
          // Pending actions for the panel display
          setPendingActions(actionsData.actions.filter((a) => a.status === 'pending'));
          // In-progress actions for queued check (pending, approved, executing)
          setInProgressActions(
            actionsData.actions.filter((a) =>
              ['pending', 'approved', 'executing'].includes(a.status)
            )
          );
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to fetch data');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchData();

    // Set up polling
    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, [preferencesApplied]);

  async function handleAcknowledge(alertId: number) {
    // Optimistic update
    setAcknowledgingIds((prev) => new Set(prev).add(alertId));
    setAcknowledgeError(null);

    try {
      await acknowledgeAlert(alertId);
      // Remove from list on success (acknowledged alerts not shown on dashboard)
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      // Revert on error - alert stays in list, show error toast
      const message = err instanceof Error ? err.message : 'Failed to acknowledge alert';
      setAcknowledgeError(message);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setAcknowledgeError(null), 5000);
    } finally {
      setAcknowledgingIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }

  // US0030 AC4: Approve action handler
  async function handleApproveAction(actionId: number) {
    setApprovingIds((prev) => new Set(prev).add(actionId));
    setActionError(null);

    // Optimistic update - remove from pending list, update status in in-progress list
    const previousPendingActions = pendingActions;
    const previousInProgressActions = inProgressActions;
    setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
    setInProgressActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: 'approved' as const } : a))
    );

    try {
      await approveAction(actionId);
    } catch (err) {
      // Revert on error
      const message = err instanceof Error ? err.message : 'Failed to approve action';
      setActionError(message);
      setPendingActions(previousPendingActions);
      setInProgressActions(previousInProgressActions);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  }

  // US0030 AC5: Reject action handler
  async function handleRejectAction(reason: string) {
    if (!rejectingAction) return;

    setRejectLoading(true);
    setActionError(null);

    try {
      await rejectAction(rejectingAction.id, reason);
      // Remove from both lists on success
      setPendingActions((prev) => prev.filter((a) => a.id !== rejectingAction.id));
      setInProgressActions((prev) => prev.filter((a) => a.id !== rejectingAction.id));
      setRejectingAction(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject action';
      setActionError(message);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setRejectLoading(false);
    }
  }

  // Handle resolve alert from detail panel
  async function handleResolve(alertId: number) {
    setAlertActionInProgress(true);

    try {
      await resolveAlert(alertId);
      // Update local state
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      // Update selected alert
      if (selectedAlert?.id === alertId) {
        setSelectedAlert((prev) =>
          prev
            ? { ...prev, status: 'resolved' as AlertStatus, resolved_at: new Date().toISOString(), auto_resolved: false }
            : null
        );
      }
    } catch (err) {
      setAcknowledgeError(err instanceof Error ? err.message : 'Failed to resolve alert');
      setTimeout(() => setAcknowledgeError(null), 5000);
    } finally {
      setAlertActionInProgress(false);
    }
  }

  // Handle restart service from alert detail panel
  async function handleRestartService(serverId: string, serviceName: string) {
    setAlertActionInProgress(true);
    setRestartMessage(null);

    try {
      const result = await restartService(serverId, serviceName);
      if (result.status === 'pending') {
        setRestartMessage({
          type: 'info',
          text: `Restart pending approval for ${serviceName} (server in maintenance mode)`,
        });
        // Refresh actions lists to show the new action
        const actionsData = await getActions();
        setPendingActions(actionsData.actions.filter((a) => a.status === 'pending'));
        setInProgressActions(
          actionsData.actions.filter((a) =>
            ['pending', 'approved', 'executing'].includes(a.status)
          )
        );
      } else {
        setRestartMessage({ type: 'success', text: `Restarting ${serviceName}...` });
      }
      setTimeout(() => setRestartMessage(null), 5000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRestartMessage({ type: 'info', text: `Restart already pending for ${serviceName}` });
      } else {
        setRestartMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to queue restart',
        });
      }
      setTimeout(() => setRestartMessage(null), 5000);
    } finally {
      setAlertActionInProgress(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-status-info animate-spin" />
      </div>
    );
  }

  // Error state (no cached data)
  if (error && servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-status-error" />
        <p className="text-text-secondary">{error}</p>
        <button
          className="px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90 transition-colors"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const hasServers = servers.length > 0;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-default px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-status-success font-sans">
            HomelabCmd
          </h1>
          <div className="flex items-center gap-4">
            <ConnectivityStatusBar />
            <CostBadge />
            <span className="text-text-tertiary text-sm font-mono">
              {servers.length} server{servers.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowAddServerModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-status-success text-bg-primary rounded-md text-sm font-medium hover:bg-status-success/90 transition-colors"
              aria-label="Add Server"
              title="Add Server"
              data-testid="add-server-button"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
            <Link
              to="/scans"
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Scans"
              title="Scans"
              data-testid="scans-link"
            >
              <Radar className="w-5 h-5" />
            </Link>
            <Link
              to="/discovery"
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Device Discovery"
              title="Device Discovery"
              data-testid="discovery-link"
            >
              <Globe className="w-5 h-5" />
            </Link>
            <Link
              to="/actions"
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Actions"
              title="Actions"
              data-testid="actions-link"
            >
              <ListTodo className="w-5 h-5" />
            </Link>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Settings"
              title="Settings"
              data-testid="settings-button"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Error toast (when we have cached data) */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-status-error/10 border border-status-error/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
          <span className="text-sm text-text-secondary">
            Unable to refresh - showing cached data
          </span>
        </div>
      )}

      {/* Acknowledge error toast */}
      {acknowledgeError && (
        <div
          className="mx-6 mt-4 p-3 bg-status-error/10 border border-status-error/30 rounded-lg flex items-center justify-between gap-2"
          data-testid="acknowledge-error-toast"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
            <span className="text-sm text-text-secondary">{acknowledgeError}</span>
          </div>
          <button
            onClick={() => setAcknowledgeError(null)}
            className="text-text-tertiary hover:text-text-secondary text-sm"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action error toast (US0030) */}
      {actionError && (
        <div
          className="mx-6 mt-4 p-3 bg-status-error/10 border border-status-error/30 rounded-lg flex items-center justify-between gap-2"
          data-testid="action-error-toast"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
            <span className="text-sm text-text-secondary">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-text-tertiary hover:text-text-secondary text-sm"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* US0115: Quick action message toast */}
      {quickActionMessage && (
        <div
          className={`mx-6 mt-4 p-3 rounded-lg flex items-center justify-between gap-2 ${
            quickActionMessage.type === 'error'
              ? 'bg-status-error/10 border border-status-error/30'
              : quickActionMessage.type === 'success'
                ? 'bg-status-success/10 border border-status-success/30'
                : 'bg-status-info/10 border border-status-info/30'
          }`}
          data-testid="quick-action-toast"
        >
          <span className="text-sm text-text-secondary">{quickActionMessage.text}</span>
          <button
            onClick={() => setQuickActionMessage(null)}
            className="text-text-tertiary hover:text-text-secondary text-sm"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* US0136: Preferences load error toast */}
      {preferencesLoadError && (
        <div
          className="mx-6 mt-4 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg flex items-center gap-2"
          data-testid="preferences-load-error-toast"
        >
          <AlertCircle className="w-4 h-4 text-status-warning flex-shrink-0" />
          <span className="text-sm text-text-secondary">{preferencesLoadError}</span>
        </div>
      )}

      {/* US0136: Card order save error toast with retry */}
      {saveError && (
        <div
          className="mx-6 mt-4 p-3 bg-status-error/10 border border-status-error/30 rounded-lg flex items-center justify-between gap-2"
          data-testid="save-order-error-toast"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
            <span className="text-sm text-text-secondary">{saveError}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={retrySave}
              className="px-2 py-1 bg-status-error text-white rounded text-sm hover:bg-status-error/90 transition-colors"
              data-testid="save-order-retry-button"
            >
              Retry
            </button>
            <button
              onClick={dismissSaveError}
              className="text-text-tertiary hover:text-text-secondary text-sm"
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* US0137: Type change toast with undo */}
      {typeChangeMessage && (
        <div
          className={`mx-6 mt-4 p-3 rounded-lg flex items-center justify-between gap-2 ${
            typeChangeMessage.type === 'error'
              ? 'bg-status-error/10 border border-status-error/30'
              : 'bg-status-success/10 border border-status-success/30'
          }`}
          data-testid="type-change-toast"
        >
          <div className="flex items-center gap-2">
            {typeChangeMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-status-success flex-shrink-0" />
            )}
            <span className="text-sm text-text-secondary">{typeChangeMessage.text}</span>
          </div>
          <div className="flex items-center gap-2">
            {typeChangeMessage.showUndo && undoState && (
              <button
                onClick={handleUndoTypeChange}
                disabled={typeChangeLoading}
                className="flex items-center gap-1 px-2 py-1 bg-status-info text-white rounded text-sm hover:bg-status-info/90 transition-colors disabled:opacity-50"
                data-testid="undo-type-change-button"
              >
                <Undo2 className="w-3 h-3" />
                Undo
              </button>
            )}
            <button
              onClick={() => {
                setTypeChangeMessage(null);
                if (!typeChangeMessage.showUndo) setUndoState(null);
              }}
              className="text-text-tertiary hover:text-text-secondary text-sm"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* US0136: Saving indicator */}
      {isSaving && (
        <div
          className="fixed bottom-4 right-4 bg-bg-secondary px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm text-text-secondary z-50"
          data-testid="saving-indicator"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving...
        </div>
      )}

      {/* US0136 AC3: Saved indicator */}
      {showSavedIndicator && !isSaving && (
        <div
          className="fixed bottom-4 right-4 bg-status-success/10 border border-status-success/30 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm text-status-success z-50"
          data-testid="saved-indicator"
        >
          <Check className="w-4 h-4" />
          Saved
        </div>
      )}

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {hasServers ? (
          <>
            {/* Alert Banner */}
            <AlertBanner
              alerts={alerts}
              onAcknowledge={handleAcknowledge}
              onAlertSelect={setSelectedAlert}
              acknowledgingIds={acknowledgingIds}
            />

            {/* Pending Actions Panel (US0030) */}
            <PendingActionsPanel
              actions={pendingActions}
              onApprove={handleApproveAction}
              onReject={setRejectingAction}
              approvingIds={approvingIds}
            />

            {/* US0134: Summary Bar */}
            <SummaryBar
              machines={servers}
              onFilter={handleSummaryFilter}
              onRefresh={handleRefreshWithState}
              isRefreshing={isRefreshing}
            />

            {/* US0112: Dashboard Filters */}
            <DashboardFilters
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              statusFilter={statusFilter}
              onStatusChange={handleStatusChange}
              typeFilter={typeFilter}
              onTypeChange={handleTypeChange}
              onClear={handleClearFilters}
              hasActiveFilters={hasActiveFilters}
            />

            {/* US0132/US0137: Machine Sections with cross-section drag-and-drop */}
            {(() => {
              // Check which sections have machines after filtering
              // Note: machines without machine_type default to 'server' section
              const hasFilteredServers = filteredServers.some((s) => s.machine_type === 'server' || !s.machine_type);
              const hasFilteredWorkstations = filteredServers.some((s) => s.machine_type === 'workstation');
              // Show servers section: not filtering by workstations AND has servers (or no active filters)
              const showServersSection = typeFilter !== 'workstation' && (hasFilteredServers || !hasActiveFilters);
              // Show workstations section: not filtering by servers AND has workstations (or no active filters)
              const showWorkstationsSection = typeFilter !== 'server' && (hasFilteredWorkstations || !hasActiveFilters);

              return filteredServers.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  {/* Servers section - hide when filtering by workstations or empty after filter */}
                  {showServersSection && (
                    <SectionDropZone
                      sectionType="server"
                      isActiveSection={activeSection === 'server'}
                      isCollapsed={preferences.collapsed_sections.includes('servers')}
                    >
                      <MachineSection
                        title="Servers"
                        type="server"
                        machines={filteredServers}
                        collapsed={preferences.collapsed_sections.includes('servers')}
                        onToggleCollapse={handleToggleServerCollapse}
                        onReorder={handleServerReorder}
                        onCardClick={(server) => navigate(`/servers/${server.id}`)}
                        onPauseToggle={refreshData}
                        onMessage={handleQuickActionMessage}
                      />
                    </SectionDropZone>
                  )}

                  {/* Workstations section - hide when filtering by servers or empty after filter */}
                  {showWorkstationsSection && (
                    <SectionDropZone
                      sectionType="workstation"
                      isActiveSection={activeSection === 'workstation'}
                      isCollapsed={preferences.collapsed_sections.includes('workstations')}
                    >
                      <MachineSection
                        title="Workstations"
                        type="workstation"
                        machines={filteredServers}
                        collapsed={preferences.collapsed_sections.includes('workstations')}
                        onToggleCollapse={handleToggleWorkstationCollapse}
                        onReorder={handleWorkstationReorder}
                        onCardClick={(server) => navigate(`/servers/${server.id}`)}
                        onPauseToggle={refreshData}
                        onMessage={handleQuickActionMessage}
                      />
                    </SectionDropZone>
                  )}

                {/* US0137: DragOverlay for cross-section drag visual feedback */}
                <DragOverlay>
                  {activeDragId ? (
                    <div className="opacity-90 shadow-2xl rotate-2">
                      <ServerCard
                        server={servers.find((s) => s.id === activeDragId)!}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
                </DndContext>
              ) : (
                /* US0112 AC7: Empty state when filters match no servers */
                <div
                  className="flex flex-col items-center justify-center py-12 gap-3"
                  data-testid="no-matches-message"
                >
                  <ServerOff className="w-10 h-10 text-text-tertiary" />
                  <p className="text-text-secondary">No servers match your filters</p>
                  <button
                    onClick={handleClearFilters}
                    className="text-status-info hover:text-status-info/80 text-sm font-medium transition-colors"
                    data-testid="clear-filters-link"
                  >
                    Clear filters
                  </button>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <ServerOff className="w-12 h-12 text-text-tertiary" />
            <h2 className="text-xl font-bold text-text-primary">No servers registered</h2>
            <p className="text-text-tertiary">
              Deploy the agent to your first server to get started.
            </p>
            <button
              onClick={() => setShowAddServerModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-status-success text-bg-primary rounded-md font-medium hover:bg-status-success/90 transition-colors"
              data-testid="add-server-button-empty"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
          </div>
        )}
      </main>

      {/* Reject Modal (US0030 AC5) */}
      {rejectingAction && (
        <RejectModal
          action={rejectingAction}
          onReject={handleRejectAction}
          onCancel={() => setRejectingAction(null)}
          isLoading={rejectLoading}
        />
      )}

      {/* Alert Detail Panel */}
      {selectedAlert && (
        <AlertDetailPanel
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          onRestartService={handleRestartService}
          isActionInProgress={alertActionInProgress}
          restartMessage={restartMessage}
          isRestartQueued={
            selectedAlert.service_name
              ? inProgressActions.some(
                  (a) =>
                    a.action_type === 'restart_service' &&
                    a.server_id === selectedAlert.server_id &&
                    a.service_name === selectedAlert.service_name
                )
              : false
          }
        />
      )}

      {/* Add Server Modal */}
      {showAddServerModal && (
        <AddServerModal
          onClose={() => setShowAddServerModal(false)}
          onTokenCreated={refreshData}
        />
      )}
    </div>
  );
}
