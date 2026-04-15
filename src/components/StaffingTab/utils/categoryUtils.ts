import type { Assignment } from "../types";
import { JOB_CATEGORIES, CATEGORY_LABELS, CATEGORY_BADGE_COLORS, CATEGORY_BAR_COLORS } from "../constants";

// Re-export the centralized categorizeJob from the shared module
import { categorizeJob, SPECIAL_JOB_CODES } from "../../../utils/jobCategories";
export { categorizeJob };

/**
 * Get label for a category
 */
export const getCategoryLabel = (category: string): string => {
  return CATEGORY_LABELS[category] || CATEGORY_LABELS[JOB_CATEGORIES.UNKNOWN];
};

/**
 * Get badge color classes for a category
 */
export const getCategoryBadgeColor = (category: string): string => {
  return CATEGORY_BADGE_COLORS[category] || CATEGORY_BADGE_COLORS[JOB_CATEGORIES.UNKNOWN];
};

/**
 * Get bar color for a category (used in Gantt charts).
 * Utilization-dependent for CHARGEABLE and GENERAL_OPPTY.
 */
export const getCategoryBarColor = (category: string, utilization: number = 0): string => {
  if (category === JOB_CATEGORIES.CHARGEABLE) {
    if (utilization >= 100) return "#2563eb";
    if (utilization >= 75) return "#3b82f6";
    if (utilization >= 50) return "#60a5fa";
    return "#93c5fd";
  }
  if (category === JOB_CATEGORIES.GENERAL_OPPTY) {
    if (utilization >= 100) return "#0891b2";
    if (utilization >= 75) return "#06b6d4";
    if (utilization >= 50) return "#22d3ee";
    return "#67e8f9";
  }
  return CATEGORY_BAR_COLORS[category] || "#9ca3af";
};

/**
 * Whether a category is considered "chargeable" (shows job code in tooltips).
 */
const CHARGEABLE_CATS: Set<string> = new Set([JOB_CATEGORIES.CHARGEABLE, JOB_CATEGORIES.GENERAL_OPPTY]);
export const isChargeableCategory = (category: string): boolean => CHARGEABLE_CATS.has(category);

// ─── SAP classification ──────────────────────────────────────────────────────
//
// Main categories            Sub-categories    SAP codes
// ─────────────────────────────────────────────────────────────────────────────
// ABSENCE
//   vacation                 0010, 0013, 0015
//   rtt                      F035, F036
//   loa                      F600, F605, F613, F631, F016
//   illness                  0200, F056, F210
//   otherAbsence             0024, F010, F014, F015, F030, F032, F033, F045
//   holiday                  (calendar — not from SAP)
//
// CHARGEABLE
//   chargeable               0800 (+sales order), 7-digit jobs
//   generalOppty             6-digit jobs
//   pending                  7777777777
//   overtime                 F810
//   travel                   F816, F817
//
// TRAINING
//   training                 0049
//
// RESERVATION
//   reservation              9999999996
//
// NON_CHARGEABLE
//   meeting                  0061
//   event                    0062, 0092, 0093
//   admin                    0077
//   corporate                0080
//   community                0081
//   businessDev              0083
//   other                    (currently unused — fallback → UNKNOWN)
// ─────────────────────────────────────────────────────────────────────────────

const SAP_VACATION_CODES = new Set(["0010", "0013", "0015"]);
const SAP_RTT_CODES = new Set(["F035", "F036"]);
const SAP_LOA_CODES = new Set(["F600", "F605", "F613", "F631", "F016"]);
const SAP_ILLNESS_CODES = new Set(["0200", "F056", "F210"]);
const SAP_OTHER_ABSENCE_CODES = new Set(["0024", "F010", "F014", "F015", "F030", "F032", "F033", "F045"]);

const SAP_TRAINING_CODES = new Set(["0049"]);
const SAP_OVERTIME_CODES = new Set(["F810"]);
const SAP_TRAVEL_CODES = new Set(["F816"]);
const SAP_TRAVEL_WE_CODES = new Set(["F817"]);
const SAP_CHARGEABLE_CODES = new Set(["0800"]);

const SAP_MEETING_CODES = new Set(["0061"]);
const SAP_EVENT_CODES = new Set(["0062", "0092", "0093"]);
const SAP_ADMIN_CODES = new Set(["0077"]);
const SAP_CORPORATE_CODES = new Set(["0080"]);
const SAP_COMMUNITY_CODES = new Set(["0081"]);
const SAP_BUSINESS_DEV_CODES = new Set(["0083"]);

// Ordered lookup: [Set, category] — first match wins
const SAP_CODE_MAP: [Set<string>, string | null][] = [
  // Absence
  [SAP_VACATION_CODES, JOB_CATEGORIES.VACATION],
  [SAP_RTT_CODES, JOB_CATEGORIES.RTT],
  [SAP_LOA_CODES, JOB_CATEGORIES.LOA],
  [SAP_ILLNESS_CODES, JOB_CATEGORIES.ILLNESS],
  [SAP_OTHER_ABSENCE_CODES, JOB_CATEGORIES.OTHER_ABSENCE],
  // Chargeable
  [SAP_OVERTIME_CODES, JOB_CATEGORIES.OVERTIME],
  [SAP_TRAVEL_CODES, JOB_CATEGORIES.TRAVEL],
  [SAP_TRAVEL_WE_CODES, JOB_CATEGORIES.TRAVEL_WE],
  [SAP_CHARGEABLE_CODES, null], // special: needs sales order sub-routing
  // Training
  [SAP_TRAINING_CODES, JOB_CATEGORIES.TRAINING],
  // Non-chargeable
  [SAP_MEETING_CODES, JOB_CATEGORIES.MEETING],
  [SAP_EVENT_CODES, JOB_CATEGORIES.EVENT],
  [SAP_ADMIN_CODES, JOB_CATEGORIES.ADMIN],
  [SAP_CORPORATE_CODES, JOB_CATEGORIES.CORPORATE],
  [SAP_COMMUNITY_CODES, JOB_CATEGORIES.COMMUNITY],
  [SAP_BUSINESS_DEV_CODES, JOB_CATEGORIES.BUSINESS_DEV],
];

/**
 * Categorize a SAP record using Att./Absence type + Rec. sales order.
 */
export const categorizeSapRecord = ({
  absenceType,
  salesOrder,
}: {
  absenceType: string | number;
  salesOrder?: string;
}): string | null => {
  const code = (absenceType || "").toString().trim();
  const codeUpper = code.toUpperCase();

  // Check unified SPECIAL_JOB_CODES first (updated from var_config jobCategory at hydration)
  const dynamicCat = SPECIAL_JOB_CODES[code] ?? SPECIAL_JOB_CODES[codeUpper];
  if (dynamicCat) {
    if (dynamicCat === "chargeable_route") {
      return salesOrder ? categorizeJob(salesOrder) : JOB_CATEGORIES.CHARGEABLE;
    }
    return dynamicCat;
  }

  // Walk through the hardcoded code map
  for (const [codeSet, cat] of SAP_CODE_MAP) {
    if (codeSet.has(code) || codeSet.has(codeUpper)) {
      if (cat !== null) return cat;
      // Special case: 0800 → chargeable with sales order sub-routing
      return salesOrder ? categorizeJob(salesOrder) : JOB_CATEGORIES.CHARGEABLE;
    }
  }

  // Empty code → skip this record (holidays handled by calendar)
  if (code === "") {
    return null;
  }

  // Any unrecognized code → Unknown
  return JOB_CATEGORIES.UNKNOWN;
};

/**
 * Group assignments by category
 */
export const groupAssignmentsByCategory = (assignments: Assignment[]): Record<string, Assignment[]> => {
  const grouped: Record<string, Assignment[]> = {
    // Chargeable
    [JOB_CATEGORIES.CHARGEABLE]: [],
    [JOB_CATEGORIES.GENERAL_OPPTY]: [],
    [JOB_CATEGORIES.PENDING]: [],
    [JOB_CATEGORIES.OVERTIME]: [],
    [JOB_CATEGORIES.TRAVEL]: [],
    [JOB_CATEGORIES.TRAVEL_WE]: [],
    // Training
    [JOB_CATEGORIES.TRAINING]: [],
    // Absence
    [JOB_CATEGORIES.VACATION]: [],
    [JOB_CATEGORIES.RTT]: [],
    [JOB_CATEGORIES.LOA]: [],
    [JOB_CATEGORIES.ILLNESS]: [],
    [JOB_CATEGORIES.OTHER_ABSENCE]: [],
    [JOB_CATEGORIES.HOLIDAY]: [],
    // Non-chargeable
    [JOB_CATEGORIES.MEETING]: [],
    [JOB_CATEGORIES.EVENT]: [],
    [JOB_CATEGORIES.ADMIN]: [],
    [JOB_CATEGORIES.CORPORATE]: [],
    [JOB_CATEGORIES.COMMUNITY]: [],
    [JOB_CATEGORIES.BUSINESS_DEV]: [],
    [JOB_CATEGORIES.RESERVATION]: [],
    [JOB_CATEGORIES.OTHER]: [],
  };

  assignments.forEach((assignment) => {
    const category = assignment.category;
    if (grouped[category]) {
      grouped[category].push(assignment);
    } else {
      grouped[JOB_CATEGORIES.UNKNOWN] = grouped[JOB_CATEGORIES.UNKNOWN] || [];
      grouped[JOB_CATEGORIES.UNKNOWN].push(assignment);
    }
  });

  return grouped;
};
