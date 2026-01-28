import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TailscaleBadge } from './TailscaleBadge';

describe('TailscaleBadge', () => {
  describe('US0111: Connectivity Badge', () => {
    describe('AC1: Tailscale badge on connected servers', () => {
      it('shows badge when tailscale_hostname is set', () => {
        render(<TailscaleBadge tailscaleHostname="server.tail12345.ts.net" />);

        const badge = screen.getByTestId('tailscale-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('Tailscale');
      });

      it('badge contains Network icon', () => {
        render(<TailscaleBadge tailscaleHostname="server.tail12345.ts.net" />);

        const badge = screen.getByTestId('tailscale-badge');
        const svg = badge.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });

    describe('AC2: Badge placement and styling', () => {
      it('badge has correct styling classes', () => {
        render(<TailscaleBadge tailscaleHostname="server.tail12345.ts.net" />);

        const badge = screen.getByTestId('tailscale-badge');
        expect(badge).toHaveClass('bg-blue-500/10');
        expect(badge).toHaveClass('text-blue-600');
      });

      it('badge is small (text-[10px])', () => {
        render(<TailscaleBadge tailscaleHostname="server.tail12345.ts.net" />);

        const badge = screen.getByTestId('tailscale-badge');
        expect(badge).toHaveClass('text-[10px]');
      });
    });

    describe('AC3: Tooltip with hostname', () => {
      it('badge has tooltip with hostname', () => {
        render(<TailscaleBadge tailscaleHostname="myserver.tail12345.ts.net" />);

        const badge = screen.getByTestId('tailscale-badge');
        expect(badge).toHaveAttribute(
          'title',
          'Connected via Tailscale: myserver.tail12345.ts.net'
        );
      });

      it('truncates very long hostnames in tooltip', () => {
        const longHostname =
          'verylongservername-with-lots-of-characters.tail12345.ts.net';
        render(<TailscaleBadge tailscaleHostname={longHostname} />);

        const badge = screen.getByTestId('tailscale-badge');
        const title = badge.getAttribute('title');
        expect(title).toContain('...');
        expect(title!.length).toBeLessThan(
          `Connected via Tailscale: ${longHostname}`.length
        );
      });
    });

    describe('AC4: No badge for non-Tailscale servers', () => {
      it('returns null when tailscale_hostname is null', () => {
        const { container } = render(<TailscaleBadge tailscaleHostname={null} />);

        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId('tailscale-badge')).not.toBeInTheDocument();
      });

      it('returns null when tailscale_hostname is undefined', () => {
        const { container } = render(<TailscaleBadge tailscaleHostname={undefined} />);

        expect(container.firstChild).toBeNull();
      });

      it('returns null when tailscale_hostname is empty string', () => {
        const { container } = render(<TailscaleBadge tailscaleHostname="" />);

        expect(container.firstChild).toBeNull();
      });

      it('returns null when tailscale_hostname is whitespace only', () => {
        const { container } = render(<TailscaleBadge tailscaleHostname="   " />);

        expect(container.firstChild).toBeNull();
      });
    });
  });
});
