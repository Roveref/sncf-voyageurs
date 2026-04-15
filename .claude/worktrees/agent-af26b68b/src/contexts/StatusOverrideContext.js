/**
 * StatusOverrideContext
 * Manages status overrides for opportunities
 * Stores overrides separately from original data to allow easy reversion
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "opportunity_status_overrides";

// Status definitions for reference
export const STATUS_OPTIONS = [
  { status: 1, label: "Lead Identified", shortLabel: "Lead" },
  { status: 4, label: "Go Approved", shortLabel: "Go" },
  { status: 6, label: "Proposal Submitted", shortLabel: "Proposal" },
  { status: 11, label: "Client Won", shortLabel: "Won" },
  { status: 13, label: "AEL", shortLabel: "AEL" },
  { status: 14, label: "Booked", shortLabel: "Booked" },
  { status: 15, label: "Lost", shortLabel: "Lost" },
];

const StatusOverrideContext = createContext(null);

export const StatusOverrideProvider = ({ children }) => {
  const [overrides, setOverrides] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load overrides from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setOverrides(parsed);
      }
    } catch (error) {
      console.error("Error loading status overrides:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save overrides to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      } catch (error) {
        console.error("Error saving status overrides:", error);
      }
    }
  }, [overrides, isLoaded]);

  // Add or update an override
  // bookingDate is used when changing to Booked status (14)
  const setStatusOverride = useCallback(
    (opportunityId, originalStatus, newStatus, comment = "", bookingDate = null) => {
      if (originalStatus === newStatus) {
        // If setting back to original, remove the override instead
        removeStatusOverride(opportunityId);
        return;
      }

      const overrideData = {
        originalStatus,
        newStatus,
        comment,
        modifiedAt: new Date().toISOString(),
      };

      // Add booking/lost date if changing to Booked (14) or Lost (15) status
      if (newStatus === 14 || newStatus === 15) {
        overrideData.bookingDate = bookingDate || new Date().toISOString().split("T")[0];
      }

      setOverrides((prev) => ({
        ...prev,
        [opportunityId]: overrideData,
      }));
    },
    []
  );

  // Remove an override (revert to original).
  // We keep a tombstone { _reverted: true } so that mergeExcelOverrides won't
  // re-add the override from an older Excel file on the next file load.
  const removeStatusOverride = useCallback((opportunityId) => {
    setOverrides((prev) => ({
      ...prev,
      [opportunityId]: { _reverted: true },
    }));
  }, []);

  // Remove all overrides (including tombstones)
  const clearAllOverrides = useCallback(() => {
    setOverrides({});
  }, []);

  // Merge overrides restored from Excel into React state.
  // Existing local overrides take priority (they may contain unsaved edits).
  // Excel overrides fill in any entries that don't exist locally.
  const mergeExcelOverrides = useCallback((excelOverridesObj) => {
    setOverrides((prev) => {
      const merged = { ...prev };
      let changed = false;
      Object.entries(excelOverridesObj).forEach(([oppId, data]) => {
        if (!merged[oppId]) {
          merged[oppId] = data;
          changed = true;
        }
      });
      return changed ? merged : prev;
    });
  }, []);

  // Get the effective status for an opportunity (override or original)
  const getEffectiveStatus = useCallback(
    (opportunityId, originalStatus) => {
      const override = overrides[opportunityId];
      return override && !override._reverted ? override.newStatus : originalStatus;
    },
    [overrides]
  );

  // Check if an opportunity has an active (non-reverted) override
  const hasOverride = useCallback(
    (opportunityId) => {
      const o = overrides[opportunityId];
      return !!o && !o._reverted;
    },
    [overrides]
  );

  // Get override details for an opportunity (null if reverted)
  const getOverride = useCallback(
    (opportunityId) => {
      const o = overrides[opportunityId];
      return o && !o._reverted ? o : null;
    },
    [overrides]
  );

  // Get all active overrides as an array with opportunity IDs (excludes tombstones)
  const getAllOverrides = useMemo(() => {
    return Object.entries(overrides)
      .filter(([, data]) => !data._reverted)
      .map(([id, data]) => ({
        opportunityId: id,
        ...data,
      }));
  }, [overrides]);

  // Count of active overrides (excludes tombstones)
  const overrideCount = useMemo(() => {
    return Object.values(overrides).filter((o) => !o._reverted).length;
  }, [overrides]);

  const value = {
    overrides,
    isLoaded,
    setStatusOverride,
    removeStatusOverride,
    clearAllOverrides,
    mergeExcelOverrides,
    getEffectiveStatus,
    hasOverride,
    getOverride,
    getAllOverrides,
    overrideCount,
    STATUS_OPTIONS,
  };

  return <StatusOverrideContext.Provider value={value}>{children}</StatusOverrideContext.Provider>;
};

export const useStatusOverride = () => {
  const context = useContext(StatusOverrideContext);
  if (!context) {
    throw new Error("useStatusOverride must be used within a StatusOverrideProvider");
  }
  return context;
};

export default StatusOverrideContext;
