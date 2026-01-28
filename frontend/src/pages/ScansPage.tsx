/**
 * ScansPage - Main page for scan initiation and network discovery.
 *
 * Features:
 * - Manual scan section with hostname input
 * - Network discovery section
 * - Integration between discovery and scan initiation
 *
 * US0038: Scan Initiation
 * US0041: Network Discovery
 * US0042: Scan Dashboard Integration
 */

import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Zap, Server, Loader2 } from 'lucide-react';
import { NetworkDiscovery } from '../components/NetworkDiscovery';
import { RecentScans } from '../components/RecentScans';
import { api } from '../api/client';
import type { ScanStatusResponse } from '../types/scan';

interface ScanRequest {
  hostname: string;
  port?: number;
  username?: string;
  scan_type: 'quick' | 'full';
}

export function ScansPage() {
  const navigate = useNavigate();
  const hostnameInputRef = useRef<HTMLInputElement>(null);

  // Manual scan state
  const [hostname, setHostname] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Discovery state - initialise from localStorage
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<number | undefined>(() => {
    const storedId = localStorage.getItem('activeDiscoveryId');
    return storedId ? parseInt(storedId, 10) : undefined;
  });

  // Save active discovery to localStorage
  function handleDiscoveryStart(discoveryId: number) {
    setActiveDiscoveryId(discoveryId);
    localStorage.setItem('activeDiscoveryId', discoveryId.toString());
  }

  // Handle device selection from discovery
  function handleSelectDevice(ip: string) {
    setHostname(ip);
    setScanError(null);
    // Focus and scroll to the input
    hostnameInputRef.current?.focus();
    hostnameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Initiate a scan
  async function handleScan(scanType: 'quick' | 'full') {
    if (!hostname.trim()) {
      setScanError('Please enter a hostname or IP address');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const request: ScanRequest = {
        hostname: hostname.trim(),
        scan_type: scanType,
      };

      const response = await api.post<ScanStatusResponse>('/api/v1/scans', request);
      navigate(`/scans/${response.scan_id}`);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to start scan');
      setIsScanning(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-default px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Scans</h1>
              <p className="text-sm text-text-tertiary">Ad-hoc device scanning and network discovery</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Manual Scan Section */}
        <section className="rounded-lg border border-border-default bg-bg-secondary p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-text-tertiary" />
            <h2 className="text-lg font-medium text-text-primary">Manual Scan</h2>
          </div>

          <p className="text-sm text-text-tertiary mb-4">
            Enter a hostname or IP address to scan. Quick scans collect basic system info;
            full scans include packages, processes, and network interfaces.
          </p>

          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="hostname" className="sr-only">
                Hostname or IP
              </label>
              <input
                ref={hostnameInputRef}
                id="hostname"
                type="text"
                placeholder="Hostname or IP address..."
                value={hostname}
                onChange={(e) => {
                  setHostname(e.target.value);
                  setScanError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isScanning) {
                    handleScan('quick');
                  }
                }}
                disabled={isScanning}
                className="w-full bg-bg-tertiary border border-border-default rounded-md px-4 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-status-info disabled:opacity-50"
                data-testid="hostname-input"
              />
            </div>

            <button
              onClick={() => handleScan('quick')}
              disabled={isScanning || !hostname.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90 transition-colors disabled:opacity-50"
              data-testid="quick-scan-button"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Quick Scan
            </button>

            <button
              onClick={() => handleScan('full')}
              disabled={isScanning || !hostname.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-primary border border-border-default rounded-md font-medium hover:bg-bg-secondary transition-colors disabled:opacity-50"
              data-testid="full-scan-button"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Server className="w-4 h-4" />
              )}
              Full Scan
            </button>
          </div>

          {scanError && (
            <p className="mt-3 text-sm text-status-error" data-testid="scan-error">
              {scanError}
            </p>
          )}
        </section>

        {/* Network Discovery Section */}
        <NetworkDiscovery
          onSelectDevice={handleSelectDevice}
          activeDiscoveryId={activeDiscoveryId}
          onDiscoveryStart={handleDiscoveryStart}
        />

        {/* Recent Scans Section (US0042 AC4) */}
        <RecentScans />
      </main>
    </div>
  );
}
