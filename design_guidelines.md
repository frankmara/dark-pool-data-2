# Dark Pool Data 2.0 Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing from institutional trading platforms (Bloomberg Terminal, TradingView, Interactive Brokers) combined with modern dark-mode dashboards (Linear, Vercel Analytics). Emphasis on information density, real-time data visibility, and professional credibility.

## Core Design Principles
1. **Information Hierarchy**: Critical controls and metrics always visible
2. **Scan-ability**: Dense data presented in digestible, organized blocks
3. **Status Clarity**: Immediate visual feedback for automation states
4. **Professional Restraint**: No decorative elements, every pixel serves function

## Color System (User-Specified)
- **Base**: Black (#000000) and deep navy blues (#0A1929, #132F4C)
- **Positive Flow**: Emerald greens (#10B981, #059669)
- **Negative/Distribution**: Crimson reds (#EF4444, #DC2626)
- **Neutral Data**: Cool grays (#6B7280, #9CA3AF)
- **Accent**: Electric blue (#3B82F6) for interactive elements

## Typography System
- **Primary Font**: Inter or IBM Plex Sans (clean, technical)
- **Monospace**: JetBrains Mono for numeric data, tickers, timestamps
- **Hierarchy**:
  - Section Headers: 24px, semibold
  - Data Labels: 14px, medium, uppercase tracking
  - Primary Metrics: 32-48px, bold, monospace
  - Body Content: 15px, regular
  - Micro Data: 12px, monospace

## Layout System
**Spacing Units**: Tailwind 2, 4, 6, 8, 12 for tight professional spacing

**Grid Structure**:
- Global toggle panel: Fixed top bar, h-16, flex items across
- Main workspace: 5 tabs with side navigation (w-64 sidebar)
- Content area: Grid-based with 12-column flexibility
- Dashboard cards: Minimum 2-column on desktop, stack mobile

## Component Library

### Global Toggle Panel (Fixed Top Bar)
- Height: h-16, dark background
- Master switch prominent (left), individual toggles inline
- Live status indicators (pulsing green dots for active)
- Notification badge for alerts/errors

### Navigation Sidebar
- Width: w-64, collapsible to w-16 icon-only
- Tab items: Icon + label, active state with left border accent
- Bottom section: User profile, settings gear

### Dashboard Cards
- Border: 1px subtle gray, rounded-lg
- Padding: p-6 for content density
- Header: Title + action menu (3-dot)
- Content area: Flexible grid/table layouts
- Shadow: Subtle elevation on hover

### Data Tables
- Dense rows: py-2 spacing
- Alternating row background for scan-ability
- Sortable headers with arrow indicators
- Sticky headers on scroll
- Monospace for numerical columns

### Real-Time Charts
- Clean axes, no excessive gridlines
- Candlestick/line charts for price action
- Volume bars beneath main chart
- Tooltips on hover with detailed data
- Time range selectors (1D, 5D, 1M, 3M, 1Y, ALL)

### Toggle Switches
- Large, clear on/off states
- Green when active, gray when disabled
- Label positioned left, aligned
- Grouped in panels with dividers

### Metrics Cards
- Large primary number (48px, monospace)
- Small label above (12px, uppercase)
- Percentage change with colored arrow
- Sparkline chart as background element

### Post Constructor Interface
- Split view: Editor left (w-1/2), Preview right (w-1/2)
- Character count prominent
- Tag suggestions dropdown
- Image upload drag-drop zone
- A/B variant comparison side-by-side

### Visual Workflow Canvas
- Node-based interface (like n8n/Zapier)
- Draggable automation blocks
- Connection lines between nodes
- Zoom controls (bottom right)
- Minimap overview (bottom left)

## Interaction Patterns
- Instant feedback: State changes reflect immediately
- Loading states: Skeleton screens for data fetch
- Confirmation modals: For destructive actions only
- Keyboard shortcuts: Display hints on hover
- Auto-save indicators: "Last saved X seconds ago"

## Responsive Behavior
- Desktop-first (this is a workstation tool)
- Tablet: Collapse sidebar, stack 2-column to 1-column
- Mobile: Single column, bottom tab navigation
- Minimum width: 1280px recommended for optimal use

## Performance Indicators
- WebSocket connection status (top right)
- API rate limit display
- Data freshness timestamps (relative: "2s ago")
- Real-time update animations (brief flash on change)

## Images
No hero images - this is a data-dense professional tool. Icons only for:
- Tab navigation (custom trading icons)
- Status indicators (checkmarks, warnings, errors)
- Empty states (minimal illustrations for "No data yet")