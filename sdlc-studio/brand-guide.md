# HOME-LAB-HUB: Brand Identity & Design System

**Version:** 1.0.0
**Status:** Draft
**Date:** January 2026

---

## 1. Core Philosophy

**Mission Control for Your Digital Home.**

HomelabCmd channels the spirit of 1980s command centres—NASA mission control, mainframe terminals, the phosphor glow of late-night server rooms. It's retro-futuristic: nostalgic enough to feel familiar, modern enough to be genuinely useful.

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Glanceable** | Status visible in 2 seconds. Colour tells the story before text does. |
| **Calm Technology** | Stays out of the way when things are fine. Demands attention only when needed. |
| **Authentic Retro** | Real terminal aesthetics, not pastiche. Functional first, nostalgic second. |
| **Warm Dark** | Dark mode that doesn't feel like a void. Subtle warmth, soft edges. |

### Keywords

- Mission Control, Command Centre, Terminal, Phosphor, CRT
- Monitoring, Heartbeat, Pulse, Signal, Status
- Home, Hub, Network, Fleet, Constellation

### Anti-Patterns

- No flat grey "corporate dashboard" aesthetic
- No harsh pure black backgrounds (#000000)
- No neon overload or excessive glow effects
- No skeuomorphic fake buttons or 3D bevels
- No light mode (dark only, by design)

---

## 2. Logo & Wordmark

### Primary Logo Concept

The logo combines a **house silhouette** with a **terminal cursor**, representing the intersection of home and technology.

```
    ┌─────────┐
   ╱           ╲
  ╱      █      ╲
 ╱       █       ╲
┌─────────────────┐
│                 │
│    ▐█▌  ▐█▌     │
│                 │
│    ┌─────┐      │
│    │ > _ │      │
│    └─────┘      │
└─────────────────┘
```

**Simplified Icon (Favicon/App Icon):**
- House outline with rounded corners
- Single blinking cursor inside
- Works at 16×16, 32×32, 64×64

### Wordmark

**Full:** `HomelabCmd`
**Display:** `HomelabCmd`
**Short:** `HLH`

**Typography:** Space Grotesk Bold, lowercase with hyphens
**Colour:** Signal Green (#4ADE80) on dark backgrounds

### Logo Specifications

| Context | Format | Minimum Size |
|---------|--------|--------------|
| Favicon | Icon only | 16×16px |
| Header | Icon + Wordmark | 32px height |
| Splash/Hero | Icon + Wordmark | 48px height |
| Social/OG | Icon centred | 200×200px |

### Logo Clear Space

Maintain clear space equal to the height of the cursor element on all sides.

---

## 3. Colour System

### The "Phosphor" Palette

Built around the authentic colours of vintage CRT monitors—green phosphor for data, amber for warnings, with a warm charcoal base that's easier on the eyes than pure black.

#### Core Colours

| Role | Name | Hex | RGB | Usage |
|------|------|-----|-----|-------|
| **Background Primary** | Deep Space | `#0D1117` | 13, 17, 23 | Main application background |
| **Background Secondary** | Console Grey | `#161B22` | 22, 27, 34 | Cards, panels, elevated surfaces |
| **Background Tertiary** | Terminal Dark | `#21262D` | 33, 38, 45 | Inputs, interactive elements |
| **Border Default** | Grid Line | `#30363D` | 48, 54, 61 | Borders, dividers |
| **Border Subtle** | Shadow Line | `#21262D` | 33, 38, 45 | Subtle separators |

#### Text Colours

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| **Text Primary** | Bright White | `#F0F6FC` | Headlines, important content |
| **Text Secondary** | Soft White | `#C9D1D9` | Body text, descriptions |
| **Text Tertiary** | Dim Grey | `#8B949E` | Labels, captions, timestamps |
| **Text Muted** | Faded Grey | `#484F58` | Disabled, placeholder text |

#### Status Colours (The Signal System)

| Status | Name | Hex | Glow Hex | Usage |
|--------|------|-----|----------|-------|
| **Online/Success** | Phosphor Green | `#4ADE80` | `#4ADE8033` | Online, running, healthy, success |
| **Warning** | Amber Alert | `#FBBF24` | `#FBBF2433` | Warnings, caution, pending |
| **Error/Critical** | Red Alert | `#F87171` | `#F8717133` | Errors, critical, offline, failed |
| **Info/Neutral** | Terminal Cyan | `#22D3EE` | `#22D3EE33` | Information, links, interactive |

#### Extended Palette (Charts & Differentiation)

| Name | Hex | Usage |
|------|-----|-------|
| Purple Pulse | `#A78BFA` | CPU metrics, secondary data series |
| Blue Signal | `#60A5FA` | Memory metrics, tertiary data series |
| Pink Trace | `#F472B6` | Network metrics, accent |
| Orange Glow | `#FB923C` | Storage metrics, accent |

### Colour Application Rules

1. **Status always wins:** If something has a status, its colour comes from the Signal System
2. **One accent per view:** Don't mix multiple bright colours in the same component
3. **Glow for active states:** Use the `33` opacity glow colours for hover/focus states
4. **Text on dark:** Always ensure WCAG AA contrast (4.5:1 minimum)

### Semantic Tokens (CSS Custom Properties)

```css
:root {
  /* Backgrounds */
  --bg-primary: #0D1117;
  --bg-secondary: #161B22;
  --bg-tertiary: #21262D;
  --bg-elevated: #30363D;
  
  /* Borders */
  --border-default: #30363D;
  --border-subtle: #21262D;
  --border-strong: #484F58;
  
  /* Text */
  --text-primary: #F0F6FC;
  --text-secondary: #C9D1D9;
  --text-tertiary: #8B949E;
  --text-muted: #484F58;
  
  /* Status */
  --status-success: #4ADE80;
  --status-success-glow: rgba(74, 222, 128, 0.2);
  --status-warning: #FBBF24;
  --status-warning-glow: rgba(251, 191, 36, 0.2);
  --status-error: #F87171;
  --status-error-glow: rgba(248, 113, 113, 0.2);
  --status-info: #22D3EE;
  --status-info-glow: rgba(34, 211, 238, 0.2);
  
  /* Interactive */
  --interactive-default: #22D3EE;
  --interactive-hover: #67E8F9;
  --interactive-active: #06B6D4;
}
```

---

## 4. Typography System

### Font Stack

#### Primary: Space Grotesk

**Usage:** Headlines, titles, navigation, buttons
**Character:** Geometric, slightly retro-futuristic, excellent legibility
**Weights:** Medium (500), Bold (700)
**Source:** Google Fonts (free)

```css
font-family: 'Space Grotesk', system-ui, sans-serif;
```

#### Secondary: JetBrains Mono

**Usage:** Data, metrics, code, timestamps, labels, terminal output
**Character:** Purpose-built for code, excellent number legibility, ligatures
**Weights:** Regular (400), Medium (500), Bold (700)
**Source:** Google Fonts (free)

```css
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Type Scale

| Name | Size | Line Height | Weight | Font | Usage |
|------|------|-------------|--------|------|-------|
| **Display** | 48px / 3rem | 1.1 | 700 | Space Grotesk | Hero headlines |
| **H1** | 32px / 2rem | 1.2 | 700 | Space Grotesk | Page titles |
| **H2** | 24px / 1.5rem | 1.3 | 700 | Space Grotesk | Section headers |
| **H3** | 20px / 1.25rem | 1.4 | 500 | Space Grotesk | Card titles |
| **H4** | 16px / 1rem | 1.4 | 500 | Space Grotesk | Subsections |
| **Body** | 14px / 0.875rem | 1.6 | 400 | Space Grotesk | Body copy |
| **Body Small** | 12px / 0.75rem | 1.5 | 400 | Space Grotesk | Secondary text |
| **Data Large** | 32px / 2rem | 1.1 | 700 | JetBrains Mono | Big metrics (CPU: 45%) |
| **Data Medium** | 20px / 1.25rem | 1.2 | 500 | JetBrains Mono | Metric values |
| **Data Small** | 14px / 0.875rem | 1.4 | 400 | JetBrains Mono | Timestamps, IPs |
| **Label** | 11px / 0.6875rem | 1.3 | 500 | JetBrains Mono | Labels, captions |
| **Code** | 13px / 0.8125rem | 1.5 | 400 | JetBrains Mono | Code blocks |

### Typography CSS

```css
/* Font imports */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

/* Base typography */
body {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Headlines */
h1, h2, h3, h4 {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  color: var(--text-primary);
  margin: 0;
}

h1 { font-size: 2rem; font-weight: 700; line-height: 1.2; }
h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.3; }
h3 { font-size: 1.25rem; font-weight: 500; line-height: 1.4; }
h4 { font-size: 1rem; font-weight: 500; line-height: 1.4; }

/* Monospace elements */
code, .metric, .timestamp, .ip-address, [data-mono] {
  font-family: 'JetBrains Mono', monospace;
}

/* Labels - uppercase monospace */
.label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
}

/* Large metrics */
.metric-large {
  font-family: 'JetBrains Mono', monospace;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--text-primary);
}
```

---

## 5. Spacing System

### Base Unit

**4px base** - All spacing derived from multiples of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight gaps, icon padding |
| `--space-2` | 8px | Related element gaps |
| `--space-3` | 12px | Default padding |
| `--space-4` | 16px | Card padding, section gaps |
| `--space-5` | 20px | Component margins |
| `--space-6` | 24px | Large gaps |
| `--space-8` | 32px | Section margins |
| `--space-10` | 40px | Page section spacing |
| `--space-12` | 48px | Major section breaks |

### CSS Custom Properties

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

---

## 6. Border Radius System

Rounded corners throughout—friendly, modern, anti-corporate.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Small buttons, tags, badges |
| `--radius-md` | 8px | Buttons, inputs, small cards |
| `--radius-lg` | 12px | Cards, panels, modals |
| `--radius-xl` | 16px | Large cards, feature panels |
| `--radius-full` | 9999px | Pills, circular indicators |

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

---

## 7. Shadow System

Subtle shadows that suggest depth without breaking the dark aesthetic.

```css
:root {
  /* Elevation shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.6);
  
  /* Glow effects (for status indicators) */
  --glow-success: 0 0 12px var(--status-success-glow);
  --glow-warning: 0 0 12px var(--status-warning-glow);
  --glow-error: 0 0 12px var(--status-error-glow);
  --glow-info: 0 0 12px var(--status-info-glow);
}
```

---

## 8. Component Library

### 8.1 Status Indicator (LED)

The signature element—a pulsing LED that shows server/service status at a glance.

```css
.status-led {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.status-led--online {
  background-color: var(--status-success);
  box-shadow: var(--glow-success);
  animation: pulse-green 2s ease-in-out infinite;
}

.status-led--warning {
  background-color: var(--status-warning);
  box-shadow: var(--glow-warning);
  animation: pulse-amber 1.5s ease-in-out infinite;
}

.status-led--offline {
  background-color: var(--status-error);
  box-shadow: var(--glow-error);
  animation: pulse-red 1s ease-in-out infinite;
}

.status-led--unknown {
  background-color: var(--text-muted);
  box-shadow: none;
}

/* Pulse animations */
@keyframes pulse-green {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--status-success-glow); }
  50% { opacity: 0.7; box-shadow: 0 0 16px var(--status-success-glow); }
}

@keyframes pulse-amber {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--status-warning-glow); }
  50% { opacity: 0.8; box-shadow: 0 0 14px var(--status-warning-glow); }
}

@keyframes pulse-red {
  0%, 100% { opacity: 1; box-shadow: 0 0 10px var(--status-error-glow); }
  50% { opacity: 0.6; box-shadow: 0 0 20px var(--status-error-glow); }
}
```

**HTML:**
```html
<span class="status-led status-led--online" aria-label="Online"></span>
<span class="status-led status-led--warning" aria-label="Warning"></span>
<span class="status-led status-led--offline" aria-label="Offline"></span>
```

### 8.2 Server Card

The primary dashboard element.

```css
.server-card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.server-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.server-card--warning {
  border-color: var(--status-warning);
}

.server-card--critical {
  border-color: var(--status-error);
  box-shadow: var(--glow-error);
}

.server-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.server-card__name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

.server-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.server-card__metric {
  text-align: center;
}

.server-card__metric-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.server-card__metric-value--warning {
  color: var(--status-warning);
}

.server-card__metric-value--critical {
  color: var(--status-error);
}

.server-card__metric-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
}

.server-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
}

.server-card__uptime {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-tertiary);
}
```

**HTML Structure:**
```html
<div class="server-card">
  <div class="server-card__header">
    <span class="status-led status-led--online"></span>
    <h3 class="server-card__name">OMV MediaServer</h3>
  </div>
  
  <div class="server-card__metrics">
    <div class="server-card__metric">
      <div class="server-card__metric-value">45%</div>
      <div class="server-card__metric-label">CPU</div>
    </div>
    <div class="server-card__metric">
      <div class="server-card__metric-value">62%</div>
      <div class="server-card__metric-label">RAM</div>
    </div>
    <div class="server-card__metric">
      <div class="server-card__metric-value server-card__metric-value--warning">82%</div>
      <div class="server-card__metric-label">Disk</div>
    </div>
  </div>
  
  <div class="server-card__footer">
    <span class="server-card__uptime">↑ 12d 4h</span>
  </div>
</div>
```

### 8.3 Buttons

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

/* Primary - Cyan */
.btn--primary {
  background-color: var(--interactive-default);
  color: var(--bg-primary);
  border-color: var(--interactive-default);
}

.btn--primary:hover {
  background-color: var(--interactive-hover);
  border-color: var(--interactive-hover);
}

/* Secondary - Ghost */
.btn--secondary {
  background-color: transparent;
  color: var(--text-secondary);
  border-color: var(--border-default);
}

.btn--secondary:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

/* Success - Green */
.btn--success {
  background-color: var(--status-success);
  color: var(--bg-primary);
  border-color: var(--status-success);
}

.btn--success:hover {
  background-color: #5EE898;
}

/* Danger - Red */
.btn--danger {
  background-color: transparent;
  color: var(--status-error);
  border-color: var(--status-error);
}

.btn--danger:hover {
  background-color: var(--status-error);
  color: var(--bg-primary);
}

/* Small variant */
.btn--sm {
  padding: var(--space-1) var(--space-3);
  font-size: 12px;
  border-radius: var(--radius-sm);
}

/* Icon-only */
.btn--icon {
  padding: var(--space-2);
  width: 36px;
  height: 36px;
}
```

### 8.4 Input Fields

Terminal-style inputs with soft edges.

```css
.input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input::placeholder {
  color: var(--text-muted);
}

.input:focus {
  outline: none;
  border-color: var(--interactive-default);
  box-shadow: 0 0 0 3px var(--status-info-glow);
}

.input--error {
  border-color: var(--status-error);
}

.input--error:focus {
  box-shadow: 0 0 0 3px var(--status-error-glow);
}

/* Label */
.input-label {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
}
```

### 8.5 Alert Banners

```css
.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid;
}

.alert--critical {
  background-color: rgba(248, 113, 113, 0.1);
  border-color: var(--status-error);
}

.alert--warning {
  background-color: rgba(251, 191, 36, 0.1);
  border-color: var(--status-warning);
}

.alert--success {
  background-color: rgba(74, 222, 128, 0.1);
  border-color: var(--status-success);
}

.alert--info {
  background-color: rgba(34, 211, 238, 0.1);
  border-color: var(--status-info);
}

.alert__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.alert--critical .alert__icon { color: var(--status-error); }
.alert--warning .alert__icon { color: var(--status-warning); }
.alert--success .alert__icon { color: var(--status-success); }
.alert--info .alert__icon { color: var(--status-info); }

.alert__content {
  flex: 1;
}

.alert__title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 var(--space-1) 0;
}

.alert__message {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.alert__timestamp {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
```

### 8.6 Metric Gauge (Progress Bar)

For CPU, RAM, Disk visual indicators.

```css
.gauge {
  width: 100%;
  height: 6px;
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.gauge__fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.gauge__fill--success {
  background-color: var(--status-success);
}

.gauge__fill--warning {
  background-color: var(--status-warning);
}

.gauge__fill--critical {
  background-color: var(--status-error);
}
```

### 8.7 Terminal Output Block

For logs, command output, scan results.

```css
.terminal {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow-x: auto;
}

.terminal__prompt {
  color: var(--status-success);
}

.terminal__prompt::before {
  content: '❯ ';
  color: var(--status-info);
}

.terminal__output {
  color: var(--text-secondary);
}

.terminal__error {
  color: var(--status-error);
}

.terminal__success {
  color: var(--status-success);
}

.terminal__timestamp {
  color: var(--text-muted);
}
```

**HTML:**
```html
<div class="terminal">
  <div class="terminal__prompt">systemctl restart plex</div>
  <div class="terminal__output">Restarting plex.service...</div>
  <div class="terminal__success">● plex.service - Plex Media Server</div>
  <div class="terminal__output">   Loaded: loaded</div>
  <div class="terminal__output">   Active: active (running) since Sun 2026-01-18 14:32:00 GMT</div>
</div>
```

### 8.8 Navigation / Sidebar

```css
.sidebar {
  width: 240px;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-default);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sidebar__logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  margin-bottom: var(--space-4);
}

.sidebar__logo-text {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--status-success);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item--active {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border-left: 2px solid var(--status-success);
  margin-left: -2px;
}

.nav-item__icon {
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
}

.nav-item:hover .nav-item__icon,
.nav-item--active .nav-item__icon {
  color: var(--status-success);
}

.nav-item__badge {
  margin-left: auto;
  background-color: var(--status-error);
  color: var(--bg-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-full);
}
```

---

## 9. Iconography

### Icon Library

Use **Lucide Icons** (https://lucide.dev) — open source, consistent, works well at small sizes.

### Key Icons

| Concept | Icon Name | Usage |
|---------|-----------|-------|
| Dashboard | `layout-dashboard` | Navigation |
| Servers | `server` | Server list, cards |
| Alerts | `alert-triangle` | Alerts section, warning states |
| Settings | `settings` | Configuration |
| Services | `boxes` | Service monitoring |
| Actions | `zap` | Remediation actions |
| Scan | `scan` | Ad-hoc scanning |
| Network | `network` | Network discovery |
| Cost | `pound-sterling` | Cost tracking |
| CPU | `cpu` | CPU metrics |
| Memory | `memory-stick` | RAM metrics |
| Storage | `hard-drive` | Disk metrics |
| Online | `check-circle` | Online status |
| Offline | `x-circle` | Offline status |
| Warning | `alert-circle` | Warning status |
| Uptime | `clock` | Uptime display |
| Refresh | `refresh-cw` | Refresh data |
| Add | `plus` | Add new items |
| Edit | `pencil` | Edit actions |
| Delete | `trash-2` | Delete actions |
| Terminal | `terminal` | Logs, command output |

### Icon Sizing

| Context | Size | Stroke Width |
|---------|------|--------------|
| Navigation | 18px | 2px |
| Card inline | 16px | 2px |
| Button with text | 16px | 2px |
| Large display | 24px | 1.5px |
| Decorative/hero | 32px+ | 1.5px |

### Icon Colours

- Default: `var(--text-tertiary)` (#8B949E)
- Interactive hover: `var(--text-primary)` (#F0F6FC)
- Status icons: Use matching status colour

---

## 10. Animation & Motion

### Principles

1. **Subtle over flashy** — Animations support understanding, not distract
2. **Fast by default** — Most transitions 150-200ms
3. **Purposeful glow** — LED pulsing is the signature motion element
4. **Reduced motion respected** — Honour `prefers-reduced-motion`

### Timing Functions

```css
:root {
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 300ms;
}
```

### Standard Transitions

```css
/* Hover transitions */
.interactive {
  transition: 
    background-color var(--duration-normal) var(--ease-default),
    border-color var(--duration-normal) var(--ease-default),
    color var(--duration-normal) var(--ease-default),
    box-shadow var(--duration-normal) var(--ease-default);
}

/* Metric value changes */
.metric-value {
  transition: color var(--duration-slow) var(--ease-default);
}

/* Gauge fill */
.gauge__fill {
  transition: width var(--duration-slow) var(--ease-out);
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .status-led {
    animation: none;
  }
}
```

---

## 11. Layout Patterns

### Dashboard Grid

```css
.dashboard {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.dashboard__sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.dashboard__main {
  padding: var(--space-6);
  background-color: var(--bg-primary);
}

.dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.dashboard__title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}
```

### Server Card Grid

```css
.server-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

@media (max-width: 640px) {
  .server-grid {
    grid-template-columns: 1fr;
  }
}
```

### Summary Bar

```css
.summary-bar {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-6);
}

.summary-bar__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.summary-bar__value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.summary-bar__label {
  font-size: 13px;
  color: var(--text-tertiary);
}
```

---

## 12. Responsive Breakpoints

```css
/* Mobile first approach */

/* Small (mobile) - default */
/* Base styles apply */

/* Medium (tablet) */
@media (min-width: 640px) {
  /* 2-column layouts */
}

/* Large (desktop) */
@media (min-width: 1024px) {
  /* Full sidebar visible */
  /* 3-4 column grids */
}

/* Extra large (wide desktop) */
@media (min-width: 1280px) {
  /* Max content width constraints */
}
```

### Mobile Adaptations

- Sidebar collapses to hamburger menu
- Server cards stack vertically
- Summary bar wraps to 2×2 grid
- Metric values remain large for glanceability

---

## 13. Implementation Checklist

### CSS Setup

1. [ ] Import Google Fonts (Space Grotesk, JetBrains Mono)
2. [ ] Define CSS custom properties (colours, spacing, radii)
3. [ ] Set base typography on `body`
4. [ ] Create utility classes for common patterns

### React/Tailwind Integration

If using Tailwind CSS, extend the config:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0D1117',
        'bg-secondary': '#161B22',
        'bg-tertiary': '#21262D',
        'border-default': '#30363D',
        'text-primary': '#F0F6FC',
        'text-secondary': '#C9D1D9',
        'text-tertiary': '#8B949E',
        'status-success': '#4ADE80',
        'status-warning': '#FBBF24',
        'status-error': '#F87171',
        'status-info': '#22D3EE',
      },
      fontFamily: {
        'sans': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
    },
  },
}
```

### Component Priority

Build in this order:

1. [ ] Status LED indicator
2. [ ] Server card
3. [ ] Navigation sidebar
4. [ ] Summary bar
5. [ ] Buttons
6. [ ] Input fields
7. [ ] Alert banners
8. [ ] Terminal output block
9. [ ] Metric gauge

---

## 14. Assets Checklist

| Asset | Format | Sizes |
|-------|--------|-------|
| Favicon | .ico, .png | 16, 32, 48 |
| App icon | .png | 180, 192, 512 |
| OG image | .png | 1200×630 |
| Logo (full) | .svg | Vector |
| Logo (icon) | .svg | Vector |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0.0 | Initial brand guide |
