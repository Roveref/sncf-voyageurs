/**
 * Shared constants used across the dashboard application
 * Centralizes status mappings, colors, and other reusable constants
 */

// Status colors mapping for MUI Chip/Badge components
export const STATUS_COLORS = {
  1: "primary", // New Lead
  4: "primary", // Go Approved
  6: "primary", // Proposal Delivered
  11: "primary", // Final Negotiation
  14: "success", // Booked
  15: "error", // Lost
};

// Status text labels (based on Status Long column)
export const STATUS_TEXT = {
  1: "Lead Identified",
  4: "Go Approved",
  6: "Proposal Submitted",
  11: "Client Tells Us We Have Won",
  13: "Authorized Engagement Letter",
  14: "Booked",
  15: "Lost",
};

// Special segment codes that receive 100% revenue attribution
export const SPECIAL_SEGMENT_CODES = ["AUTO", "CLR", "IEM", "LSC"];

// Service line that receives allocated revenue
export const OPERATIONS_SERVICE_LINE = "Operations";

// Values to exclude when checking for technology partners
export const EXCLUDED_PARTNER_VALUES = [
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

// Possible jobcode field names to detect in data
export const JOBCODE_FIELD_NAMES = ["Jobcode", "JobCode", "Job Code", "ProjectCode", "Project Code", "Project_Code"];

// BearingPoint consulting grades for staffing needs
export const STAFFING_PROFILES = [
  { value: "intern", label: "Intern" },
  { value: "analyst", label: "Analyst" },
  { value: "consultant", label: "Consultant" },
  { value: "senior_consultant", label: "Senior Consultant" },
  { value: "manager", label: "Manager" },
  { value: "senior_manager", label: "Senior Manager" },
  { value: "associate_director", label: "Associate Director" },
  { value: "partner", label: "Partner" },
];
