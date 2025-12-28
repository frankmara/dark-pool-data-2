# Dark Pool Data 2.0 – Institutional Grade Workspace

## Overview
A fully automated workstation for institutional-grade dark pool and unusual options research posts on X (Twitter). This workspace includes real-time performance analytics, visual workflow canvas, A/B testing sandbox for posts, and one-click toggles to enable/disable each automation type.

## Project Structure
```
├── client/src/
│   ├── components/         # Reusable UI components
│   │   ├── app-sidebar.tsx       # Main navigation sidebar
│   │   ├── data-table.tsx        # Reusable data table with finance styling
│   │   ├── global-toggle-panel.tsx # Top automation control bar
│   │   ├── metric-card.tsx       # Stats/metrics display cards
│   │   ├── status-indicator.tsx  # Status badges and dots
│   │   └── ui/                   # Shadcn UI components
│   ├── pages/              # Main application pages
│   │   ├── live-automations.tsx  # Live Automations Dashboard
│   │   ├── post-analytics.tsx    # Post Analytics Suite
│   │   ├── post-constructor.tsx  # Post Constructor & A/B Lab
│   │   ├── data-feeds.tsx        # Data Feeds & API Connectors
│   │   ├── workflow-canvas.tsx   # Visual Workflow Canvas
│   │   ├── settings.tsx          # Settings page
│   │   └── help.tsx              # Help center
│   ├── App.tsx             # Main app with routing and state
│   └── index.css           # Dark finance theme styling
├── server/
│   ├── routes.ts           # API endpoints
│   └── storage.ts          # In-memory storage with seeded data
├── shared/
│   └── schema.ts           # Data models and Zod schemas
└── design_guidelines.md    # Design system documentation
```

## Key Features

### 1. Global Toggle Panel
- Master Automation Switch (on/off)
- Dark Pool Scanner toggle
- Unusual Options Sweeps toggle  
- Auto-Thread Posting toggle
- Analytics Tracking (always on)
- Live connection status indicator

### 2. Live Automations Dashboard
- Real-time metrics cards (Dark Pool Signals, Options Sweeps, Posts Today, Engagement Rate)
- Dark Pool Scanner data table with sentiment and flow indicators
- Unusual Options Sweeps monitoring
- Recent posts list with engagement stats
- Automation status overview

### 3. Post Analytics Suite
- Comprehensive performance metrics
- Engagement trend charts
- Topic performance analysis
- Best posting times heatmap
- Post performance data table

### 4. Post Constructor & A/B Lab
- Rich post composer with character count
- A/B testing toggle for variant comparison
- Quick templates for common post types
- Tag management with suggestions
- Live preview
- Predicted performance scores

### 5. Data Feeds & API Connectors
- Connector management cards
- Status indicators (connected, pending, disconnected)
- Available integrations list
- API key management
- Rate limit status display

### 6. Visual Workflow Canvas
- Draggable node-based interface
- Node library (Triggers, Filters, Actions)
- Animated connection lines
- Zoom controls and minimap
- Node configuration panel

## Design System
- **Theme**: Dark finance professional (deep navy blues, blacks)
- **Colors**: 
  - Positive: Emerald green (#10B981)
  - Negative: Crimson red (#EF4444)
  - Primary: Electric blue (#3B82F6)
- **Typography**: Inter/IBM Plex Sans with JetBrains Mono for data
- **Components**: Shadcn UI with custom finance styling

## API Endpoints
- `GET/PATCH /api/settings/automation` - Automation settings
- `GET/POST/PATCH/DELETE /api/posts` - Posts CRUD
- `GET/POST /api/dark-pool` - Dark pool data
- `GET/POST /api/unusual-options` - Options data
- `GET/POST/PATCH /api/connectors` - API connectors
- `GET/POST/PATCH/DELETE /api/workflow/nodes` - Workflow nodes
- `GET/POST/DELETE /api/workflow/connections` - Node connections
- `GET/POST /api/analytics` - Analytics data

## Running the Project
The application runs on port 5000 with `npm run dev`. The Express server handles both the API and serves the Vite frontend.

## User Preferences
- Dark theme only (professional trading workstation aesthetic)
- Information-dense layouts
- Monospace fonts for numerical data
- Real-time status indicators with pulsing animations

## Recent Changes (Dec 28, 2025)
- Integrated all frontend pages with backend APIs using react-query
- Global toggle panel now persists automation settings to backend
- Master toggle cascade logic: OFF disables all, ON re-enables Dark Pool and Options scanners
- Workflow nodes seeded with 7 demo nodes displayed on canvas
- Comprehensive data-testid attributes added across all components
- All pages verified working through automated end-to-end testing
