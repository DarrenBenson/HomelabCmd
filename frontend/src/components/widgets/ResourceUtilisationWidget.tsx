import { Gauge } from '../Gauge';
import { formatMemoryCompact, formatDiskCompact } from '../../lib/formatters';
import { WidgetContainer } from './WidgetContainer';
import type { WidgetProps } from './types';

interface ResourceUtilisationWidgetProps extends WidgetProps {
  isEditMode?: boolean;
}

/**
 * Resource Utilisation Widget
 *
 * Displays CPU, RAM, and Disk usage gauges.
 */
export function ResourceUtilisationWidget({
  machine,
  isEditMode = false,
}: ResourceUtilisationWidgetProps) {
  const metrics = machine.latest_metrics;

  return (
    <WidgetContainer
      title="Resource Utilisation"
      isEditMode={isEditMode}
    >
      <div className="flex flex-wrap justify-center gap-8 sm:justify-start">
        <Gauge
          value={metrics?.cpu_percent ?? null}
          label="CPU"
        />
        <Gauge
          value={metrics?.memory_percent ?? null}
          label="RAM"
          absoluteValue={formatMemoryCompact(metrics?.memory_used_mb ?? null, metrics?.memory_total_mb ?? null)}
        />
        <Gauge
          value={metrics?.disk_percent ?? null}
          label="Disk"
          absoluteValue={formatDiskCompact(metrics?.disk_used_gb ?? null, metrics?.disk_total_gb ?? null)}
        />
      </div>
    </WidgetContainer>
  );
}
