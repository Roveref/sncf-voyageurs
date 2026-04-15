# BookingsTab Architecture

## File Structure

```
BookingsTab/
├── BookingsTab.js (3,169 lines - MAIN COMPONENT)
├── README.md (Documentation)
├── STRUCTURE.md (This file)
├── components/
│   ├── CustomTooltip.js (600 lines)
│   ├── MonthlyDetailsTable.js (500 lines)
│   ├── PeriodFilter.js (existing)
│   └── index.js
├── hooks/
│   ├── useBookingsCalculations.js (existing)
│   ├── useBookingsData.js
│   ├── useDateAnalysis.js
│   ├── useBookingsState.js
│   └── index.js
└── utils/
    └── bookingsCalculations.js (350 lines)
```

## Component Hierarchy

```
BookingsTab (Main)
├── PeriodFilter
├── Booking Insights Section
│   ├── Total Bookings Card
│   ├── Total Lost Card
│   └── Average Booking Size Card
├── Charts Section
│   ├── Year-over-Year Chart
│   │   └── CustomTooltip (extracted)
│   ├── Cumulative Chart
│   │   └── CustomTooltip (extracted)
│   └── Chart Controls
│       ├── Status 11 Toggle
│       ├── Curve Visibility Toggles
│       └── Top N Selector
├── MonthlyDetailsTable (extracted)
├── Analysis Tabs
│   ├── Wins Tab
│   │   └── OpportunityList
│   └── Losses Tab
│       └── OpportunityList
└── Top Accounts Section
    └── TopAccountsSection
```

## Data Flow

### 1. Props Flow (Top-Down)

```javascript
App/Dashboard
  └── BookingsTab
      ├── Props:
      │   ├── data: Opportunity[]
      │   ├── loading: boolean
      │   ├── onSelection: (opportunities) => void
      │   ├── selectedOpportunities: Opportunity[]
      │   ├── showNetRevenue: boolean
      │   ├── showIO: boolean
      │   ├── filters: FilterObject
      │   ├── originalData: Opportunity[]
      │   └── isCompleteUnitSelected: boolean
      │
      ├── useBookingsState() -> State Management
      │   ├── dateRange
      │   ├── filteredOpportunities
      │   ├── analysisTab
      │   ├── topNAccounts
      │   ├── includeStatus11
      │   ├── curveVisibility
      │   └── chartKey
      │
      ├── useBookingsData(data, loading, showNetRevenue, includeStatus11)
      │   ├── Filters data by Status 14 (booked) and Status 11
      │   ├── Calculates monthly/yearly aggregations
      │   ├── Formats year-over-year data
      │   ├── Computes cumulative totals (expensive!)
      │   └── Groups by service line
      │   Returns:
      │   ├── bookedData
      │   ├── status11Data
      │   ├── totalBookings
      │   ├── years
      │   ├── yoyBookings
      │   ├── cumulativeData
      │   └── bookingsByServiceLine
      │
      └── useDateAnalysis(data, dateRange, showNetRevenue)
          ├── Filters bookings by date range
          ├── Filters losses by date range
          ├── Calculates revenue metrics
          └── Computes allocation metrics
          Returns:
          ├── filteredBookings
          ├── filteredLosses
          ├── filteredBookingsTotalRevenue
          ├── filteredLossesTotalRevenue
          ├── filteredBookingsAllocatedRevenue
          ├── filteredLossesAllocatedRevenue
          ├── averageBookingSizeTotal
          ├── averageBookingSizeAllocated
          └── hasAllocation
```

### 2. State Management

```javascript
// OLD: Scattered state declarations
const [yoyBookings, setYoyBookings] = useState([]);
const [bookingsByServiceLine, setBookingsByServiceLine] = useState([]);
const [totalBookings, setTotalBookings] = useState(0);
const [filteredOpportunities, setFilteredOpportunities] = useState([]);
const [includeStatus11, setIncludeStatus11] = useState(false);
const [dateRange, setDateRange] = useState([...]);
const [newOpportunities, setNewOpportunities] = useState([]);
const [newWins, setNewWins] = useState([]);
const [newLosses, setNewLosses] = useState([]);
const [analysisTab, setAnalysisTab] = useState(0);
const [years, setYears] = useState([]);
const [cumulativeData, setCumulativeData] = useState([]);
const [topNAccounts, setTopNAccounts] = useState(10);
const [selectedYears, setSelectedYears] = useState([]);
const [curveVisibility, setCurveVisibility] = useState({ ... });
const [chartKey, setChartKey] = useState(0);

// NEW: Consolidated in useBookingsState hook
const {
  dateRange, setDateRange,
  filteredOpportunities, setFilteredOpportunities,
  analysisTab, setAnalysisTab,
  topNAccounts, setTopNAccounts,
  selectedYears, setSelectedYears,
  includeStatus11, setIncludeStatus11,
  curveVisibility, setCurveVisibility,
  chartKey, setChartKey,
} = useBookingsState();
```

### 3. Data Processing Pipeline

```
Raw Data (props.data)
  ↓
useBookingsData Hook
  ↓
├── Filter by Status
│   ├── Status 14 (Booked) → bookedData
│   └── Status 11 (Final Negotiation) → status11Data
  ↓
├── Monthly Aggregation
│   └── getMonthlyYearlyTotals() → monthlyTotals
  ↓
├── Year-over-Year Formatting
│   └── formatYearOverYearData() → yoyBookings
  ↓
├── Cumulative Calculations (EXPENSIVE!)
│   └── calculateCumulativeTotals() → cumulativeData
│       ├── Monthly I&O breakdown
│       ├── Cumulative totals per year
│       ├── Status 11 integration
│       ├── Filtered calculations
│       └── I&O target curves
  ↓
└── Service Line Grouping → bookingsByServiceLine

Date Range Filter (dateRange)
  ↓
useDateAnalysis Hook
  ↓
├── Filter Bookings by Date → filteredBookings
├── Filter Losses by Date → filteredLosses
├── Calculate Revenues → revenue metrics
└── Calculate Allocations → allocation metrics
```

## Component Details

### CustomTooltip.js

**Purpose**: Rich tooltip for chart hover interactions

**Props**:
- `active`: boolean - Is tooltip active
- `payload`: object[] - Chart data payload
- `label`: string - Month label
- `cumulativeData`: object[] - All cumulative data
- `showNetRevenue`: boolean - Show net vs gross
- `curveVisibility`: object - Which curves are visible
- `includeStatus11`: boolean - Include Status 11 data
- `showIOGlobal`: boolean - Show I&O globally
- `isCompleteUnitSelected`: boolean - Complete unit flag

**Features**:
- Displays monthly and cumulative data
- Shows 2024 vs 2025 comparisons
- Supports Status 11 parenthetical display
- Conditional sections based on visibility toggles
- Color-coded by year
- I&O target display

**Performance**:
- Memoized with React.memo()
- Only re-renders when props change
- ~600 lines extracted from main component

### MonthlyDetailsTable.js

**Purpose**: Comprehensive monthly data table

**Props**:
- `cumulativeData`: object[] - Monthly data by year
- `years`: number[] - Available years
- `hasFiltersApplied`: boolean - Are filters active
- `showNetRevenue`: boolean - Show net vs gross
- `showIO`: boolean - Show I&O rows
- `theme`: object - MUI theme object

**Features**:
- Collapsible table with toggle button
- Sticky header for scrolling
- Current month highlighting
- Multiple data rows:
  - Total Cumulative
  - Total Monthly
  - Filtered Cumulative (if filters applied)
  - Filtered Monthly (if filters applied)
  - I&O Cumulative (if showIO)
  - I&O Monthly (if showIO)
  - I&O Target (if no filters)
  - Status 11
- Year-over-year variations with color coding
- Currency formatting

**Performance**:
- Memoized with React.memo()
- Memoized helper functions
- ~500 lines extracted from main component

### PeriodFilter.js

**Purpose**: Date range selection component

**Props**:
- `dateRange`: Date[] - [startDate, endDate]
- `setDateRange`: function - Update date range
- `updateDateAnalysis`: function - Trigger analysis update

**Features**:
- Material-UI DatePickers
- Default: January 1st of current year to today
- Reset button
- French date formatting

## Hooks Details

### useBookingsData

**Purpose**: Process and calculate all booking data

**Parameters**:
- `data`: Opportunity[] - Raw opportunity data
- `loading`: boolean - Is data loading
- `showNetRevenue`: boolean - Net vs gross revenue
- `includeStatus11`: boolean - Include Status 11 data

**Returns**:
```javascript
{
  bookedData,           // Filtered Status 14 opportunities
  status11Data,         // Filtered Status 11 opportunities
  totalBookings,        // Sum of all bookings
  monthlyTotals,        // Monthly aggregations
  years,                // Unique years in data
  yoyBookings,          // Year-over-year formatted data
  cumulativeData,       // Cumulative calculations (expensive!)
  bookingsByServiceLine // Grouped by service line
}
```

**Performance**:
- All calculations wrapped in useMemo()
- Prevents unnecessary recomputation
- Dependencies tracked correctly

### useDateAnalysis

**Purpose**: Filter and analyze data by date range

**Parameters**:
- `data`: Opportunity[] - Raw opportunity data
- `dateRange`: Date[] - [startDate, endDate]
- `showNetRevenue`: boolean - Net vs gross revenue

**Returns**:
```javascript
{
  filteredBookings,              // Bookings in date range
  filteredLosses,                // Losses in date range
  filteredBookingsTotalRevenue,  // Total booking revenue
  filteredLossesTotalRevenue,    // Total loss revenue
  filteredBookingsAllocatedRevenue,  // Allocated booking revenue
  filteredLossesAllocatedRevenue,    // Allocated loss revenue
  averageBookingSizeTotal,       // Average booking size
  averageBookingSizeAllocated,   // Average allocated size
  hasAllocation                  // Are allocations present
}
```

**Performance**:
- All filtering wrapped in useMemo()
- Efficient date comparisons
- Avoids duplicate calculations

### useBookingsState

**Purpose**: Centralized state management

**Parameters**: None

**Returns**:
```javascript
{
  // Date range
  dateRange, setDateRange,

  // Filtered opportunities
  filteredOpportunities, setFilteredOpportunities,

  // Analysis tab
  analysisTab, setAnalysisTab,

  // Top N accounts
  topNAccounts, setTopNAccounts,

  // Selected years
  selectedYears, setSelectedYears,

  // Status 11
  includeStatus11, setIncludeStatus11,

  // Curve visibility
  curveVisibility, setCurveVisibility,

  // Chart key (for forcing re-renders)
  chartKey, setChartKey
}
```

**Benefits**:
- Single source of truth for state
- Clean API for components
- Easy to test and maintain
- Reduces prop drilling

### useBookingsCalculations (existing)

**Purpose**: Memoize expensive cumulative calculations

**Parameters**:
- `bookingsData`: object[] - Year-over-year data
- `status11Data`: object[] - Status 11 opportunities
- `includeStatus11`: boolean - Include Status 11
- `years`: number[] - Years to process
- `showNetRevenue`: boolean - Net vs gross

**Returns**:
```javascript
{
  cumulativeTotals  // Calculated cumulative data
}
```

**Performance**:
- Wraps 350+ line calculation function
- Only recalculates when inputs change
- Critical for performance

## Utility Functions

### bookingsCalculations.js

**calculateCumulativeTotals()**

**Purpose**: Calculate comprehensive cumulative booking data

**Parameters**:
- `bookingsData`: object[] - Monthly year-over-year data
- `status11Data`: object[] - Status 11 opportunities
- `includeStatus11`: boolean - Include Status 11 in calculations
- `yearsParam`: number[] - Years to process
- `showNetRevenue`: boolean - Use net vs gross revenue

**Returns**: object[] - Enhanced monthly data with:
- Cumulative totals per year
- I&O breakdowns (monthly and cumulative)
- Complement calculations (total - I&O)
- Status 11 integration
- Filtered values
- I&O target curves
- Combined values (bookings + Status 11)

**Performance Notes**:
- ~350 lines of complex calculations
- MUST be memoized via useMemo
- Runs on every data change if not memoized
- Most expensive operation in component

## Performance Optimization Strategy

### Problem: Original BookingsTab.js

```javascript
// ❌ Problems:
// 1. 3,169 lines in single file
// 2. CustomTooltip recreated on every render (600 lines)
// 3. MonthlyDetailsTable recreated on every render (500 lines)
// 4. Multiple large useEffect blocks with duplicate logic
// 5. No memoization on handlers (cause cascading re-renders)
// 6. Expensive calculations run on every render
// 7. State scattered throughout component
```

### Solution: Modularized Structure

```javascript
// ✅ Solutions:
// 1. Extract large components → React.memo()
// 2. Consolidate state → useBookingsState
// 3. Centralize data processing → useBookingsData
// 4. Memoize date filtering → useDateAnalysis
// 5. Wrap all handlers → useCallback
// 6. Memoize expensive calculations → useMemo
// 7. Create clean, maintainable structure
```

### Memoization Strategy

| Item | Strategy | Benefit |
|------|----------|---------|
| CustomTooltip | React.memo() | No re-render on parent updates |
| MonthlyDetailsTable | React.memo() | No re-render on parent updates |
| Data filtering | useMemo() | Only recalculate when data/filters change |
| Cumulative calculations | useMemo() | Only recalculate when inputs change |
| Revenue calculations | useMemo() | Avoid duplicate calculations |
| Event handlers | useCallback() | Prevent child re-renders |
| Chart data | useMemo() | Stable references for charts |

### Re-render Prevention

```
Before:
Parent re-renders → All children re-render → Tooltips/tables recreated
├── Expensive calculations run
├── New function references created
└── Cascade through entire tree

After:
Parent re-renders → Memoized children check props
├── Props unchanged? → Skip re-render
├── Memoized data? → Return cached value
└── useCallback handlers? → Stable references
```

## Testing Strategy

### Unit Tests
- [ ] Test each hook independently
- [ ] Test utility functions
- [ ] Test component rendering

### Integration Tests
- [ ] Test data flow through hooks
- [ ] Test state updates
- [ ] Test event handlers

### Performance Tests
- [ ] Measure render times
- [ ] Check React DevTools Profiler
- [ ] Verify memoization effectiveness
- [ ] Monitor memory usage

## Migration Path

### Phase 1: ✅ Completed
- Extract CustomTooltip
- Extract MonthlyDetailsTable
- Create useBookingsData
- Create useDateAnalysis
- Create useBookingsState
- Create index files

### Phase 2: In Progress
- Refactor main BookingsTab.js
- Replace state with hooks
- Add useCallback to handlers
- Remove inline component definitions
- Update imports

### Phase 3: Future
- Extract BookingInsights component
- Extract BookingCharts component
- Extract TopAccountsDisplay component
- Add comprehensive tests
- Performance profiling

## Maintenance Guidelines

### Adding New Features
1. Identify if feature needs new state → Add to useBookingsState
2. Identify if feature needs new calculations → Add to useBookingsData
3. Keep components small and focused
4. Always memoize expensive operations
5. Use useCallback for event handlers
6. Document in README.md

### Modifying Existing Features
1. Check if changes affect memoization dependencies
2. Update hook dependencies if needed
3. Test performance impact
4. Update documentation

### Code Review Checklist
- [ ] Is component memoized (React.memo)?
- [ ] Are calculations memoized (useMemo)?
- [ ] Are handlers memoized (useCallback)?
- [ ] Are dependency arrays correct?
- [ ] Is documentation updated?
- [ ] Are tests passing?

## Related Documentation
- [README.md](./README.md) - User guide and usage examples
- [../PipelineTab/STRUCTURE.md](../PipelineTab/STRUCTURE.md) - Similar pattern
- [../JobcodeTimelineTab/STRUCTURE.md](../JobcodeTimelineTab/STRUCTURE.md) - Similar pattern
