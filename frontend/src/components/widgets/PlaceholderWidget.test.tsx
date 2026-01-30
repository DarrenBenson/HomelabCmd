/**
 * Tests for PlaceholderWidget component.
 *
 * Tests placeholder rendering for widget testing and development.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlaceholderWidget } from './PlaceholderWidget';
import type { MachineData } from './types';

// Mock machine data required by WidgetProps
const mockMachine: MachineData = {
  id: 'server-1',
  hostname: 'test-server',
  display_name: 'Test Server',
  status: 'online',
  machine_type: 'server',
};

describe('PlaceholderWidget', () => {
  describe('basic rendering', () => {
    it('renders widget ID in placeholder content', () => {
      render(
        <PlaceholderWidget
          widgetId="cpu_chart"
          title="CPU Chart"
          machine={mockMachine}
        />
      );

      expect(screen.getByText('cpu_chart')).toBeInTheDocument();
    });

    it('renders placeholder text', () => {
      render(
        <PlaceholderWidget
          widgetId="memory_gauge"
          title="Memory Gauge"
          machine={mockMachine}
        />
      );

      expect(screen.getByText('Widget placeholder')).toBeInTheDocument();
    });

    it('renders with title passed to WidgetContainer', () => {
      render(
        <PlaceholderWidget
          widgetId="disk_usage"
          title="Disk Usage"
          machine={mockMachine}
        />
      );

      // WidgetContainer displays title in header
      expect(screen.getByText('Disk Usage')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renders with isEditMode false by default', () => {
      render(
        <PlaceholderWidget
          widgetId="services"
          title="Services"
          machine={mockMachine}
        />
      );

      // Widget header without edit mode hint
      expect(screen.queryByText('Drag to move')).not.toBeInTheDocument();
    });

    it('renders with isEditMode true showing edit indicators', () => {
      render(
        <PlaceholderWidget
          widgetId="network"
          title="Network"
          isEditMode={true}
          machine={mockMachine}
        />
      );

      // WidgetContainer shows edit mode hint
      expect(screen.getByText('Drag to move')).toBeInTheDocument();
    });
  });

  describe('content structure', () => {
    it('renders content inside WidgetContainer', () => {
      render(
        <PlaceholderWidget
          widgetId="load_average"
          title="Load Average"
          machine={mockMachine}
        />
      );

      // Widget container has content area
      const content = screen.getByTestId('widget-content');
      expect(content).toBeInTheDocument();
      // Widget ID should be inside content
      expect(content).toHaveTextContent('load_average');
    });

    it('renders widget header with title', () => {
      render(
        <PlaceholderWidget
          widgetId="containers"
          title="Containers"
          machine={mockMachine}
        />
      );

      const header = screen.getByTestId('widget-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Containers');
    });
  });

  describe('different widget IDs', () => {
    it.each([
      ['cpu_chart', 'CPU Chart'],
      ['memory_gauge', 'Memory'],
      ['load_average', 'Load Average'],
      ['disk_usage', 'Disk Usage'],
      ['services', 'Services'],
      ['containers', 'Containers'],
      ['network', 'Network'],
      ['system_info', 'System Info'],
      ['server_info', 'Server Info'],
    ])('renders with widgetId %s and title %s', (widgetId, title) => {
      render(
        <PlaceholderWidget
          widgetId={widgetId}
          title={title}
          machine={mockMachine}
        />
      );

      expect(screen.getByText(widgetId)).toBeInTheDocument();
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });
});
