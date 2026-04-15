# JobcodeTimelineTab Component

A modular, high-performance React component for visualizing project timelines grouped by jobcode. This component displays opportunities as streams on a visual timeline, making it easy to track project evolution and status changes over time.

## Features

- **Jobcode Grouping**: Automatically groups opportunities by jobcode with intelligent field detection
- **Visual Timeline**: Multi-stream timeline visualization with time markers
- **Interactive Events**: Expandable event cards with detailed opportunity information
- **Smart Filtering**: Fast Autocomplete search for jobcodes, accounts, and opportunities
- **Performance Optimized**: Systematic use of React.memo, useMemo, and useCallback
- **Responsive Design**: Adapts to different screen sizes and content volumes

## Modular Architecture

The component has been refactored into a clean, modular structure:

```
JobcodeTimelineTab/
├── JobcodeTimelineTab.js    # Main orchestration layer (220 lines)
├── index.js                  # Module exports
├── components/               # UI components
│   ├── JobcodeSelectionPanel.js
│   ├── JobcodeHeader.js
│   ├── TimelineMarkers.js
│   ├── TimelineHeader.js
│   ├── EventCard.js
│   ├── TimelineStreamColumn.js
│   ├── EmptyTimelineState.js
│   └── index.js
├── hooks/                    # Custom React hooks
│   ├── useJobcodeData.js
│   ├── useTimelineData.js
│   └── index.js
└── utils/                    # Utility functions
    ├── constants.js
    ├── formatters.js
    ├── timelineCalculations.js
    └── index.js
```

## Usage

### Basic Usage

```javascript
import JobcodeTimelineTab from './components/JobcodeTimelineTab';

function MyComponent() {
  return (
    <JobcodeTimelineTab
      data={opportunitiesData}
      loading={false}
      onSelection={handleSelection}
      selectedOpportunities={[]}
    />
  );
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | Array | Yes | Array of opportunity objects |
| `loading` | Boolean | Yes | Loading state indicator |
| `onSelection` | Function | No | Callback for selection changes (unused but kept for compatibility) |
| `selectedOpportunities` | Array | No | Currently selected opportunities (unused but kept for compatibility) |

### Data Structure

Expected opportunity object structure:

```javascript
{
  "Opportunity ID": "PRJ-2024-001",
  "Opportunity": "Project Name",
  "Account": "Client Name",
  "Status": 14,
  "Creation Date": "2024-01-15",
  "Booking/Lost Date": "2024-03-20",
  "Winning Date": "2024-03-20",
  "Gross Revenue": 150000,
  "Service Line 1": "Advisory",
  "Service Offering 1": "Strategy",
  "EP": "John Doe",
  "EM": "Jane Smith",
  "Project Type": "Fixed Price"
}
```

## Component Architecture

### Main Component (JobcodeTimelineTab.js)

The main component acts as an orchestration layer, composing hooks and sub-components:

- Initializes custom hooks for data management
- Manages component lifecycle
- Composes UI components into final layout

### Custom Hooks

#### useJobcodeData
Manages jobcode grouping and selection state.

```javascript
const {
  jobcodes,          // Array of jobcode objects
  selectedJobcode,   // Currently selected jobcode
  handleJobcodeSelection, // Selection handler
} = useJobcodeData(data, loading);
```

#### useTimelineData
Processes timeline events and manages expanded cards.

```javascript
const {
  timelineData,       // Array of all timeline events
  opportunityStreams, // Array of opportunity streams
  timelineYears,      // Array of years in timeline
  expandedCards,      // Object of expanded card states
  toggleExpanded,     // Toggle function
  resetExpandedCards, // Reset function
} = useTimelineData(selectedJobcode);
```

### UI Components

All components are wrapped with `React.memo` for optimal performance:

- **JobcodeSelectionPanel**: Search and selection interface
- **JobcodeHeader**: Displays selected jobcode information
- **TimelineMarkers**: Vertical timeline with date markers
- **TimelineHeader**: Column headers for opportunity streams
- **TimelineStreamColumn**: Individual opportunity timeline stream
- **EventCard**: Detailed event information card
- **EmptyTimelineState**: Empty state display

### Utilities

#### Formatters
- `formatDate()`: French locale date formatting
- `formatCurrency()`: EUR currency formatting
- `getStatusChipColor()`: Status-based color mapping
- `getTimelineDotColor()`: Event type color mapping

#### Timeline Calculations
- `calculateTimelinePosition()`: Position percentage calculation
- `generateTimelineMarkers()`: Date marker generation

#### Constants
- `STATUS_ICONS`: Status icon mappings
- `TIMELINE_HEIGHT`: Fixed timeline height
- `TIMELINE_MARKER_WIDTH`: Marker column width
- `getTimelineIcon()`: Icon retrieval function

## Performance Optimizations

### Component Level
- All sub-components use `React.memo` to prevent unnecessary re-renders
- Props are carefully selected to minimize re-render triggers

### Hook Level
- `useMemo` for all data transformations and expensive calculations
- `useCallback` for all event handlers
- Optimized dependency arrays to prevent excessive recalculations

### Utility Level
- Pure functions with no side effects
- Efficient algorithms (single-pass where possible)
- Early returns for optimization

## Performance Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Main file lines | 1,444 | 220 | 85% reduction |
| Cyclomatic complexity | High | Low | Significant |
| Re-render frequency | High | Minimal | Optimized |
| Bundle size | Large | Modular | Tree-shakeable |

## Development

### File Organization
- Keep components under 250 lines
- Extract reusable logic to hooks
- Move pure functions to utilities
- Maintain single responsibility principle

### Adding New Features
1. Determine if it's a component, hook, or utility
2. Place in appropriate directory
3. Export from directory's index.js
4. Import in main component
5. Update documentation

### Testing
```bash
# Run component tests
npm test JobcodeTimelineTab

# Run specific hook tests
npm test useJobcodeData
npm test useTimelineData
```

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## Dependencies

- React 17+
- Material-UI (MUI) 5+
- Date utilities compatible with French locale

## Migration from v1.0

The component API remains unchanged. Simply update your imports:

```javascript
// Before
import JobcodeTimelineTab from './components/JobcodeTimelineTab';

// After (same!)
import JobcodeTimelineTab from './components/JobcodeTimelineTab';
```

All internal refactoring is transparent to consumers.

## License

Internal company use only.
