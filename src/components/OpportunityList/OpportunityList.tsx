/**
 * OpportunityList Component
 * Main component that orchestrates all sub-components and hooks
 * Performance optimized with modular architecture
 */

import React, { useCallback, useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import TablePagination from "@mui/material/TablePagination";

// Custom hooks
import {
  useOpportunityFilters,
  useOpportunitySorting,
  useOpportunityPagination,
  useOpportunitySelection,
  useOpportunityTotals,
} from "./hooks";

// Sub-components
import { OpportunityRow, OpportunityToolbar, OpportunityTableHeader, OpportunityTableFooter } from "./components";
import { NoResultsEmptyState } from "../common/EmptyStates";
import { useAppStore } from "../../stores/useAppStore";

/**
 * OpportunityList - Main component for displaying opportunities table
 * Features: filtering, sorting, pagination, row selection, row expansion
 *
 * Performance optimizations:
 * - Extracted custom hooks for state management
 * - Memoized components to prevent unnecessary re-renders
 * - Optimized selection with Set data structure
 * - Computed values cached with useMemo
 */
const OpportunityList = ({
  data,
  title,
  selectedOpportunities,
  onSelectionChange,
  defaultRowsPerPage = 15,
  resetFilterCallback = null,
  isFiltered = false,
  disablePagination = false,
  showNetRevenue = false,
  showIO = true,
  setEditOpportunity,
  onDeleteOpportunities,
  onOpportunityCreated,
  navigateToOpportunityId = null,
  onManualOpportunityUpdated = null,
  hideWinFilter = false,
  hideStatusFilter = false,
  excludeStatuses = [] as any[],
  showWinPercent = false,
}: any) => {
  // Live CRM update tracking
  const liveChangedOppIds = useAppStore((s) => s.liveChangedOppIds);

  // Ensure data is an array
  const opportunitiesData = Array.isArray(data) ? data : [];

  // Custom hooks for filters
  const {
    winPercentageFilter,
    winPercentageMode,
    statusFilter,
    showManualOnly,
    showWithActionsOnly,
    showWithStaffingOnly,
    showWithCurrentStaffingOnly,
    searchText,
    filteredData,
    hasActiveFilters,
    handleWinPercentageChange,
    handleWinPercentageModeChange,
    handleStatusFilterChange,
    handleToggleManualOnly,
    handleToggleWithActionsOnly,
    handleToggleWithStaffingOnly,
    handleToggleWithCurrentStaffingOnly,
    handleSearchTextChange,
    resetAllFilters,
  } = useOpportunityFilters(opportunitiesData);

  // Custom hook for sorting
  const {
    order,
    orderBy,
    revenueSortMode,
    revenueMenuAnchor,
    sortedData,
    handleSortRequest,
    handleRevenueMenuClick,
    handleRevenueMenuClose,
    handleRevenueSortModeChange,
  } = useOpportunitySorting(filteredData, showNetRevenue);

  // Custom hook for pagination
  const { page, rowsPerPage, paginatedData, handleChangePage, handleChangeRowsPerPage, setPage } =
    useOpportunityPagination(sortedData, defaultRowsPerPage, disablePagination);

  // Custom hook for selection
  const { handleRowClick, isSelected } = useOpportunitySelection(selectedOpportunities, onSelectionChange);

  // Custom hook for totals
  const { totals, currencyFormatter } = useOpportunityTotals(filteredData, showNetRevenue, revenueSortMode);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [winPercentageFilter, statusFilter, setPage]);

  // Handler to reset all filters including external ones
  const handleResetAllFilters = () => {
    resetAllFilters(resetFilterCallback);
  };

  // Collapse all signal — increment to trigger collapse in all rows
  const [collapseAllSignal, setCollapseAllSignal] = useState(0);
  const handleCollapseAll = useCallback(() => setCollapseAllSignal((s) => s + 1), []);

  return (
    <Paper
      variant="outlined"
      sx={{
        width: "100%",
        overflow: "hidden",
        borderRadius: "24px",
        p: 3,
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        "& *": { scrollbarWidth: "none", msOverflowStyle: "none" },
        "& *::-webkit-scrollbar": { display: "none" },
      }}
    >
      {/* Toolbar with filters and actions */}
      <OpportunityToolbar
        title={title}
        filteredDataLength={filteredData.length}
        showNetRevenue={showNetRevenue}
        isFiltered={isFiltered}
        winPercentageFilter={winPercentageFilter}
        winPercentageMode={winPercentageMode}
        statusFilter={statusFilter}
        showManualOnly={showManualOnly}
        showWithActionsOnly={showWithActionsOnly}
        showWithStaffingOnly={showWithStaffingOnly}
        showWithCurrentStaffingOnly={showWithCurrentStaffingOnly}
        hasActiveFilters={hasActiveFilters}
        onWinPercentageChange={handleWinPercentageChange}
        onWinPercentageModeChange={handleWinPercentageModeChange}
        onStatusFilterChange={handleStatusFilterChange}
        onToggleManualOnly={handleToggleManualOnly}
        onToggleWithActionsOnly={handleToggleWithActionsOnly}
        onToggleWithStaffingOnly={handleToggleWithStaffingOnly}
        onToggleWithCurrentStaffingOnly={handleToggleWithCurrentStaffingOnly}
        searchText={searchText}
        onSearchTextChange={handleSearchTextChange}
        onResetAllFilters={handleResetAllFilters}
        onDeleteSelected={onDeleteOpportunities}
        onOpportunityCreated={onOpportunityCreated}
        opportunitiesData={opportunitiesData}
        filteredData={filteredData}
        selectedOpportunities={selectedOpportunities}
        hideWinFilter={hideWinFilter}
        hideStatusFilter={hideStatusFilter}
        excludeStatuses={excludeStatuses}
        hideSearch
        onCollapseAll={handleCollapseAll}
      />

      {/* Scrollable content area */}
      <Box
        sx={{
          width: "100%",
          overflow: "visible",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          minWidth: 0,
        }}
      >
        <Box sx={{ minWidth: 900 }}>
          {/* Grid Header */}
          <OpportunityTableHeader
            order={order}
            orderBy={orderBy}
            showNetRevenue={showNetRevenue}
            showIO={showIO}
            revenueSortMode={revenueSortMode}
            revenueMenuAnchor={revenueMenuAnchor}
            onSortRequest={handleSortRequest}
            onRevenueMenuClick={handleRevenueMenuClick}
            onRevenueMenuClose={handleRevenueMenuClose}
            onRevenueSortModeChange={handleRevenueSortModeChange}
            isFiltered={isFiltered}
            showWinPercent={showWinPercent}
          />

          {/* Rows container */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.length === 0 ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <NoResultsEmptyState message="No opportunities match the current filters" />
              </Box>
            ) : (
              paginatedData.map((row: any, index: number) => (
                <OpportunityRow
                  key={row.opportunityId}
                  row={row}
                  index={index}
                  isSelected={isSelected(row)}
                  onRowClick={handleRowClick}
                  showNetRevenue={showNetRevenue}
                  showIO={showIO}
                  revenueSortMode={revenueSortMode}
                  setEditOpportunity={setEditOpportunity}
                  forceExpand={navigateToOpportunityId === row.opportunityId}
                  onManualOpportunityUpdated={onManualOpportunityUpdated}
                  showWinPercent={showWinPercent}
                  isLiveUpdated={liveChangedOppIds.has(String(row.opportunityId))}
                  collapseAllSignal={collapseAllSignal}
                />
              ))
            )}
            {/* Footer with Totals */}
            <OpportunityTableFooter
              filteredDataLength={filteredData.length}
              totalRevenue={totals.totalRevenue}
              totalIORevenue={totals.totalIORevenue}
              totalRevenueBase={totals.totalRevenueBase}
              filteredRevenue={totals.filteredRevenue}
              showIO={showIO}
              currencyFormatter={currencyFormatter}
              revenueSortMode={revenueSortMode}
              isFiltered={isFiltered}
              showWinPercent={showWinPercent}
            />
          </Box>
        </Box>
      </Box>

      {/* Pagination */}
      {!disablePagination && (
        <TablePagination
          rowsPerPageOptions={[15, 25, 50, 100, 250]}
          component="div"
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            mt: 1,
            "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
              fontSize: "0.875rem",
            },
          }}
        />
      )}
    </Paper>
  );
};

export default React.memo(OpportunityList);
