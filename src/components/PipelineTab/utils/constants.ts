/**
 * Constants and configuration for PipelineTab
 * Centralized constants for better maintainability
 */

import { STATUS_TEXT } from "../../../utils/constants";
import { chartPalette } from "../../../config/brandConfig";

export interface StatusOption {
  status: string;
  statusNumber: number;
}

export interface SizeRange {
  name: string;
  min: number;
  max: number;
}

export interface StatusCategories {
  early: number[];
  mid: number[];
  late: number[];
}

// Fallback status numbers used in the pipeline view
const PIPELINE_STATUS_NUMBERS = [1, 4, 6, 11];

// Dynamic status mapping — reads from STATUS_TEXT (updated by OptionSets at hydration)
export function getStatusMap(): Record<number, string> {
  const result: Record<number, string> = {};
  for (const num of PIPELINE_STATUS_NUMBERS) {
    result[num] = `${num} - ${STATUS_TEXT[num] || "Unknown"}`;
  }
  return result;
}

// Dynamic all-statuses list — reads from STATUS_TEXT (updated by OptionSets at hydration)
export function getAllStatuses(): StatusOption[] {
  return PIPELINE_STATUS_NUMBERS.map((num) => ({
    status: `${num} - ${STATUS_TEXT[num] || "Unknown"}`,
    statusNumber: num,
  }));
}

// GAIF brand colors for charts (from brandConfig)
export const COLORS: string[] = [...chartPalette];

// Status categories for stacked chart
export const STATUS_CATEGORIES: StatusCategories = {
  early: [1, 2, 3, 4], // Lead Identified → Go Approved
  mid: [6], // Proposal Submitted
  late: [11, 12, 13], // Client Tells Us We Have Won → Authorized Engagement Letter
};

// Size ranges for distribution analysis
export const SIZE_RANGES: Record<string, SizeRange> = {
  small: { name: "< €100K", min: 0, max: 100000 },
  medium: { name: "€100K-€500K", min: 100000, max: 500000 },
  large: { name: "> €500K", min: 500000, max: Infinity },
};
