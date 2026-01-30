/**
 * Pack Assignment Component (US0121).
 *
 * Allows users to view and manage configuration pack assignments for a server.
 * Displays available packs with checkboxes, where the base pack is required
 * and cannot be removed.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import { Package, Loader2, AlertCircle, Check } from 'lucide-react';
import { getAssignedPacks, updateAssignedPacks } from '../api/servers';
import { getConfigPacks } from '../api/config-packs';
import type { PackAssignmentResponse } from '../types/server';
import type { ConfigPackMetadata } from '../types/config-pack';

interface PackAssignmentProps {
  serverId: string;
  onUpdate?: () => void;
}

export function PackAssignment({ serverId, onUpdate }: PackAssignmentProps): ReactElement {
  const [assignment, setAssignment] = useState<PackAssignmentResponse | null>(null);
  const [availablePacks, setAvailablePacks] = useState<ConfigPackMetadata[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentData, packsData] = await Promise.all([
        getAssignedPacks(serverId),
        getConfigPacks(),
      ]);
      setAssignment(assignmentData);
      setAvailablePacks(packsData.packs);
      setSelectedPacks(assignmentData.assigned_packs);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pack assignment');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTogglePack = (packName: string): void => {
    // Base pack cannot be toggled
    if (packName === 'base') return;

    setSelectedPacks((prev) => {
      const newPacks = prev.includes(packName)
        ? prev.filter((p) => p !== packName)
        : [...prev, packName];

      // Check if there are changes compared to current assignment
      const currentPacks = assignment?.assigned_packs || ['base'];
      const changed =
        newPacks.length !== currentPacks.length ||
        !newPacks.every((p) => currentPacks.includes(p));
      setHasChanges(changed);

      return newPacks;
    });
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateAssignedPacks(serverId, selectedPacks);
      setAssignment(result);
      setHasChanges(false);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pack assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (): void => {
    setSelectedPacks(assignment?.assigned_packs || ['base']);
    setHasChanges(false);
    setError(null);
  };

  // Loading state
  if (loading) {
    return (
      <div
        className="rounded-lg border border-border-default bg-bg-secondary p-6"
        data-testid="pack-assignment-loading"
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          <span className="ml-2 text-text-secondary">Loading pack assignment...</span>
        </div>
      </div>
    );
  }

  // Error state with no data
  if (error && !assignment) {
    return (
      <div className="rounded-lg border border-status-error/30 bg-status-error/10 p-6">
        <div className="flex items-center gap-2 text-status-error">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load pack assignment: {error}</span>
        </div>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 text-sm font-medium rounded bg-status-error/20 text-status-error hover:bg-status-error/30"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!assignment) return <></>;

  return (
    <div
      className="rounded-lg border border-border-default bg-bg-secondary p-6 space-y-4"
      data-testid="pack-assignment"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-text-primary flex items-center gap-2">
          <Package className="h-4 w-4" />
          Configuration Packs
        </h3>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded bg-status-error/10 border border-status-error/30 text-status-error text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Pack checkboxes */}
      <div className="space-y-2">
        {availablePacks.map((pack) => {
          const isBase = pack.name === 'base';
          const isSelected = selectedPacks.includes(pack.name);

          return (
            <label
              key={pack.name}
              className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                isSelected
                  ? 'border-status-info/50 bg-status-info/10'
                  : 'border-border-default bg-bg-primary hover:bg-bg-primary/80'
              } ${isBase ? 'cursor-not-allowed opacity-80' : ''}`}
              data-testid={`pack-option-${pack.name}`}
            >
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleTogglePack(pack.name)}
                  disabled={isBase}
                  className="h-4 w-4 rounded border-border-default text-status-info focus:ring-status-info disabled:opacity-50"
                  data-testid={`pack-checkbox-${pack.name}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{pack.display_name}</span>
                  {isBase && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-text-tertiary/20 text-text-tertiary">
                      Required
                    </span>
                  )}
                  {pack.extends && (
                    <span className="px-2 py-0.5 text-xs rounded bg-bg-tertiary text-text-secondary">
                      extends {pack.extends}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-secondary mt-0.5">{pack.description}</p>
                <p className="text-xs text-text-tertiary mt-1">
                  {pack.item_count} items
                </p>
              </div>
              {isSelected && (
                <Check className="h-4 w-4 text-status-info shrink-0" />
              )}
            </label>
          );
        })}

        {availablePacks.length === 0 && (
          <div className="text-center py-4 text-text-secondary">
            No configuration packs available
          </div>
        )}
      </div>

      {/* Save/Cancel buttons */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded border border-border-default text-text-secondary hover:bg-bg-primary disabled:opacity-50"
            data-testid="pack-assignment-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded bg-status-info text-white hover:bg-status-info/90 disabled:opacity-50 flex items-center gap-2"
            data-testid="pack-assignment-save"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      )}

      {/* Current assignment summary */}
      <div className="pt-3 border-t border-border-default">
        <p className="text-xs text-text-tertiary">
          Assigned packs: {assignment.assigned_packs.join(', ')}
          {assignment.drift_detection_enabled && (
            <span className="ml-2">| Drift detection enabled</span>
          )}
        </p>
      </div>
    </div>
  );
}
