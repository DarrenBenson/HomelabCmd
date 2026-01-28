# PL0008: Dashboard Server List - Implementation Plan

> **Status:** Complete
> **Story:** [US0005: Dashboard Server List](../stories/US0005-dashboard-server-list.md)
> **Epic:** [EP0001: Core Monitoring](../epics/EP0001-core-monitoring.md)
> **Created:** 2026-01-18
> **Language:** TypeScript

## Overview

This plan implements the React frontend dashboard for HomelabCmd. The dashboard displays a grid of server cards showing status (online/offline with LED indicator), hostname, and key metrics (CPU, RAM, Disk, uptime). This is the first frontend story and requires setting up the complete React + Vite + Tailwind stack with the brand guide design system.

## Acceptance Criteria Summary

| AC | Name | Description |
|----|------|-------------|
| AC1 | Displays all servers | All registered servers visible in grid layout |
| AC2 | Status LED online | Pulsing green LED for online servers |
| AC3 | Status LED offline | Solid red LED for offline servers |
| AC4 | Key metrics shown | CPU%, RAM%, Disk%, uptime displayed |
| AC5 | Fast page load | Complete load in under 2 seconds |
| AC6 | Brand compliance | Colours, typography match brand guide |

## Technical Context

### Language & Framework

- **Primary Language:** TypeScript 5.0+
- **Framework:** React 18+ with Vite 5.0+
- **Styling:** Tailwind CSS 3.4+ with custom theme
- **Test Framework:** Vitest + React Testing Library

### Relevant Best Practices

From `~/.claude/best-practices/typescript.md`:
- Strict TypeScript configuration
- Type definitions for API responses
- React functional components with hooks
- Proper error boundaries

### Library Documentation (Context7)

| Library | Context7 ID | Key Patterns |
|---------|-------------|--------------|
| React | /websites/react_dev | `useState`, `useEffect` with cleanup for polling, race condition prevention |
| Vite | /vitejs/vite | `npm create vite@latest`, `--template react-ts`, package.json scripts |
| Tailwind CSS | /websites/v3_tailwindcss | `theme.extend.colors` for custom palette, `darkMode: 'class'` |

### Existing Patterns

From completed backend stories:
- Server list API: `GET /api/v1/servers` returns `{ servers: [...], total: number }`
- Auth: `X-API-Key` header required
- Server status values: "online", "offline", "unknown"

### Brand Guide Reference

Key design tokens from `sdlc-studio/brand-guide.md`:
- **Backgrounds:** bg-primary (#0D1117), bg-secondary (#161B22)
- **Status colours:** success (#4ADE80), error (#F87171), warning (#FBBF24)
- **Typography:** Space Grotesk (UI), JetBrains Mono (data)
- **Components:** Status LED with pulse animation, Server Card layout

## Recommended Approach

**Strategy:** Test-After
**Rationale:** This is greenfield frontend work requiring project scaffolding. Visual components are better validated through manual testing and Storybook-style development. Unit tests will be added after core components are functional.

### Test Priority

1. Server card renders with correct data
2. Status LED shows correct colour for status
3. Dashboard fetches and displays servers
4. Auto-refresh polling works correctly
5. Empty state renders when no servers
6. Error state renders on API failure

### Documentation Updates Required

- [ ] Update README.md with frontend development instructions
- [ ] Document frontend build and deployment

## Implementation Steps

### Phase 1: Project Scaffolding

**Goal:** Create React + TypeScript + Vite + Tailwind project structure

#### Step 1.1: Create Vite React TypeScript project

- [ ] Create `frontend/` directory at project root
- [ ] Scaffold Vite project with React TypeScript template
- [ ] Install dependencies (Tailwind, Lucide icons)
- [ ] Configure TypeScript strict mode

**Commands:**
```bash
cd /home/darren/code/DarrenBenson/HomelabCmd
mkdir frontend && cd frontend
npm create vite@latest . -- --template react-ts
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react
npx tailwindcss init -p
```

**Files to create:**
- `frontend/package.json` (scaffolded)
- `frontend/vite.config.ts` (scaffolded)
- `frontend/tsconfig.json` (scaffolded)
- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`

#### Step 1.2: Configure Tailwind with brand theme

- [ ] Set up Tailwind config with brand colours
- [ ] Configure custom fonts (Space Grotesk, JetBrains Mono)
- [ ] Set dark mode to class-based
- [ ] Configure content paths

**Tailwind configuration:**
```javascript
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0D1117',
        'bg-secondary': '#161B22',
        'bg-tertiary': '#21262D',
        'border-default': '#30363D',
        'border-subtle': '#21262D',
        'border-strong': '#484F58',
        'text-primary': '#F0F6FC',
        'text-secondary': '#C9D1D9',
        'text-tertiary': '#8B949E',
        'text-muted': '#484F58',
        'status-success': '#4ADE80',
        'status-warning': '#FBBF24',
        'status-error': '#F87171',
        'status-info': '#22D3EE',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      animation: {
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
        'pulse-red': 'pulse-red 1s ease-in-out infinite',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px rgba(74, 222, 128, 0.2)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 16px rgba(74, 222, 128, 0.2)' },
        },
        'pulse-red': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 10px rgba(248, 113, 113, 0.2)' },
          '50%': { opacity: '0.6', boxShadow: '0 0 20px rgba(248, 113, 113, 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
```

#### Step 1.3: Configure base styles and fonts

- [ ] Create index.css with Google Fonts import
- [ ] Set base body styles (dark background)
- [ ] Configure CSS custom properties for consistency

**Base styles:**
```css
/* frontend/src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-bg-primary text-text-secondary antialiased;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

### Phase 2: Type Definitions and API Client

**Goal:** Create TypeScript types and API integration layer

#### Step 2.1: Define TypeScript types

- [ ] Create types for Server entity
- [ ] Create types for Metrics
- [ ] Create types for API responses

**Type definitions:**
```typescript
// frontend/src/types/server.ts
export type ServerStatus = 'online' | 'offline' | 'unknown';

export interface LatestMetrics {
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_percent: number | null;
  uptime_seconds: number | null;
}

export interface Server {
  id: string;
  hostname: string;
  display_name: string | null;
  status: ServerStatus;
  latest_metrics: LatestMetrics | null;
}

export interface ServersResponse {
  servers: Server[];
  total: number;
}
```

#### Step 2.2: Create API client

- [ ] Create API client with fetch wrapper
- [ ] Configure base URL and auth header
- [ ] Add error handling
- [ ] Create getServers function

**API client:**
```typescript
// frontend/src/api/client.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-change-me';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),
};
```

```typescript
// frontend/src/api/servers.ts
import { api } from './client';
import type { ServersResponse } from '../types/server';

export async function getServers(): Promise<ServersResponse> {
  return api.get<ServersResponse>('/api/v1/servers');
}
```

### Phase 3: Core Components

**Goal:** Build reusable UI components following brand guide

#### Step 3.1: Status LED component (AC2, AC3)

- [ ] Create StatusLED component
- [ ] Implement pulse animation for online
- [ ] Handle all status variants (online, offline, unknown)
- [ ] Add accessibility attributes

**Status LED component:**
```typescript
// frontend/src/components/StatusLED.tsx
import { cn } from '../lib/utils';
import type { ServerStatus } from '../types/server';

interface StatusLEDProps {
  status: ServerStatus;
  className?: string;
}

export function StatusLED({ status, className }: StatusLEDProps) {
  return (
    <span
      className={cn(
        'inline-block w-2.5 h-2.5 rounded-full flex-shrink-0',
        {
          'bg-status-success animate-pulse-green': status === 'online',
          'bg-status-error shadow-[0_0_10px_rgba(248,113,113,0.2)]': status === 'offline',
          'bg-text-muted': status === 'unknown',
        },
        className
      )}
      aria-label={status}
      role="status"
    />
  );
}
```

```typescript
// frontend/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Dependencies to add:**
```bash
npm install clsx tailwind-merge
```

#### Step 3.2: Server Card component (AC4)

- [ ] Create ServerCard component
- [ ] Display server name with status LED
- [ ] Display metrics (CPU, RAM, Disk)
- [ ] Display uptime
- [ ] Add hover state
- [ ] Make clickable (navigation placeholder)

**Server Card component:**
```typescript
// frontend/src/components/ServerCard.tsx
import { StatusLED } from './StatusLED';
import type { Server } from '../types/server';

interface ServerCardProps {
  server: Server;
  onClick?: () => void;
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '--';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatPercent(value: number | null): string {
  if (value === null) return '--';
  return `${Math.round(value)}%`;
}

export function ServerCard({ server, onClick }: ServerCardProps) {
  const metrics = server.latest_metrics;

  return (
    <div
      className="bg-bg-secondary border border-border-default rounded-lg p-4 cursor-pointer transition-all duration-150 hover:border-border-strong hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <StatusLED status={server.status} />
        <h3 className="font-sans font-medium text-text-primary truncate">
          {server.display_name || server.hostname}
        </h3>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="font-mono text-xl font-bold text-text-primary">
            {formatPercent(metrics?.cpu_percent ?? null)}
          </div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            CPU
          </div>
        </div>
        <div>
          <div className="font-mono text-xl font-bold text-text-primary">
            {formatPercent(metrics?.memory_percent ?? null)}
          </div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            RAM
          </div>
        </div>
        <div>
          <div className="font-mono text-xl font-bold text-text-primary">
            {formatPercent(metrics?.disk_percent ?? null)}
          </div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Disk
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-border-subtle">
        <span className="font-mono text-xs text-text-tertiary">
          ↑ {formatUptime(metrics?.uptime_seconds ?? null)}
        </span>
      </div>
    </div>
  );
}
```

### Phase 4: Dashboard Page

**Goal:** Implement main dashboard with server grid and polling

#### Step 4.1: Create Dashboard component (AC1, AC5)

- [ ] Create Dashboard page component
- [ ] Fetch servers on mount
- [ ] Implement 30-second polling interval
- [ ] Display server grid
- [ ] Handle loading state
- [ ] Handle empty state
- [ ] Handle error state
- [ ] Prevent race conditions on unmount

**Dashboard component:**
```typescript
// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { ServerCard } from '../components/ServerCard';
import { getServers } from '../api/servers';
import type { Server } from '../types/server';
import { Loader2, ServerOff, AlertCircle } from 'lucide-react';

const POLL_INTERVAL_MS = 30000; // 30 seconds

export function Dashboard() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      try {
        const data = await getServers();
        if (!ignore) {
          setServers(data.servers);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to fetch servers');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchData();

    // Set up polling
    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-status-info animate-spin" />
      </div>
    );
  }

  // Error state
  if (error && servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-status-error" />
        <p className="text-text-secondary">{error}</p>
        <button
          className="px-4 py-2 bg-status-info text-bg-primary rounded-md font-medium hover:bg-status-info/90"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <ServerOff className="w-12 h-12 text-text-tertiary" />
        <h2 className="text-xl font-bold text-text-primary">No servers registered</h2>
        <p className="text-text-tertiary">
          Deploy the agent to your first server to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-default px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-status-success font-sans">
            HomelabCmd
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-text-tertiary text-sm font-mono">
              {servers.length} server{servers.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </header>

      {/* Error toast (when we have cached data) */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-status-error/10 border border-status-error rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
          <span className="text-sm text-text-secondary">Unable to refresh - showing cached data</span>
        </div>
      )}

      {/* Server Grid */}
      <main className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onClick={() => {
                // Navigation to detail view (US0006)
                console.log(`Navigate to /servers/${server.id}`);
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
```

#### Step 4.2: Configure App entry point

- [ ] Update App.tsx to render Dashboard
- [ ] Update main.tsx with proper providers
- [ ] Update index.html with proper meta tags

**App entry point:**
```typescript
// frontend/src/App.tsx
import { Dashboard } from './pages/Dashboard';

function App() {
  return <Dashboard />;
}

export default App;
```

```typescript
// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="HomelabCmd - Mission Control for Your Digital Home" />
    <title>HomelabCmd</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Phase 5: Development Environment

**Goal:** Configure development server and proxy

#### Step 5.1: Configure Vite for API proxy

- [ ] Add API proxy configuration for development
- [ ] Configure environment variables
- [ ] Set up CORS handling

**Vite configuration:**
```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

**Environment variables:**
```bash
# frontend/.env.development
VITE_API_URL=
VITE_API_KEY=dev-key-change-me
```

```bash
# frontend/.env.example
VITE_API_URL=http://localhost:8000
VITE_API_KEY=your-api-key-here
```

### Phase 6: Testing & Validation

**Goal:** Verify all acceptance criteria

#### Step 6.1: Install testing dependencies

- [ ] Install Vitest and React Testing Library
- [ ] Configure test setup
- [ ] Create test utilities

**Testing setup:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```typescript
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

```typescript
// frontend/src/test/setup.ts
import '@testing-library/jest-dom';
```

#### Step 6.2: Write component tests

- [ ] Test StatusLED renders correct styles
- [ ] Test ServerCard displays data correctly
- [ ] Test Dashboard fetches and renders servers

**Example tests:**
```typescript
// frontend/src/components/StatusLED.test.tsx
import { render, screen } from '@testing-library/react';
import { StatusLED } from './StatusLED';

describe('StatusLED', () => {
  it('renders green for online status', () => {
    render(<StatusLED status="online" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-status-success');
  });

  it('renders red for offline status', () => {
    render(<StatusLED status="offline" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-status-error');
  });

  it('renders muted for unknown status', () => {
    render(<StatusLED status="unknown" />);
    const led = screen.getByRole('status');
    expect(led).toHaveClass('bg-text-muted');
  });
});
```

#### Step 6.3: Acceptance Criteria Verification

| AC | Verification Method | Status |
|----|---------------------|--------|
| AC1 | Dashboard renders all servers from API | Pending |
| AC2 | Online servers show pulsing green LED | Pending |
| AC3 | Offline servers show solid red LED | Pending |
| AC4 | CPU%, RAM%, Disk%, uptime displayed | Pending |
| AC5 | Page loads < 2 seconds (Lighthouse) | Pending |
| AC6 | Colours match brand guide hex values | Pending |

## Project Structure (After Implementation)

```
HomelabCmd/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── .env.development
│   ├── .env.example
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── api/
│       │   ├── client.ts
│       │   └── servers.ts
│       ├── components/
│       │   ├── StatusLED.tsx
│       │   ├── StatusLED.test.tsx
│       │   ├── ServerCard.tsx
│       │   └── ServerCard.test.tsx
│       ├── pages/
│       │   └── Dashboard.tsx
│       ├── types/
│       │   └── server.ts
│       ├── lib/
│       │   └── utils.ts
│       └── test/
│           └── setup.ts
├── backend/src/homelab_cmd/           # Existing backend
└── tests/                     # Existing backend tests
```

## Edge Cases

| Scenario | Handling Approach |
|----------|-------------------|
| No servers registered | Show friendly empty state with guidance |
| API request fails | Show error state (first load) or toast (refresh) |
| Server has no metrics | Show "--" placeholder for values |
| Metrics are stale (>5 min) | Future: amber warning indicator |
| Network timeout | Retry on next poll interval |
| Component unmounts during fetch | Ignore flag prevents state update |
| Many servers (>20) | Grid handles scrolling, maintain performance |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CORS issues | Dev blocked | Vite proxy configuration |
| API key exposure | Security | Environment variables, not committed |
| Large bundle size | Slow load | Tree-shaking, lazy loading future |
| Font loading delay | FOUT | Font preload in index.html |
| Polling memory leak | Performance | Cleanup in useEffect |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| US0002 | Story | Server list API (Done) |
| Brand guide | Asset | Colours, typography, components |
| Node.js 20+ | Runtime | For Vite dev server |

## Open Questions

None - design system and API contracts are defined.

## Definition of Done Checklist

- [ ] All acceptance criteria implemented
- [ ] Component tests written and passing
- [ ] Edge cases handled
- [ ] Code follows TypeScript best practices
- [ ] No linting errors (ESLint)
- [ ] Colours match brand guide hex values exactly
- [ ] Fonts are Space Grotesk (UI) and JetBrains Mono (data)
- [ ] Status LED pulse animation implemented
- [ ] Dashboard loads in <2 seconds (lighthouse audit)
- [ ] Responsive on tablet (1024px+)
- [ ] Reduced motion respected
- [ ] Accessible (role, aria-label attributes)

## Notes

Key design decisions:
- **Polling over WebSockets** - Simpler for MVP, 30s interval is acceptable
- **Dark mode only** - Per brand guide anti-patterns
- **No routing yet** - Single page for MVP, US0006 will add React Router
- **API key in env vars** - Not ideal but acceptable for single-user homelab
- **Tailwind over CSS-in-JS** - Matches TRD tech stack, good DX

The frontend will be served from the same container as the backend in production (FastAPI static file serving). For development, Vite proxy handles API requests.

## Next Steps After Completion

- **US0006**: Server Detail View (add React Router, detail page)
- **US0007**: Historical Metrics Charts (add Recharts)
