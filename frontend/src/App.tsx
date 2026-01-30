import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ServerDetail } from './pages/ServerDetail';
import { ConfigDiffView } from './pages/ConfigDiffView';
import { ConfigCompliancePage } from './pages/ConfigCompliancePage';
import { Settings } from './pages/Settings';
import { AlertsPage } from './pages/AlertsPage';
import { ActionsPage } from './pages/ActionsPage';
import { CostsPage } from './pages/CostsPage';
import { ScanResultsPage } from './pages/ScanResultsPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { ScansPage } from './pages/ScansPage';
import { DiscoveryPage } from './pages/DiscoveryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/servers/:serverId" element={<ServerDetail />} />
        {/* EP0010: Configuration Management */}
        <Route path="/config" element={<ConfigCompliancePage />} />
        <Route path="/servers/:serverId/config" element={<Navigate to="diff" replace />} />
        <Route path="/servers/:serverId/config/diff" element={<ConfigDiffView />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/scans" element={<ScansPage />} />
        <Route path="/scans/history" element={<ScanHistoryPage />} />
        <Route path="/scans/:scanId" element={<ScanResultsPage />} />
        {/* EP0016: Unified Discovery Page */}
        <Route path="/discovery" element={<DiscoveryPage />} />
        {/* Redirect old Tailscale discovery route to unified discovery */}
        <Route path="/discovery/tailscale" element={<Navigate to="/discovery?tab=tailscale" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
