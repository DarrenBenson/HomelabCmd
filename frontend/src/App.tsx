import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ServerDetail } from './pages/ServerDetail';
import { Settings } from './pages/Settings';
import { AlertsPage } from './pages/AlertsPage';
import { ActionsPage } from './pages/ActionsPage';
import { CostsPage } from './pages/CostsPage';
import { ScanResultsPage } from './pages/ScanResultsPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { ScansPage } from './pages/ScansPage';
import { TailscaleDevices } from './pages/TailscaleDevices';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/servers/:serverId" element={<ServerDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/scans" element={<ScansPage />} />
        <Route path="/scans/history" element={<ScanHistoryPage />} />
        <Route path="/scans/:scanId" element={<ScanResultsPage />} />
        <Route path="/discovery/tailscale" element={<TailscaleDevices />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
