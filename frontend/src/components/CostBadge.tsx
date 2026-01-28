import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCostSummary } from '../api/costs';
import { formatCost } from '../lib/formatters';
import type { CostSummary } from '../types/cost';
import { Zap } from 'lucide-react';

/**
 * Cost badge component for the dashboard header.
 * Displays daily cost estimate with tooltip showing breakdown.
 */
export function CostBadge() {
  const navigate = useNavigate();
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function fetchCostSummary() {
      try {
        const data = await getCostSummary();
        if (!ignore) {
          setCostSummary(data);
        }
      } catch (err) {
        // Silently fail - badge just won't show if API unavailable
        console.error('Failed to fetch cost summary:', err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchCostSummary();

    return () => {
      ignore = true;
    };
  }, []);

  // Don't render if loading or no data
  if (loading || !costSummary) {
    return null;
  }

  // Don't render if no servers have TDP configured
  if (costSummary.servers_included === 0) {
    return null;
  }

  const handleClick = () => {
    navigate('/costs');
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-3 py-1.5 text-sm font-mono text-text-primary hover:bg-bg-tertiary transition-colors"
        data-testid="cost-badge"
        aria-label="View electricity costs"
      >
        <Zap className="w-4 h-4 text-status-warning" />
        <span data-testid="cost-badge-value">
          {formatCost(costSummary.daily_cost, costSummary.currency_symbol, true)}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute top-full right-0 mt-2 w-56 rounded-lg border border-border-default bg-bg-secondary p-4 shadow-lg z-50"
          data-testid="cost-tooltip"
        >
          <h4 className="mb-3 text-sm font-semibold text-text-primary">
            Estimated Electricity
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Daily:</span>
              <span className="font-mono text-text-primary">
                {formatCost(costSummary.daily_cost, costSummary.currency_symbol)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Monthly:</span>
              <span className="font-mono text-text-primary">
                {formatCost(costSummary.monthly_cost, costSummary.currency_symbol)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border-default text-xs text-text-tertiary">
            <div>Based on {costSummary.servers_included} server{costSummary.servers_included !== 1 ? 's' : ''}</div>
            {costSummary.servers_missing_tdp > 0 && (
              <div className="text-status-warning">
                {costSummary.servers_missing_tdp} server{costSummary.servers_missing_tdp !== 1 ? 's' : ''} not configured
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
