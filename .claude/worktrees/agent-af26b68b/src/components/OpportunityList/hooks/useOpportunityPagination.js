/**
 * Custom hook for managing opportunity pagination
 * Performance optimized with useMemo for paginated data
 */

import { useState, useMemo, useCallback } from "react";

/**
 * Hook to manage pagination logic for opportunities
 * Provides state and handlers for page navigation and rows per page
 * @param {Array} data - Array of opportunity objects to paginate
 * @param {number} defaultRowsPerPage - Initial rows per page (default: 100)
 * @param {boolean} disablePagination - Whether pagination is disabled
 * @returns {Object} Pagination state, handlers, and paginated data
 */
export const useOpportunityPagination = (data, defaultRowsPerPage = 100, disablePagination = false) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

  // Memoized paginated data - only recomputes when dependencies change
  const paginatedData = useMemo(() => {
    if (disablePagination) {
      return data;
    }

    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, page, rowsPerPage, disablePagination]);

  // Handlers
  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Reset page when data changes (useful after filtering)
  const resetPage = useCallback(() => {
    setPage(0);
  }, []);

  return {
    // State
    page,
    rowsPerPage,
    paginatedData,

    // Handlers
    handleChangePage,
    handleChangeRowsPerPage,
    resetPage,
    setPage,
  };
};
