/**
 * Shared constants used across the dashboard application
 * Centralizes status mappings, colors, and other reusable constants
 */

// Status colors mapping for MUI Chip/Badge components
export const STATUS_COLORS: Record<number, string> = {
  1: "primary", // New Lead
  4: "primary", // Go Approved
  6: "primary", // Proposal Delivered
  11: "primary", // Final Negotiation
  14: "success", // Booked
  15: "error", // Lost
};

// Status text labels (based on Status Long column)
export const STATUS_TEXT: Record<number, string> = {
  1: "Lead Identified",
  4: "Go Approved",
  6: "Proposal Submitted",
  11: "Client Tells Us We Have Won",
  13: "Authorized Engagement Letter",
  14: "Booked",
  15: "Lost",
};

// Special segment codes: sub-segments whose parent differs (e.g. AUTO→AMD)
// Populated at hydration from var_config.segment (codes where parent != code)
export let SPECIAL_SEGMENT_CODES: string[] = [];

/** Replace the SPECIAL_SEGMENT_CODES array */
export function updateSpecialSegmentCodes(codes: string[]): void {
  SPECIAL_SEGMENT_CODES = codes;
}

// Service line that receives allocated revenue
export const OPERATIONS_SERVICE_LINE = "Operations";

// Values to exclude when checking for technology partners
export const EXCLUDED_PARTNER_VALUES: readonly string[] = [
  "-",
  "",
  "N/A",
  "n/a",
  "NA",
  "na",
  "None",
  "none",
  "NULL",
  "null",
  "no technology partner",
  "No Technology Partner",
  "NO TECHNOLOGY PARTNER",
  "no partner",
  "No Partner",
  "NO PARTNER",
];

// Default I&O target amount in euros
export const IO_TARGET = 1000000;

// Possible jobcode field names to detect in data. The canonical name from the
// SQLite schema is "jobCode" (camelCase) — keep it first. The others are legacy
// aliases kept for resilience against older payload shapes.
export const JOBCODE_FIELD_NAMES: readonly string[] = [
  "jobCode",
  "Jobcode",
  "JobCode",
  "Job Code",
  "ProjectCode",
  "Project Code",
  "Project_Code",
];

// Revenue allocation grade buckets
export const GRADE_BUCKETS = [
  { value: "M/SM" as const, label: "Manager / Senior Manager" },
  { value: "Director" as const, label: "Director" },
  { value: "Partner" as const, label: "Partner" },
] as const;
