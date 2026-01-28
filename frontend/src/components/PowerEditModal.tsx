import { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';
import {
  MACHINE_CATEGORIES,
  type MachineCategory,
  type PowerConfigUpdate,
} from '../types/cost';

interface PowerEditModalProps {
  serverName: string;
  cpuModel: string | null;
  avgCpuPercent: number | null;
  currentCategory: MachineCategory | null;
  currentCategorySource: 'auto' | 'user' | null;
  currentIdleWatts: number | null;
  currentMaxWatts: number | null;
  onSave: (config: PowerConfigUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Modal for editing a server's power configuration with category dropdown.
 */
export function PowerEditModal({
  serverName,
  cpuModel,
  avgCpuPercent,
  currentCategory,
  currentCategorySource,
  currentIdleWatts,
  currentMaxWatts,
  onSave,
  onCancel,
  isLoading = false,
}: PowerEditModalProps) {
  const [category, setCategory] = useState<MachineCategory | ''>(currentCategory ?? '');
  const [idleWatts, setIdleWatts] = useState<string>(currentIdleWatts?.toString() ?? '');
  const [maxWatts, setMaxWatts] = useState<string>(currentMaxWatts?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  // Find the selected category option
  const selectedCategoryOption = MACHINE_CATEGORIES.find((c) => c.value === category);

  // Update idle/max watts when category changes (unless user has overridden)
  useEffect(() => {
    if (selectedCategoryOption) {
      // Only set defaults if fields are empty or match previous category defaults
      setIdleWatts((prev) => {
        if (prev === '' || prev === currentIdleWatts?.toString()) {
          return selectedCategoryOption.idleWatts.toString();
        }
        return prev;
      });
      setMaxWatts((prev) => {
        if (prev === '' || prev === currentMaxWatts?.toString()) {
          return selectedCategoryOption.maxWatts.toString();
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, selectedCategoryOption]);

  // Calculate estimated power preview
  const calculateEstimatedPower = (): number | null => {
    const idle = parseInt(idleWatts, 10);
    const max = parseInt(maxWatts, 10);
    const cpu = avgCpuPercent ?? 50;

    if (isNaN(idle) || isNaN(max)) return null;

    // Linear interpolation: idle + (max - idle) * (cpu / 100)
    return Math.round((idle + (max - idle) * (cpu / 100)) * 10) / 10;
  };

  const estimatedPower = calculateEstimatedPower();

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: PowerConfigUpdate = {
        machine_category: category === '' ? null : category,
        idle_watts: idleWatts.trim() === '' ? null : parseInt(idleWatts, 10),
        tdp_watts: maxWatts.trim() === '' ? null : parseInt(maxWatts, 10),
      };
      await onSave(config);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !saving && !isLoading) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const isValid = category !== '' || (idleWatts !== '' && maxWatts !== '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      data-testid="power-modal-backdrop"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border-default bg-bg-primary p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        data-testid="power-modal"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-status-info" />
            <h2 className="text-lg font-semibold text-text-primary">
              Power Configuration
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-text-tertiary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Server name */}
        <div className="mb-4 text-sm text-text-secondary">
          <span className="font-mono text-text-primary">{serverName}</span>
        </div>

        {/* CPU Model (read-only) */}
        {cpuModel && (
          <div className="mb-4 rounded-md bg-bg-secondary px-3 py-2">
            <p className="text-xs text-text-tertiary">Detected CPU</p>
            <p
              className="truncate font-mono text-sm text-text-primary"
              title={cpuModel}
            >
              {cpuModel}
            </p>
          </div>
        )}

        {/* Category Dropdown */}
        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-secondary">
            Machine Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MachineCategory | '')}
            disabled={saving || isLoading}
            className="w-full rounded-md border border-border-default bg-bg-secondary px-3 py-2 text-text-primary focus:border-status-info focus:outline-none"
            data-testid="power-modal-category"
          >
            <option value="">Select category...</option>
            {MACHINE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label} ({cat.idleWatts}-{cat.maxWatts}W)
                {cat.value === currentCategory && currentCategorySource === 'auto'
                  ? ' (auto-detected)'
                  : ''}
              </option>
            ))}
          </select>
          {currentCategorySource === 'auto' && currentCategory === category && (
            <p className="mt-1 text-xs text-text-tertiary">
              Auto-detected from CPU model
            </p>
          )}
        </div>

        {/* Power Settings */}
        <div className="mb-4">
          <p className="mb-2 text-sm text-text-secondary">Power Settings</p>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-text-tertiary">
                Idle (W)
              </label>
              <input
                type="number"
                min="0"
                max="2000"
                value={idleWatts}
                onChange={(e) => setIdleWatts(e.target.value)}
                disabled={saving || isLoading}
                className="w-full rounded-md border border-border-default bg-bg-secondary px-3 py-2 font-mono text-text-primary focus:border-status-info focus:outline-none"
                data-testid="power-modal-idle"
                placeholder={selectedCategoryOption?.idleWatts.toString() ?? '40'}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-text-tertiary">
                Max (W)
              </label>
              <input
                type="number"
                min="0"
                max="2000"
                value={maxWatts}
                onChange={(e) => setMaxWatts(e.target.value)}
                disabled={saving || isLoading}
                className="w-full rounded-md border border-border-default bg-bg-secondary px-3 py-2 font-mono text-text-primary focus:border-status-info focus:outline-none"
                data-testid="power-modal-max"
                placeholder={selectedCategoryOption?.maxWatts.toString() ?? '100'}
              />
            </div>
          </div>
          {selectedCategoryOption && (
            <p className="mt-1 text-xs text-text-tertiary">
              Category defaults: {selectedCategoryOption.idleWatts}W idle,{' '}
              {selectedCategoryOption.maxWatts}W max
            </p>
          )}
        </div>

        {/* Estimated Power Preview */}
        {(avgCpuPercent !== null || estimatedPower !== null) && (
          <div className="mb-4 rounded-md bg-bg-tertiary px-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">
                Avg CPU (24h): {avgCpuPercent?.toFixed(1) ?? '50.0'}%
              </span>
              {estimatedPower !== null && (
                <span className="font-mono text-status-info">
                  Est: {estimatedPower}W
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={saving || isLoading}
            className="rounded-md bg-bg-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"
            data-testid="power-modal-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isLoading || !isValid}
            className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/80 disabled:opacity-50"
            data-testid="power-modal-save"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
