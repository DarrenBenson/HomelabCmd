import { useState } from 'react';
import { X } from 'lucide-react';
import { TDP_PRESETS } from '../types/cost';

interface TdpEditModalProps {
  serverName: string;
  currentTdp: number | null;
  onSave: (tdp: number | null) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Modal for editing a server's TDP value with preset options.
 */
export function TdpEditModal({
  serverName,
  currentTdp,
  onSave,
  onCancel,
  isLoading = false,
}: TdpEditModalProps) {
  const [tdpValue, setTdpValue] = useState<string>(
    currentTdp?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const watts = tdpValue.trim() === '' ? null : parseInt(tdpValue, 10);
      await onSave(watts);
    } finally {
      setSaving(false);
    }
  };

  const handlePreset = (watts: number) => {
    setTdpValue(watts.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !saving && !isLoading) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      data-testid="tdp-modal-backdrop"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border-default bg-bg-primary p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="tdp-modal"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Set TDP for {serverName}
          </h2>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-text-tertiary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* TDP Input */}
        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-secondary">
            TDP (Thermal Design Power)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="2000"
              value={tdpValue}
              onChange={(e) => setTdpValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving || isLoading}
              className="w-28 rounded-md border border-border-default bg-bg-secondary px-3 py-2 font-mono text-text-primary focus:border-status-info focus:outline-none"
              data-testid="tdp-modal-input"
              placeholder="65"
              autoFocus
            />
            <span className="text-text-secondary">Watts</span>
          </div>
        </div>

        {/* Presets */}
        <div className="mb-6">
          <p className="mb-2 text-sm text-text-secondary">Common presets:</p>
          <div className="flex flex-wrap gap-2">
            {TDP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.watts)}
                disabled={saving || isLoading}
                className="rounded-md bg-bg-secondary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50"
                data-testid={`tdp-modal-preset-${preset.watts}`}
              >
                {preset.label} ({preset.watts}W)
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={saving || isLoading}
            className="rounded-md bg-bg-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"
            data-testid="tdp-modal-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isLoading}
            className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/80 disabled:opacity-50"
            data-testid="tdp-modal-save"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
