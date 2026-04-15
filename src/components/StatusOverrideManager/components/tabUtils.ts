/**
 * Shared utility functions for StatusOverrideManager tab components.
 */

import { getStatusLabel as _getStatusLabel } from "../../../utils/statusOptions";

/**
 * Group an array of items into a hierarchy based on the chosen groupBy mode.
 * Modes: 'none', 'serviceLine', 'segment', 'both'
 * Returns: { [groupKey]: { items: [...], subGroups?: { [subKey]: items[] } } }
 * For 'none': single flat group with key '__all__'
 * For 'serviceLine' or 'segment': { [value]: { items: [...] } }
 * For 'both': { [primary]: { subGroups: { [secondary]: items[] } } }
 */
export const groupItemsBy = (items: any, getOpp: any, mode: any): Record<string, any> => {
  if (mode === "none" || !mode) {
    return { __all__: { items } };
  }

  const getGroupKey = (opp: any, field: any) => {
    const val = opp?.[field];
    return val && val !== "-" ? val : "Other";
  };

  if (mode === "serviceLine") {
    const groups: Record<string, any> = {};
    items.forEach((item: any) => {
      const opp = getOpp(item);
      const key = getGroupKey(opp, "serviceLine1");
      if (!groups[key]) groups[key] = { items: [] };
      groups[key].items.push(item);
    });
    return groups;
  }

  if (mode === "segment") {
    const groups: Record<string, any> = {};
    items.forEach((item: any) => {
      const opp = getOpp(item);
      const key = getGroupKey(opp, "subSegmentCode");
      if (!groups[key]) groups[key] = { items: [] };
      groups[key].items.push(item);
    });
    return groups;
  }

  if (mode === "slThenSegment" || mode === "segmentThenSl") {
    const primaryField = mode === "slThenSegment" ? "serviceLine1" : "subSegmentCode";
    const secondaryField = mode === "slThenSegment" ? "subSegmentCode" : "serviceLine1";
    const groups: Record<string, any> = {};
    items.forEach((item: any) => {
      const opp = getOpp(item);
      const primary = getGroupKey(opp, primaryField);
      const secondary = getGroupKey(opp, secondaryField);
      if (!groups[primary]) groups[primary] = { subGroups: {} };
      if (!groups[primary].subGroups[secondary]) groups[primary].subGroups[secondary] = [];
      groups[primary].subGroups[secondary].push(item);
    });
    return groups;
  }

  return { __all__: { items } };
};

export const getStatusLabel = (status: number): string => {
  return _getStatusLabel(status);
};

/** Compare two objects and return an array of { field, from, to } for changed fields */
export const getFieldDiffs = (
  saved: Record<string, any>,
  current: Record<string, any>
): { field: string; from: any; to: any }[] => {
  const diffs: { field: string; from: any; to: any }[] = [];
  const allKeys = new Set([...Object.keys(saved || {}), ...Object.keys(current || {})]);
  allKeys.forEach((key) => {
    if (key === "id" || key === "empId") return; // skip identity keys
    const s = JSON.stringify(saved?.[key] ?? null);
    const c = JSON.stringify(current?.[key] ?? null);
    if (s !== c) {
      diffs.push({ field: key, from: saved?.[key], to: current?.[key] });
    }
  });
  return diffs;
};

export const formatDiffValue = (val: any): string => {
  if (val === null || val === undefined) return "(none)";
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

export const formatDate = (isoString: string) => {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateShort = (isoString: string) => {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export { formatCurrency } from "../../../utils/formatters";
