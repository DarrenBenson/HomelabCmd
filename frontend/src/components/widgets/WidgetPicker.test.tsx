import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WidgetPicker } from './WidgetPicker';
import type { WidgetId } from './types';

describe('WidgetPicker', () => {
  const defaultProps = {
    visibleWidgets: ['cpu_chart', 'memory_gauge'] as WidgetId[],
    machineType: 'server' as const,
    onAddWidget: vi.fn(),
  };

  it('renders Add Widget button', () => {
    render(<WidgetPicker {...defaultProps} />);

    expect(screen.getByTestId('add-widget-button')).toBeInTheDocument();
    expect(screen.getByText('Add Widget')).toBeInTheDocument();
  });

  it('opens dropdown when button is clicked', () => {
    render(<WidgetPicker {...defaultProps} />);

    fireEvent.click(screen.getByTestId('add-widget-button'));

    expect(screen.getByTestId('widget-picker-menu')).toBeInTheDocument();
    expect(screen.getByText('Available Widgets')).toBeInTheDocument();
  });

  it('shows hidden widgets in dropdown', () => {
    render(<WidgetPicker {...defaultProps} />);

    fireEvent.click(screen.getByTestId('add-widget-button'));

    // Disk widget is not in visibleWidgets, so it should appear
    expect(screen.getByTestId('widget-picker-item-disk_usage')).toBeInTheDocument();
    // Services widget should also appear
    expect(screen.getByTestId('widget-picker-item-services')).toBeInTheDocument();
  });

  it('does not show already visible widgets in dropdown', () => {
    render(<WidgetPicker {...defaultProps} />);

    fireEvent.click(screen.getByTestId('add-widget-button'));

    // cpu_chart and memory_gauge are already visible, so they shouldn't appear
    expect(screen.queryByTestId('widget-picker-item-cpu_chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('widget-picker-item-memory_gauge')).not.toBeInTheDocument();
  });

  it('calls onAddWidget when a widget is selected', () => {
    const onAddWidget = vi.fn();
    render(<WidgetPicker {...defaultProps} onAddWidget={onAddWidget} />);

    fireEvent.click(screen.getByTestId('add-widget-button'));
    fireEvent.click(screen.getByTestId('widget-picker-item-disk_usage'));

    expect(onAddWidget).toHaveBeenCalledWith('disk_usage');
  });

  it('closes dropdown after selecting a widget', () => {
    render(<WidgetPicker {...defaultProps} />);

    fireEvent.click(screen.getByTestId('add-widget-button'));
    expect(screen.getByTestId('widget-picker-menu')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('widget-picker-item-disk_usage'));

    expect(screen.queryByTestId('widget-picker-menu')).not.toBeInTheDocument();
  });

  it('disables Add Widget button when all widgets are visible', () => {
    const allWidgets: WidgetId[] = [
      'cpu_chart',
      'memory_gauge',
      'disk_usage',
      'load_average',
      'network',
      'services',
      'server_info',
      'system_info',
      'containers',
      'compliance_dashboard',
    ];

    render(<WidgetPicker {...defaultProps} visibleWidgets={allWidgets} />);

    const button = screen.getByTestId('add-widget-button');
    expect(button).toBeDisabled();
  });

  it('shows widget descriptions', () => {
    render(<WidgetPicker {...defaultProps} />);

    fireEvent.click(screen.getByTestId('add-widget-button'));

    // Check that descriptions are shown
    expect(screen.getByText(/Disk space usage/)).toBeInTheDocument();
  });

  it('shows unavailability reason for widgets requiring features', () => {
    render(
      <WidgetPicker
        {...defaultProps}
        machineType="server"
        machineFeatures={[]} // No docker
      />
    );

    fireEvent.click(screen.getByTestId('add-widget-button'));

    // Containers widget requires docker
    const containersItem = screen.getByTestId('widget-picker-item-containers');
    expect(containersItem).toBeInTheDocument();
    expect(screen.getByText('Requires Docker')).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <WidgetPicker {...defaultProps} />
        <div data-testid="outside">Outside</div>
      </div>
    );

    fireEvent.click(screen.getByTestId('add-widget-button'));
    expect(screen.getByTestId('widget-picker-menu')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(screen.queryByTestId('widget-picker-menu')).not.toBeInTheDocument();
  });
});
