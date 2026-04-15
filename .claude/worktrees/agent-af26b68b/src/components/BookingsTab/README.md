# BookingsTab Modularization

## Overview

BookingsTab.js has been partially modularized to improve performance and maintainability. The original file was **3,169 lines** - one of the largest monolithic components in the application.

## What Was Completed

### ✅ Components Extracted (1,100+ lines)

1. **CustomTooltip.js** (~600 lines, lines 584-1190)
   - Memoized with React.memo()
   - Displays detailed monthly and cumulative booking data
   - Supports Status 11, I&O, and filtered views
   - Color-coded by year (2024/2025)

2. **MonthlyDetailsTable.js** (~500 lines, lines 1379-1946)
   - Memoized with React.memo()
   - Collapsible table with comprehensive monthly breakdowns
   - Year-over-year comparisons with variation percentages
   - Filtered revenues, I&O data, and Status 11 tracking

3. **PeriodFilter.js** (ALREADY EXISTS)
   - Date range selection component
   - Reused from previous modularization

### ✅ Hooks Created

1. **useBookingsData.js**
   - Handles all data processing and calculations
   - Filters booked and Status 11 opportunities
   - Calculates monthly/yearly aggregations
   - Generates cumulative data
   - Groups by service line
   - **All calculations memoized with useMemo**

2. **useDateAnalysis.js**
   - Filters opportunities by date range
   - Calculates revenue metrics (bookings, losses)
   - Tracks allocation status
   - Computes average booking sizes
   - **All filtering memoized with useMemo**

3. **useBookingsState.js**
   - Consolidates ALL state declarations
   - Manages UI state (tabs, toggles, visibility)
   - Handles date range selection
   - Provides clean API for state management

4. **useBookingsCalculations.js** (ALREADY EXISTS)
   - Wraps the expensive calculateCumulativeTotals function
   - Prevents unnecessary recalculations

### ✅ Utilities

1. **bookingsCalculations.js** (ALREADY EXISTS)
   - Pure function for cumulative calculations (~350 lines)
   - Can be memoized via useMemo
   - Handles Status 11 integration and I&O target curves

### ✅ Index Files

- `components/index.js` - Exports all components
- `hooks/index.js` - Exports all hooks

### ✅ Backups Created

- `BookingsTab.js.backup` - Full backup before any changes
- `BookingsTab.js.original` - Additional backup

## File Structure

```
BookingsTab/
├── BookingsTab.js (MAIN - still 3,169 lines, needs refactoring)
├── components/
│   ├── CustomTooltip.js (✅ 600 lines extracted)
│   ├── MonthlyDetailsTable.js (✅ 500 lines extracted)
│   ├── PeriodFilter.js (✅ already exists)
│   └── index.js (✅ created)
├── hooks/
│   ├── useBookingsCalculations.js (✅ already exists)
│   ├── useBookingsData.js (✅ created)
│   ├── useDateAnalysis.js (✅ created)
│   ├── useBookingsState.js (✅ created)
│   └── index.js (✅ created)
└── utils/
    └── bookingsCalculations.js (✅ already exists)
```

## Next Steps (TODO)

### 1. Refactor Main BookingsTab.js

The main file still needs to be refactored to use the modular structure:

#### a) Update Imports
```javascript
// Add modular imports
import { CustomTooltip, MonthlyDetailsTable } from './BookingsTab/components';
import {
  useBookingsData,
  useDateAnalysis,
  useBookingsState,
} from './BookingsTab/hooks';
```

#### b) Replace State Declarations
```javascript
// OLD: 15+ individual useState calls
const [yoyBookings, setYoyBookings] = useState([]);
const [dateRange, setDateRange] = useState(...);
// ... 13 more useState calls

// NEW: Single hook call
const {
  dateRange,
  setDateRange,
  filteredOpportunities,
  setFilteredOpportunities,
  analysisTab,
  setAnalysisTab,
  // ... all other state
} = useBookingsState();
```

#### c) Replace Data Processing
```javascript
// OLD: Large useEffect blocks (70+ lines each)
useEffect(() => {
  // 70+ lines of data processing
}, [data, loading, showNetRevenue]);

// NEW: Single hook call
const {
  bookedData,
  status11Data,
  totalBookings,
  years,
  yoyBookings,
  cumulativeData,
  bookingsByServiceLine,
} = useBookingsData(data, loading, showNetRevenue, includeStatus11);
```

#### d) Replace Date Analysis
```javascript
// OLD: Duplicate filtering logic
const filteredBookings = useMemo(() => {
  // filtering logic
}, [data, dateRange]);

const filteredLosses = useMemo(() => {
  // filtering logic
}, [data, dateRange]);

// NEW: Single hook call
const {
  filteredBookings,
  filteredLosses,
  filteredBookingsTotalRevenue,
  filteredLossesTotalRevenue,
  averageBookingSizeTotal,
  hasAllocation,
} = useDateAnalysis(data, dateRange, showNetRevenue);
```

#### e) Wrap Handlers with useCallback
```javascript
// OLD: Handlers without useCallback
const handleStatus11Toggle = () => {
  setIncludeStatus11(prev => !prev);
  setChartKey(prev => prev + 1);
};

const handleCurveToggle = (curveType) => {
  setCurveVisibility(prev => ({
    ...prev,
    [curveType]: !prev[curveType]
  }));
  setChartKey(prev => prev + 1);
};

// NEW: Handlers with useCallback
const handleStatus11Toggle = useCallback(() => {
  setIncludeStatus11(prev => !prev);
  setChartKey(prev => prev + 1);
}, [setIncludeStatus11, setChartKey]);

const handleCurveToggle = useCallback((curveType) => {
  setCurveVisibility(prev => ({
    ...prev,
    [curveType]: !prev[curveType]
  }));
  setChartKey(prev => prev + 1);
}, [setCurveVisibility, setChartKey]);

const handleAnalysisTabChange = useCallback((event, newValue) => {
  setAnalysisTab(newValue);
  if (newValue === 0) {
    setFilteredOpportunities(filteredBookings);
  } else {
    setFilteredOpportunities(filteredLosses);
  }
}, [setAnalysisTab, setFilteredOpportunities, filteredBookings, filteredLosses]);

const handleChartClick = useCallback((chartData) => {
  // chart click logic
}, [/* dependencies */]);

const updateDateAnalysis = useCallback(() => {
  // date analysis logic
}, [data, dateRange, setFilteredOpportunities, analysisTab]);
```

#### f) Replace Inline Components
```javascript
// OLD: CustomTooltip defined inline (lines 584-1190)
const CustomTooltip = ({ active, payload, label, ... }) => {
  // 600 lines of code
};

// NEW: Import and use
import { CustomTooltip } from './BookingsTab/components';

// In render:
<Tooltip content={<CustomTooltip ... />} />
```

```javascript
// OLD: MonthlyDetailsTable defined inline (lines 1379-1946)
const MonthlyDetailsTable = ({ cumulativeData, ... }) => {
  // 500 lines of code
};

// NEW: Import and use
import { MonthlyDetailsTable } from './BookingsTab/components';

// In render:
<MonthlyDetailsTable
  cumulativeData={cumulativeData}
  years={years}
  hasFiltersApplied={hasFiltersApplied()}
  showNetRevenue={showNetRevenue}
  showIO={showIO}
  theme={theme}
/>
```

#### g) Wrap Main Component with React.memo
```javascript
// At the bottom of the file
const BookingsTab = ({ data, loading, ... }) => {
  // component logic
};

export default React.memo(BookingsTab);
```

### 2. Extract Additional Components (Optional)

Consider extracting these sections into separate components:

- **BookingInsights.js** (~300 lines)
  - The insights cards section (Total Bookings, Total Lost, Average Size)
  - Lines ~1960-2350

- **BookingCharts.js** (~400 lines)
  - Year-over-year chart
  - Cumulative chart
  - Chart configuration and rendering

- **TopAccountsDisplay.js** (~200 lines)
  - Top accounts section
  - Integrated with TopAccountsSection component

### 3. Add More Performance Optimizations

- Memoize `hasFiltersApplied` function with useCallback
- Add React.memo to any remaining inline components
- Ensure all objects/arrays passed as props are memoized

## Performance Impact

### Before Modularization
- **File Size**: 3,169 lines (monolithic)
- **CustomTooltip**: Redefined on every render
- **MonthlyDetailsTable**: Redefined on every render
- **State**: 15+ individual useState calls scattered throughout
- **Data Processing**: Multiple large useEffect blocks with duplicate logic
- **Handlers**: None wrapped with useCallback (cause unnecessary re-renders)

### After Modularization
- **File Size**: Will be ~1,500-2,000 lines (after full refactoring)
- **Components**: Extracted, memoized, reusable
- **State**: Consolidated in single hook with clean API
- **Data Processing**: Centralized in hooks, all memoized
- **Handlers**: Wrapped with useCallback to prevent re-renders

### Expected Performance Gains
- ✅ **React DevTools**: Fewer re-renders in component tree
- ✅ **Rendering**: Memoized components don't re-render unnecessarily
- ✅ **Calculations**: Expensive operations only run when dependencies change
- ✅ **Memory**: Reduced memory pressure from recreated functions/objects
- ✅ **Bundle Size**: Better code splitting potential

## Usage Example

Once refactoring is complete, the main BookingsTab.js will look like this:

```javascript
import React, { useCallback } from 'react';
import { useTheme } from '@mui/material';
import { CustomTooltip, MonthlyDetailsTable } from './BookingsTab/components';
import { useBookingsData, useDateAnalysis, useBookingsState } from './BookingsTab/hooks';
import { calculateRevenueWithSegmentLogic } from '../utils/dataUtils';

const BookingsTab = ({ data, loading, showNetRevenue, showIO, ... }) => {
  const theme = useTheme();

  // State management
  const {
    dateRange,
    setDateRange,
    filteredOpportunities,
    setFilteredOpportunities,
    analysisTab,
    setAnalysisTab,
    topNAccounts,
    setTopNAccounts,
    includeStatus11,
    setIncludeStatus11,
    curveVisibility,
    setCurveVisibility,
    chartKey,
    setChartKey,
  } = useBookingsState();

  // Data processing
  const {
    years,
    yoyBookings,
    cumulativeData,
    bookingsByServiceLine,
  } = useBookingsData(data, loading, showNetRevenue, includeStatus11);

  // Date analysis
  const {
    filteredBookings,
    filteredLosses,
    filteredBookingsTotalRevenue,
    filteredLossesTotalRevenue,
    averageBookingSizeTotal,
    hasAllocation,
  } = useDateAnalysis(data, dateRange, showNetRevenue);

  // Handlers
  const handleStatus11Toggle = useCallback(() => {
    setIncludeStatus11(prev => !prev);
    setChartKey(prev => prev + 1);
  }, [setIncludeStatus11, setChartKey]);

  const handleCurveToggle = useCallback((curveType) => {
    setCurveVisibility(prev => ({ ...prev, [curveType]: !prev[curveType] }));
    setChartKey(prev => prev + 1);
  }, [setCurveVisibility, setChartKey]);

  // ... other handlers

  return (
    <Box>
      {/* Period Filter */}
      <PeriodFilter ... />

      {/* Booking Insights */}
      {/* Charts with CustomTooltip */}
      <Tooltip content={<CustomTooltip ... />} />

      {/* Monthly Details Table */}
      <MonthlyDetailsTable
        cumulativeData={cumulativeData}
        years={years}
        hasFiltersApplied={hasFiltersApplied()}
        showNetRevenue={showNetRevenue}
        showIO={showIO}
        theme={theme}
      />

      {/* Opportunity Lists */}
      <OpportunityList ... />
    </Box>
  );
};

export default React.memo(BookingsTab);
```

## Maintenance Notes

- All extracted components use React.memo() for performance
- All hooks use useMemo() for expensive calculations
- Follow the same pattern for any future extractions
- Keep components small and focused on single responsibility
- Document any new hooks or components in this README

## Testing Checklist

After refactoring is complete, verify:

- [ ] All charts render correctly
- [ ] CustomTooltip shows correct data on hover
- [ ] MonthlyDetailsTable displays and collapses properly
- [ ] Date range filtering works
- [ ] Status 11 toggle functions
- [ ] Curve visibility toggles work
- [ ] Top N accounts selection works
- [ ] Opportunity lists display correctly
- [ ] No console errors or warnings
- [ ] Performance improvements visible in React DevTools
- [ ] No regression in functionality

## Similar Patterns

This modularization follows the same successful pattern used for:
- **PipelineTab**: 1,576 → 181 lines (88.5% reduction)
- **JobcodeTimelineTab**: 1,444 → 220 lines (84.8% reduction)
- **OpportunityList**: Modularized with hooks and memoization

Target for BookingsTab:
- **Current**: 3,169 lines
- **Target**: ~300-400 lines (87-90% reduction)
- **Extracted**: 1,100+ lines so far
- **Remaining**: Continue extraction of charts and insights sections
