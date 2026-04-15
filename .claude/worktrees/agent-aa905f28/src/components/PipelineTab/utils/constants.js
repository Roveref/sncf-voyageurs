/**
 * Constants and configuration for PipelineTab
 * Centralized constants for better maintainability
 */

// Status mapping for better readability
export const statusMap = {
  1: "1 - New Lead",
  4: "4 - Go Approved",
  6: "6 - Proposal Delivered",
  11: "11 - Final Negotiation",
};

// Define all possible statuses to ensure complete representation
export const ALL_STATUSES = [
  { status: "1 - Lead Identified", statusNumber: 1 },
  { status: "4 - Go Approved", statusNumber: 4 },
  { status: "6 - Proposal Submitted", statusNumber: 6 },
  { status: "11 - Client Tells Us We Have Won", statusNumber: 11 },
];

// BearingPoint brand colors for charts
export const COLORS = [
  "#FF3D47", // Bearing Red (R50)
  "#806659", // Warm Grey (G60)
  "#CC2931", // Dark Red (R60)
  "#98847A", // Medium Grey (G50)
  "#99171D", // Deep Red (R70)
  "#B2A59F", // Light Grey (G40)
  "#FF787A", // Light Red (R40)
  "#330000", // Deep Red (R80)
  "#CCC1BC", // Pale Grey (G30)
];

// Status categories for stacked chart
export const STATUS_CATEGORIES = {
  early: [1, 2, 3, 4], // Lead Identified → Go Approved
  mid: [6], // Proposal Submitted
  late: [11, 12, 13], // Client Tells Us We Have Won → Authorized Engagement Letter
};

// Size ranges for distribution analysis
export const SIZE_RANGES = {
  small: { name: "< €100K", min: 0, max: 100000 },
  medium: { name: "€100K-€500K", min: 100000, max: 500000 },
  large: { name: "> €500K", min: 500000, max: Infinity },
};
