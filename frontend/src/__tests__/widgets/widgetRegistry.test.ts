/**
 * Tests for Widget Registry.
 *
 * EP0012: Widget-Based Server Detail View - US0176 Widget Visibility Toggle
 */

import { describe, it, expect } from 'vitest';
import {
  WIDGET_REGISTRY,
  getWidgetMeta,
  getApplicableWidgets,
  isWidgetAvailable,
} from '../../components/widgets/widgetRegistry';

describe('widgetRegistry', () => {
  describe('WIDGET_REGISTRY', () => {
    it('contains all expected widgets', () => {
      const widgetIds = WIDGET_REGISTRY.map(w => w.id);

      expect(widgetIds).toContain('server_info');
      expect(widgetIds).toContain('system_info');
      expect(widgetIds).toContain('cpu_chart');
      expect(widgetIds).toContain('memory_gauge');
      expect(widgetIds).toContain('load_average');
      expect(widgetIds).toContain('disk_usage');
      expect(widgetIds).toContain('network');
      expect(widgetIds).toContain('services');
      expect(widgetIds).toContain('containers');
    });

    it('all widgets have required properties', () => {
      WIDGET_REGISTRY.forEach(widget => {
        expect(widget.id).toBeDefined();
        expect(widget.title).toBeDefined();
        expect(widget.description).toBeDefined();
        expect(widget.minW).toBeGreaterThan(0);
        expect(widget.minH).toBeGreaterThan(0);
        expect(widget.defaultW).toBeGreaterThanOrEqual(widget.minW);
        expect(widget.defaultH).toBeGreaterThanOrEqual(widget.minH);
        expect(widget.applicableTo.length).toBeGreaterThan(0);
      });
    });

    it('load_average widget is server-only', () => {
      const loadAvg = WIDGET_REGISTRY.find(w => w.id === 'load_average');
      expect(loadAvg?.applicableTo).toEqual(['server']);
    });

    it('services widget requires systemd', () => {
      const services = WIDGET_REGISTRY.find(w => w.id === 'services');
      expect(services?.requiresFeature).toBe('systemd');
      expect(services?.applicableTo).toEqual(['server']);
    });

    it('containers widget requires docker', () => {
      const containers = WIDGET_REGISTRY.find(w => w.id === 'containers');
      expect(containers?.requiresFeature).toBe('docker');
    });
  });

  describe('getWidgetMeta', () => {
    it('returns widget metadata by ID', () => {
      const meta = getWidgetMeta('cpu_chart');

      expect(meta).toBeDefined();
      expect(meta?.id).toBe('cpu_chart');
      expect(meta?.title).toBe('CPU Usage');
    });

    it('returns undefined for unknown widget ID', () => {
      const meta = getWidgetMeta('unknown_widget' as never);

      expect(meta).toBeUndefined();
    });

    it('returns server_info widget metadata', () => {
      const meta = getWidgetMeta('server_info');

      expect(meta?.title).toBe('Server Information');
      expect(meta?.description).toBe('Status, hostname, and quick actions');
    });

    it('returns services widget with feature requirement', () => {
      const meta = getWidgetMeta('services');

      expect(meta?.requiresFeature).toBe('systemd');
    });
  });

  describe('getApplicableWidgets', () => {
    it('returns all widgets applicable to servers', () => {
      const widgets = getApplicableWidgets('server');
      const widgetIds = widgets.map(w => w.id);

      expect(widgetIds).toContain('server_info');
      expect(widgetIds).toContain('system_info');
      expect(widgetIds).toContain('cpu_chart');
      expect(widgetIds).toContain('memory_gauge');
      expect(widgetIds).toContain('load_average');
      expect(widgetIds).toContain('disk_usage');
      expect(widgetIds).toContain('network');
      expect(widgetIds).toContain('services');
      expect(widgetIds).toContain('containers');
    });

    it('returns widgets applicable to workstations (excludes server-only)', () => {
      const widgets = getApplicableWidgets('workstation');
      const widgetIds = widgets.map(w => w.id);

      // Should include shared widgets
      expect(widgetIds).toContain('server_info');
      expect(widgetIds).toContain('system_info');
      expect(widgetIds).toContain('cpu_chart');
      expect(widgetIds).toContain('memory_gauge');
      expect(widgetIds).toContain('disk_usage');
      expect(widgetIds).toContain('network');
      expect(widgetIds).toContain('containers');

      // Should NOT include server-only widgets
      expect(widgetIds).not.toContain('load_average');
      expect(widgetIds).not.toContain('services');
    });

    it('filters by machine type correctly', () => {
      const serverWidgets = getApplicableWidgets('server');
      const workstationWidgets = getApplicableWidgets('workstation');

      // Servers should have more widgets than workstations
      expect(serverWidgets.length).toBeGreaterThan(workstationWidgets.length);
    });
  });

  describe('isWidgetAvailable', () => {
    describe('machine type checks', () => {
      it('returns available for server_info on server', () => {
        const serverInfo = getWidgetMeta('server_info')!;
        const result = isWidgetAvailable(serverInfo, 'server');

        expect(result.available).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('returns available for server_info on workstation', () => {
        const serverInfo = getWidgetMeta('server_info')!;
        const result = isWidgetAvailable(serverInfo, 'workstation');

        expect(result.available).toBe(true);
      });

      it('returns unavailable for load_average on workstation', () => {
        const loadAvg = getWidgetMeta('load_average')!;
        const result = isWidgetAvailable(loadAvg, 'workstation');

        expect(result.available).toBe(false);
        expect(result.reason).toBe('Only available for server');
      });

      it('returns unavailable for services on workstation', () => {
        const services = getWidgetMeta('services')!;
        const result = isWidgetAvailable(services, 'workstation');

        expect(result.available).toBe(false);
        expect(result.reason).toBe('Only available for server');
      });
    });

    describe('feature checks', () => {
      it('returns unavailable for services without systemd feature', () => {
        const services = getWidgetMeta('services')!;
        const result = isWidgetAvailable(services, 'server', []);

        expect(result.available).toBe(false);
        expect(result.reason).toBe('Requires systemd');
      });

      it('returns available for services with systemd feature', () => {
        const services = getWidgetMeta('services')!;
        const result = isWidgetAvailable(services, 'server', ['systemd']);

        expect(result.available).toBe(true);
      });

      it('returns unavailable for containers without docker feature', () => {
        const containers = getWidgetMeta('containers')!;
        const result = isWidgetAvailable(containers, 'server', []);

        expect(result.available).toBe(false);
        expect(result.reason).toBe('Requires Docker');
      });

      it('returns available for containers with docker feature', () => {
        const containers = getWidgetMeta('containers')!;
        const result = isWidgetAvailable(containers, 'server', ['docker']);

        expect(result.available).toBe(true);
      });

      it('returns available for containers on workstation with docker', () => {
        const containers = getWidgetMeta('containers')!;
        const result = isWidgetAvailable(containers, 'workstation', ['docker']);

        expect(result.available).toBe(true);
      });
    });

    describe('combined checks', () => {
      it('checks machine type before feature', () => {
        const services = getWidgetMeta('services')!;
        // Services requires systemd AND is server-only
        const result = isWidgetAvailable(services, 'workstation', ['systemd']);

        // Should fail on machine type first
        expect(result.available).toBe(false);
        expect(result.reason).toBe('Only available for server');
      });

      it('returns available for widgets without feature requirements', () => {
        const cpu = getWidgetMeta('cpu_chart')!;
        const result = isWidgetAvailable(cpu, 'server', []);

        expect(result.available).toBe(true);
      });

      it('handles multiple features correctly', () => {
        const services = getWidgetMeta('services')!;
        const result = isWidgetAvailable(services, 'server', ['docker', 'systemd']);

        expect(result.available).toBe(true);
      });
    });

    describe('default features parameter', () => {
      it('defaults to empty features array when not provided', () => {
        const cpu = getWidgetMeta('cpu_chart')!;
        const result = isWidgetAvailable(cpu, 'server');

        expect(result.available).toBe(true);
      });

      it('handles undefined features for widgets with requirements', () => {
        const services = getWidgetMeta('services')!;
        const result = isWidgetAvailable(services, 'server');

        expect(result.available).toBe(false);
        expect(result.reason).toBe('Requires systemd');
      });
    });
  });

  describe('widget definitions validation', () => {
    it('all widgets have unique IDs', () => {
      const ids = WIDGET_REGISTRY.map(w => w.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });

    it('all widget titles are non-empty', () => {
      WIDGET_REGISTRY.forEach(widget => {
        expect(widget.title.length).toBeGreaterThan(0);
      });
    });

    it('all widget descriptions are non-empty', () => {
      WIDGET_REGISTRY.forEach(widget => {
        expect(widget.description.length).toBeGreaterThan(0);
      });
    });
  });
});
