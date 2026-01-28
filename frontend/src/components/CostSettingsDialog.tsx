import { useState } from 'react';
import { X, Zap } from 'lucide-react';
import type { CostConfig, CostConfigUpdate } from '../types/cost';

interface CostSettingsDialogProps {
  config: CostConfig;
  onSave: (update: CostConfigUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Modal dialog for editing cost tracking settings.
 * Shared between Settings page and Costs page for consistent UX.
 */
export function CostSettingsDialog({
  config,
  onSave,
  onCancel,
  isLoading = false,
}: CostSettingsDialogProps) {
  const [electricityRate, setElectricityRate] = useState<number>(config.electricity_rate);
  const [currencySymbol, setCurrencySymbol] = useState<string>(config.currency_symbol);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        electricity_rate: electricityRate,
        currency_symbol: currencySymbol,
      });
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

  const handlePreset = (rate: number, symbol: string) => {
    setElectricityRate(rate);
    setCurrencySymbol(symbol);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      data-testid="cost-settings-dialog-backdrop"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border-default bg-bg-primary p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        data-testid="cost-settings-dialog"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-status-warning" />
            <h2 className="text-lg font-semibold text-text-primary">
              Cost Settings
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-text-tertiary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Close"
            data-testid="cost-settings-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-6 text-sm text-text-secondary">
          Configure electricity rate and currency for cost estimates.
        </p>

        {/* Electricity Rate Input */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Electricity Rate (per kWh)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value.slice(0, 10))}
              disabled={saving || isLoading}
              className="w-16 rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-center font-mono text-sm text-text-primary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info"
              data-testid="cost-currency-input"
              placeholder="£"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={electricityRate}
              onChange={(e) => setElectricityRate(Math.max(0, parseFloat(e.target.value) || 0))}
              disabled={saving || isLoading}
              className="w-28 rounded-md border border-border-default bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info"
              data-testid="cost-rate-input"
            />
            <span className="text-sm text-text-secondary">per kWh</span>
          </div>
          <p className="mt-2 text-xs text-text-tertiary">
            Find your rate on your electricity bill or supplier website.
          </p>
        </div>

        {/* Common Rates Reference */}
        <div className="mb-6 rounded-md border border-border-default bg-bg-tertiary p-4">
          <p className="mb-2 text-sm font-medium text-text-primary">
            Common rates:
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
            <button
              type="button"
              onClick={() => handlePreset(0.24, '£')}
              disabled={saving || isLoading}
              className="hover:text-status-info transition-colors disabled:opacity-50"
              data-testid="cost-preset-uk"
            >
              UK: £0.24/kWh
            </button>
            <button
              type="button"
              onClick={() => handlePreset(0.12, '$')}
              disabled={saving || isLoading}
              className="hover:text-status-info transition-colors disabled:opacity-50"
              data-testid="cost-preset-us"
            >
              US: $0.12/kWh
            </button>
            <button
              type="button"
              onClick={() => handlePreset(0.30, '€')}
              disabled={saving || isLoading}
              className="hover:text-status-info transition-colors disabled:opacity-50"
              data-testid="cost-preset-eu"
            >
              EU: €0.30/kWh
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={saving || isLoading}
            className="rounded-md bg-bg-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"
            data-testid="cost-settings-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isLoading}
            className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white hover:bg-status-info/80 disabled:opacity-50"
            data-testid="cost-settings-save"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
