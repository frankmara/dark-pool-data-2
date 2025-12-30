# Dark Pool Data 2.0 – Institutional Grade Workspace

## Overview
A fully automated workstation for institutional-grade dark pool and unusual options research posts on X (Twitter). This project aims to provide real-time performance analytics, a visual workflow canvas, an A/B testing sandbox for posts, and one-click toggles to enable/disable various automation types. The business vision is to deliver an institutional-grade tool for financial market research and social media dissemination.

## User Preferences
- Dark theme only (professional trading workstation aesthetic)
- Information-dense layouts
- Monospace fonts for numerical data
- Real-time status indicators with pulsing animations

## System Architecture
The application features a client-server architecture with a React frontend (`client/`) and an Express.js backend (`server/`). Data models and Zod schemas are shared (`shared/`).

**UI/UX Decisions:**
- **Theme**: Dark finance professional aesthetic using deep navy blues and blacks.
- **Color Palette**: Emerald green for positive, Crimson red for negative, Electric blue as primary.
- **Typography**: Inter/IBM Plex Sans for text, JetBrains Mono for data.
- **Components**: Shadcn UI with custom finance-specific styling.
- **Layouts**: Information-dense with real-time status indicators.

**Technical Implementations & Features:**
- **Global Toggle Panel**: Master switch for automation, controlling Dark Pool Scanner, Unusual Options Sweeps, and Auto-Thread Posting.
- **Live Automations Dashboard**: Displays real-time metrics, scanner data, options monitoring, and recent post engagement.
- **Post Analytics Suite**: Comprehensive performance metrics, engagement trends, topic analysis, and best posting times.
- **Post Constructor & A/B Lab**: Rich post composer with A/B testing capabilities, templates, tag management, and live preview.
- **Data Feeds & API Connectors**: Manages connections to external data sources with status indicators and API key management.
- **Visual Workflow Canvas**: Node-based interface for designing automation workflows with draggable nodes (Triggers, Filters, LLM Agents, Actions).
- **Institutional Research Ghostwriter (LLM Agent)**: Generates institutional-grade 4-part X threads from scanner events using specific tone rules and variant generation (Neutral, Bullish, Bearish).
- **Auto Chart & Flow Summary Engine (LLM Agent)**: Generates two images per thread: a TradingView-style chart and a branded flow summary card. Charts include candles, volume profile, EMAs, and key levels.
- **Operations Center**: Centralized dashboard for system health monitoring, filterable event logs, and component status.
- **Health Status Widget**: Provides at-a-glance system health for Scanner, LLM Agent, Chart Gen, and Poster.
- **Notification & Alerting System**: Configurable email, SMS, and Discord notifications with customizable alert rules.
- **Global Error Handler & Fallback Logic Nodes**: Workflow utilities for resilient automation with retry configurations and primary/secondary source routing.
- **Validation Gate System**: Comprehensive PostSpec validation with multiple validators for data integrity, consistency, and publishability, including 102 unit tests.

**System Design Choices:**
- Emphasis on real-time data and actionable insights.
- Modularity through reusable UI components and a node-based workflow system.
- Robust error handling and fallback mechanisms for reliability.
- Strict validation rules for data consistency and credibility in generated content.
- Single Source of Truth Architecture: Chart data is generated before thread text, with thread text extracting key values directly from chart data to ensure consistency.

## External Dependencies
- **Twitter API**: For posting automated threads.
- **Unusual Whales API**: For Dark Pool and Options Flow data.
- **Polygon API**: Data provider.
- **Alpha Vantage API**: Data provider.
- **TradingView**: Style inspiration for chart generation.
- **Shadcn UI**: Frontend component library.