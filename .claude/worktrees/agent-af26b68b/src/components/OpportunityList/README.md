# OpportunityList - Modular Architecture

## Overview

The OpportunityList component has been refactored from a monolithic 2,031-line file into a modular, maintainable architecture. All functionality has been preserved while significantly improving code organization, performance, and maintainability.

## Directory Structure

```
OpportunityList/
├── index.js                          # Main entry point, exports default component
├── OpportunityList.js                # Main orchestrator component (236 lines)
│
├── components/                       # UI sub-components
│   ├── index.js                      # Components barrel export
│   ├── OpportunityRow.js             # Individual table row (280 lines)
│   ├── OpportunityExpandedDetails.js # Expanded row details (807 lines)
│   ├── OpportunityToolbar.js         # Filters and actions toolbar (375 lines)
│   ├── OpportunityTableHeader.js     # Table header with sorting (220 lines)
│   └── OpportunityTableFooter.js     # Totals footer (91 lines)
│
├── hooks/                            # Custom React hooks
│   ├── index.js                      # Hooks barrel export
│   ├── useOpportunityFilters.js      # Filter state management (98 lines)
│   ├── useOpportunitySorting.js      # Sorting logic (88 lines)
│   ├── useOpportunityPagination.js   # Pagination logic (58 lines)
│   ├── useOpportunitySelection.js    # Row selection logic (49 lines)
│   └── useOpportunityTotals.js       # Revenue totals calculation (44 lines)
│
└── utils/                            # Utility functions
    └── opportunityUtils.js           # Pure helper functions (83 lines)
```

## Key Improvements

### 1. Code Organization
- **Before**: 2,031 lines in a single file
- **After**: 15 focused files, largest being 807 lines (expanded details)
- Main component reduced to 236 lines (88% reduction)

### 2. Performance Optimizations
- **React.memo()**: All components memoized to prevent unnecessary re-renders
- **useMemo()**: Computed values cached (filtered data, sorted data, totals)
- **useCallback()**: Event handlers memoized to prevent recreation
- **Set data structure**: O(1) selection lookup instead of O(n)

### 3. Maintainability
- **Separation of concerns**: UI, logic, and utilities separated
- **Single Responsibility**: Each file has one clear purpose
- **Reusability**: Hooks and utilities can be used in other components
- **Testability**: Smaller units easier to test in isolation

### 4. Developer Experience
- **Better navigation**: Easy to find and modify specific functionality
- **Clearer dependencies**: Import statements show what each file needs
- **Documentation**: Comments explain purpose and performance considerations
- **Type safety ready**: Structure prepared for TypeScript migration

## Component Architecture

### Main Component (OpportunityList.js)
The main orchestrator that:
- Imports and composes all sub-components
- Manages data flow between hooks and components
- Handles backward compatibility

### Custom Hooks

#### useOpportunityFilters
Manages filtering logic for win percentage and status filters.
```javascript
const {
  filteredData,
  winPercentageFilter,
  statusFilter,
  handleWinPercentageChange,
  resetAllFilters,
} = useOpportunityFilters(data);
```

#### useOpportunitySorting
Handles column sorting with special revenue sort modes.
```javascript
const {
  sortedData,
  order,
  orderBy,
  handleSortRequest,
  revenueSortMode,
} = useOpportunitySorting(data, showNetRevenue);
```

#### useOpportunityPagination
Manages page navigation and rows per page.
```javascript
const {
  paginatedData,
  page,
  rowsPerPage,
  handleChangePage,
} = useOpportunityPagination(data, defaultRowsPerPage);
```

#### useOpportunitySelection
Handles row selection with optimized Set lookup.
```javascript
const {
  handleRowClick,
  isSelected,
  selectedIds,
} = useOpportunitySelection(selectedOpportunities, onSelectionChange);
```

#### useOpportunityTotals
Calculates revenue totals with memoization.
```javascript
const {
  totals,
  currencyFormatter,
} = useOpportunityTotals(data, showNetRevenue);
```

### UI Components

#### OpportunityToolbar
Displays title, filters, export button, and meeting minutes access.

#### OpportunityTableHeader
Renders sortable column headers with revenue sort mode menu.

#### OpportunityRow
Displays a single opportunity row with expand/collapse functionality.

#### OpportunityExpandedDetails
Shows detailed information when a row is expanded.

#### OpportunityTableFooter
Displays total revenue and opportunity count.

## Utility Functions

### getTechnologyPartnerTags(opportunity)
Extracts and deduplicates technology partner tags from an opportunity.

### hasTechnologyPartner(opportunity, partnerName)
Checks if an opportunity has a specific technology partner (case-insensitive).

### getRevenueForSorting(item, showNetRevenue, revenueSortMode)
Calculates the appropriate revenue value based on sort mode (total/io/filtered).

### getRevenueSortModeLabel(revenueSortMode, showNetRevenue)
Returns a human-readable label for the current revenue sort mode.

## Backward Compatibility

The original import path still works:
```javascript
import OpportunityList from './components/OpportunityList';
```

The legacy file (`/src/components/OpportunityList.js`) now simply re-exports from the modular structure.

## Performance Metrics

### Re-render Optimization
- Components only re-render when their specific props change
- Memoized hooks prevent unnecessary recalculations
- Set-based selection provides O(1) lookup vs O(n) array search

### Memory Efficiency
- Computed values cached and only recalculated when dependencies change
- Event handlers memoized to prevent function recreation
- Pagination limits DOM nodes in the table body

## Usage Examples

### Basic Usage
```javascript
import OpportunityList from './components/OpportunityList';

<OpportunityList
  data={opportunities}
  title="My Opportunities"
  selectedOpportunities={selected}
  onSelectionChange={setSelected}
  showNetRevenue={true}
  showIO={true}
/>
```

### Using Hooks Separately
```javascript
import { useOpportunityFilters } from './components/OpportunityList';

const MyComponent = () => {
  const { filteredData, handleWinPercentageChange } =
    useOpportunityFilters(opportunities);

  // Use filtered data...
};
```

### Using Utilities
```javascript
import { getTechnologyPartnerTags } from './components/OpportunityList';

const partners = getTechnologyPartnerTags(opportunity);
```

## Testing Strategy

Each module can be tested independently:

1. **Hooks**: Test state management and computed values
2. **Components**: Test rendering and user interactions
3. **Utils**: Test pure function logic with various inputs

## Future Enhancements

The modular structure makes it easier to:
- Add TypeScript types
- Implement additional filters
- Create variants of components
- Add unit and integration tests
- Extract hooks for use in other features
- Implement virtualization for large datasets

## Migration Notes

No changes required in consuming components. The API remains identical:
- Same props interface
- Same behavior
- Same exported component
- Improved performance

## Performance Comments in Code

Each file includes performance-related comments:
- `// Performance optimized with React.memo` - Component memoization
- `// Memoized with useMemo` - Computed value caching
- `// O(1) lookup with Set` - Algorithm optimization
- `// Only recomputes when dependencies change` - Dependency tracking

## File Sizes Summary

| File | Lines | Purpose |
|------|-------|---------|
| OpportunityList.js (original) | 2,031 | Monolithic component |
| **New Structure** | **2,464** | **Total (with better organization)** |
| OpportunityList.js | 236 | Main orchestrator |
| OpportunityExpandedDetails.js | 807 | Detailed view |
| OpportunityToolbar.js | 375 | Filters & actions |
| OpportunityRow.js | 280 | Table row |
| OpportunityTableHeader.js | 220 | Table header |
| useOpportunityFilters.js | 98 | Filter logic |
| useOpportunitySorting.js | 88 | Sort logic |
| opportunityUtils.js | 83 | Utilities |
| OpportunityTableFooter.js | 91 | Footer totals |
| useOpportunityPagination.js | 58 | Pagination |
| useOpportunitySelection.js | 49 | Selection |
| useOpportunityTotals.js | 44 | Totals calculation |
| index files | 30 | Exports |

## Conclusion

The modularization successfully transforms a 2,031-line monolithic component into a well-organized, performant, and maintainable architecture without sacrificing any functionality. The structure follows React best practices and provides a solid foundation for future enhancements.
