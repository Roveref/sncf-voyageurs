/**
 * Segment Code Groups and Colors
 * Extracted from App.js for better organization
 */

import { segmentColors, brand } from "../../config/brandConfig";

export const SEGMENT_CODE_GROUPS = {
  AMD: {
    name: "AMD",
    color: brand.primary, // Bearing Red (R50)
    include: ["LSC", "IEM", "AUTO"],
  },
};

// Individual Segment Code colors - using BearingPoint palette (from brandConfig)
export const SEGMENT_CODE_COLORS: Record<string, string> = { ...segmentColors };

// Get color for a segment code (with fallback)
export const getSegmentColor = (code: string): string => {
  return SEGMENT_CODE_COLORS[code] || brand.secondaryLightest; // Default to Pale Grey (G30)
};
