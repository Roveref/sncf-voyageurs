/**
 * OpportunityList Component
 * Main component that orchestrates all sub-components and hooks
 * Performance optimized with modular architecture
 */

import React, { useMemo, useEffect } from "react";
import {
  Paper,
  Table,
  TableBody,
  TableContainer,
  TableRow,
  TableCell,
  TablePagination,
  Typography,
} from "@mui/material";

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
  excludeStatuses = [],
}) => {
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
    searchText,
    filteredData,
    hasActiveFilters,
    handleWinPercentageChange,
    handleWinPercentageModeChange,
    handleStatusFilterChange,
    handleToggleManualOnly,
    handleToggleWithActionsOnly,
    handleToggleWithStaffingOnly,
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

  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        overflow: "hidden",
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
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
        hasActiveFilters={hasActiveFilters}
        onWinPercentageChange={handleWinPercentageChange}
        onWinPercentageModeChange={handleWinPercentageModeChange}
        onStatusFilterChange={handleStatusFilterChange}
        onToggleManualOnly={handleToggleManualOnly}
        onToggleWithActionsOnly={handleToggleWithActionsOnly}
        onToggleWithStaffingOnly={handleToggleWithStaffingOnly}
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
      />

      {/* Table Container */}
      <TableContainer
        sx={{
          width: "100%",
          overflow: "visible",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          "& .MuiTable-root": {
            tableLayout: "fixed",
            width: "100%",
            minWidth: 900,
          },
        }}
      >
        <Table stickyHeader={false} aria-label="opportunities table" size="small">
          {/* Table Header */}
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
          />

          {/* Table Body */}
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No opportunities match the current filters
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <OpportunityRow
                  key={row["Opportunity ID"]}
                  row={row}
                  index={index}
                  isSelected={isSelected(row)}
                  onRowClick={handleRowClick}
                  showNetRevenue={showNetRevenue}
                  showIO={showIO}
                  revenueSortMode={revenueSortMode}
                  setEditOpportunity={setEditOpportunity}
                  forceExpand={navigateToOpportunityId === row["Opportunity ID"]}
                  onManualOpportunityUpdated={onManualOpportunityUpdated}
                />
              ))
            )}
          </TableBody>

          {/* Table Footer with Totals */}
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
          />
        </Table>
      </TableContainer>

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
            borderTop: "1px solid",
            borderColor: "divider",
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
