import { WidgetContainer } from './WidgetContainer';
import type { WidgetProps } from './types';

interface PlaceholderWidgetProps extends WidgetProps {
  /** Widget ID to display */
  widgetId: string;
  /** Widget title */
  title: string;
  /** Whether in edit mode */
  isEditMode?: boolean;
}

/**
 * Placeholder widget for testing and development
 *
 * Displays a simple placeholder showing the widget ID.
 * Will be replaced by actual widget implementations in subsequent stories.
 */
export function PlaceholderWidget({
  widgetId,
  title,
  isEditMode = false,
}: PlaceholderWidgetProps) {
  return (
    <WidgetContainer title={title} isEditMode={isEditMode}>
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-mono text-text-tertiary">{widgetId}</p>
          <p className="mt-1 text-sm text-text-secondary">Widget placeholder</p>
        </div>
      </div>
    </WidgetContainer>
  );
}
