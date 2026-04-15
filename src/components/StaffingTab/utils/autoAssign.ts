/**
 * autoAssign.ts — Staffing Optimizer Engine
 *
 * Builds a scoring matrix (employees × needs) and generates ranked proposals
 * using different strategies (Optimal TU, Best Fit, Max Coverage, M+ Priority, Balanced).
 */

import { GRADE_ORDER, compareGrades, getGradeColor, GRADE_ABBR } from "../constants";
import { getGradeTarget } from "../constants/theme";
// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal shape of a staffing need required by the slot-expansion function.
 * All fields are optional so partial stubs (e.g. in tests) are accepted;
 * the function provides sensible defaults for every missing value.
 */
export interface NeedInput {
  id?: string;
  opportunityId?: string;
  grade?: string;
  quantity?: number;
  startDate?: string;
  endDate?: string;
  probability?: number;
  skills?: string[];
  [key: string]: unknown;
}

/**
 * Minimal employee shape required by the scoring engine.
 * Satisfied by both `Employee` (full data pipeline) and `SerializedEmployee`
 * (web worker payload) without requiring every optional field.
 */
export interface ScoringEmployee {
  empId: string;
  name: string;
  grade: string;
  serviceLine?: string;
  assignments?: Array<{ startDate: string; endDate: string }>;
  availableCapacityHours?: number;
  netAvailableHours?: number;
  /** Pre-computed net hours (from useDailyGrid) */
  _displayNetH?: number;
  trueUtilizationRate?: number;
  skills?: Array<{ skillShort?: string; skillFull?: string }>;
  firstName?: string;
  lastName?: string;
}

export interface Slot {
  needId: string;
  slotIndex: number;
  grade: string;
  gradeAbbr: string;
  opportunityId: string;
  oppLabel: string;
  jobNo: string;
  startDate: string;
  endDate: string;
  probability: number;
  skills: string[];
  techPartners: string[];
  serviceLines: string[];
}

/** Tolerance levels for scoring filters (aligned with backend candidates.ts) */
export interface ScoringTolerances {
  /** 0=strict (≥100% capacity), 1=moyen (≥50%), 2=flexible (no filter) */
  availabilityTolerance?: number;
  /** 0=strict (100% match), 1=moyen (≥50%), 2=flexible (no filter) */
  skillsTolerance?: number;
  /** 0=strict (exact dates), 1=±1 month, 2=±3 months */
  periodTolerance?: number;
  /** 0=exact, 1=±1, 2=±2 */
  maxGradeDistance?: number;
}

export interface CellScore {
  slotIdx: number;
  empIdx: number;
  empId: string;
  total: number; // 0-100
  gradeFit: number; // 0-30
  dateOverlap: number; // 0-25
  availability: number; // 0-25
  skillsMatch: number; // 0-15
  probBonus: number; // 0-5
  techBonus: number; // 0-3 (bonus for matching tech partners)
  serviceLineBonus: number; // 0-2 (bonus for matching service line)
  overlapDays: number;
  overlapRatio: number; // 0-1
  freeHoursInOverlap: number;
}

export interface ProposalAssignment {
  slotIdx: number;
  empIdx: number;
  empId: string;
  empName: string;
  empGrade: string;
  needId: string;
  opportunityId: string;
  oppLabel: string;
  jobNo: string;
  startDate: string;
  endDate: string;
  score: number;
}

export interface UnfilledSlot {
  slotIdx: number;
  needId: string;
  grade: string;
  oppLabel: string;
  reason: string;
}

export interface ProposalStats {
  totalSlots: number;
  filledSlots: number;
  coverageRate: number;
  avgScore: number;
  projectedTUDelta: number;
  projectedTU: number;
}

export type StrategyId = "optimalTu" | "bestFit" | "maxCoverage" | "mplusPriority" | "balanced";

export interface Proposal {
  id: string;
  name: string;
  strategy: StrategyId;
  description: string;
  assignments: ProposalAssignment[];
  unfilledSlots: UnfilledSlot[];
  stats: ProposalStats;
  /** Map from slotIdx to empIdx for quick lookup */
  selectionMap: Map<number, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const gradeIdx = (g: string): number => {
  const idx = GRADE_ORDER.indexOf(g);
  return idx >= 0 ? idx : GRADE_ORDER.length;
};

/** Grade distance: 0 = exact, 1 = adjacent, etc. */
const gradeDistance = (empGrade: string, slotGrade: string): number =>
  Math.abs(gradeIdx(empGrade) - gradeIdx(slotGrade));

/** Count working days in overlap between two date ranges, excluding weekends + holidays */
export const computeOverlapWorkDays = (
  s1: string | Date,
  e1: string | Date,
  s2: string | Date,
  e2: string | Date,
  holidays: Set<string> | null
): number => {
  const a1 = new Date(s1),
    b1 = new Date(e1);
  const a2 = new Date(s2),
    b2 = new Date(e2);
  if (isNaN(a1.getTime()) || isNaN(b1.getTime()) || isNaN(a2.getTime()) || isNaN(b2.getTime())) return 0;
  if (b1 <= a2 || b2 <= a1) return 0;

  const overlapStart = a1 > a2 ? a1 : a2;
  const overlapEnd = b1 < b2 ? b1 : b2;

  let days = 0;
  const cur = new Date(overlapStart);
  while (cur < overlapEnd) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      const dtStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      if (!holidays || !holidays.has(dtStr)) days++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

/** Count total working days for a date range */
const countWorkDays = (start: string | Date, end: string | Date, holidays: Set<string> | null): number => {
  const s = new Date(start),
    e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  let days = 0;
  const cur = new Date(s);
  while (cur < e) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      const dtStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      if (!holidays || !holidays.has(dtStr)) days++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

/** Check if two date ranges overlap */
const datesOverlap = (s1: string, e1: string, s2: string, e2: string): boolean => {
  const a1 = new Date(s1),
    b1 = new Date(e1);
  const a2 = new Date(s2),
    b2 = new Date(e2);
  return a1 < b2 && a2 < b1;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Expand raw staffing needs into individual slots (1 per quantity unit).
 */
/** Filter out placeholder tech partner values (aligned with backend candidates.ts) */
const EXCLUDED_PARTNER_VALUES = new Set([
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
]);

export const expandNeedsToSlots = (needs: NeedInput[], pipelineJobcodes: Map<string, any> | null): Slot[] => {
  const slots: Slot[] = [];
  for (const need of needs) {
    const qty = Math.max(1, (need.quantity != null ? Math.floor(need.quantity) : 0) || 1);
    const grade = need.grade || "Unknown";
    const gradeAbbr = GRADE_ABBR[grade] || grade;
    const opportunityId = need.opportunityId || "";
    // Lookup by opportunityId field (pipelineJobcodes entries now have opportunityId)
    const jobEntry = pipelineJobcodes
      ? Array.from(pipelineJobcodes.entries()).find(
          ([, v]) => v?.opportunityId === opportunityId || v?.opportunityId === opportunityId
        )
      : null;
    const oppData = jobEntry?.[1];
    const oppLabel = oppData ? oppData.opportunityName || oppData.opportunity || jobEntry[0] : opportunityId;
    const jobNo = jobEntry ? jobEntry[0] : opportunityId;

    // Extract tech partners and service lines from opportunity data (aligned with backend)
    const techPartners = oppData
      ? [oppData.techPartner1, oppData.techPartner2, oppData.techPartner3].filter(
          (tp: string) => tp && !EXCLUDED_PARTNER_VALUES.has(tp)
        )
      : [];
    const serviceLines = oppData
      ? [oppData.serviceLine, oppData.serviceLine2, oppData.serviceLine3].filter(Boolean)
      : [];

    for (let i = 0; i < qty; i++) {
      slots.push({
        needId: need.id || `${opportunityId}_${need.grade}_${i}`,
        slotIndex: i,
        grade,
        gradeAbbr,
        opportunityId,
        oppLabel,
        jobNo,
        startDate: need.startDate || "",
        endDate: need.endDate || "",
        probability: need.probability ?? 1,
        skills: need.skills || [],
        techPartners,
        serviceLines,
      });
    }
  }
  // Sort by grade seniority then by opportunity
  slots.sort((a, b) => compareGrades(a.grade, b.grade) || a.oppLabel.localeCompare(b.oppLabel));
  return slots;
};

/**
 * Build the scoring matrix: matrix[slotIdx][empIdx] = CellScore.
 * Tolerances filter out candidates that don't meet minimum thresholds (aligned with backend candidates.ts).
 */
export const buildScoringMatrix = (
  employees: ScoringEmployee[],
  slots: Slot[],
  holidays: Set<string> | null,
  tolerances?: ScoringTolerances
): CellScore[][] => {
  const matrix: CellScore[][] = [];
  const maxGradeDist = tolerances?.maxGradeDistance ?? 99;

  for (let si = 0; si < slots.length; si++) {
    const slot = slots[si];
    const needDays = countWorkDays(slot.startDate, slot.endDate, holidays);
    const row: CellScore[] = [];

    for (let ei = 0; ei < employees.length; ei++) {
      const emp = employees[ei];

      // 1. Grade fit (0-30) — aligned with backend candidates.ts
      const dist = gradeDistance(emp.grade, slot.grade);
      // Apply grade tolerance filter
      if (dist > maxGradeDist) {
        row.push({
          slotIdx: si,
          empIdx: ei,
          empId: emp.empId,
          total: 0,
          gradeFit: 0,
          dateOverlap: 0,
          availability: 0,
          skillsMatch: 0,
          probBonus: 0,
          techBonus: 0,
          serviceLineBonus: 0,
          overlapDays: 0,
          overlapRatio: 0,
          freeHoursInOverlap: 0,
        });
        continue;
      }
      const gradeFit = dist === 0 ? 30 : dist === 1 ? 20 : dist === 2 ? 10 : 0;

      // 2. Date overlap (0-25)
      const overlapDays = computeOverlapWorkDays(
        slot.startDate,
        slot.endDate,
        emp.assignments?.[0]?.startDate || slot.startDate,
        emp.assignments?.[emp.assignments.length - 1]?.endDate || slot.endDate,
        holidays
      );
      const overlapRatio = needDays > 0 ? Math.min(1, overlapDays / needDays) : 0;
      const empOverlapDays = computeOverlapWorkDays(
        slot.startDate,
        slot.endDate,
        slot.startDate,
        slot.endDate,
        holidays
      );
      const dateOverlap = needDays > 0 ? Math.min(1, empOverlapDays / needDays) * 25 : 25;

      // 3. Availability (0-25) — based on free capacity
      const totalAvailH = emp.availableCapacityHours || 0;
      const neededHours = needDays * 8;
      const empTotalNetH = emp._displayNetH || emp.netAvailableHours || 1;
      const freeHoursInOverlap = empTotalNetH > 0 ? Math.max(0, totalAvailH * (neededHours / empTotalNetH)) : 0;
      const availabilityScore = neededHours > 0 ? Math.min(1, freeHoursInOverlap / neededHours) * 25 : 0;

      // Apply availability tolerance filter (aligned with backend)
      const availTol = tolerances?.availabilityTolerance ?? 2;
      if (availTol < 2) {
        const availPct = empTotalNetH > 0 ? (totalAvailH / empTotalNetH) * 100 : 0;
        const requiredPct = availTol === 0 ? 100 : 50;
        if (availPct < requiredPct) {
          row.push({
            slotIdx: si,
            empIdx: ei,
            empId: emp.empId,
            total: 0,
            gradeFit: 0,
            dateOverlap: 0,
            availability: 0,
            skillsMatch: 0,
            probBonus: 0,
            techBonus: 0,
            serviceLineBonus: 0,
            overlapDays: 0,
            overlapRatio: 0,
            freeHoursInOverlap: 0,
          });
          continue;
        }
      }

      // 4. Skills (0-15)
      let skillsMatch = 15;
      let skillsMatchPct = 100;
      const empSkillNames = (emp.skills || []).map((s) => (s.skillShort || s.skillFull || "").toLowerCase());
      if (slot.skills.length > 0) {
        const matched = slot.skills.filter((s: string) => empSkillNames.includes(s.toLowerCase())).length;
        skillsMatch = (matched / slot.skills.length) * 15;
        skillsMatchPct = (matched / slot.skills.length) * 100;
      }

      // Apply skills tolerance filter (aligned with backend)
      const skillsTol = tolerances?.skillsTolerance ?? 2;
      if (skillsTol < 2 && slot.skills.length > 0) {
        const requiredPct = skillsTol === 0 ? 100 : 50;
        if (skillsMatchPct < requiredPct) {
          row.push({
            slotIdx: si,
            empIdx: ei,
            empId: emp.empId,
            total: 0,
            gradeFit: 0,
            dateOverlap: 0,
            availability: 0,
            skillsMatch: 0,
            probBonus: 0,
            techBonus: 0,
            serviceLineBonus: 0,
            overlapDays: 0,
            overlapRatio: 0,
            freeHoursInOverlap: 0,
          });
          continue;
        }
      }

      // 5. Probability bonus (0-5)
      const probBonus = slot.probability * 5;

      // 6. Tech partner bonus (0-3) — aligned with backend candidates.ts
      let techBonus = 0;
      if (slot.techPartners.length > 0) {
        const matchedTech = slot.techPartners.filter((tp) =>
          empSkillNames.some((es: string) => es.includes(tp.toLowerCase()))
        ).length;
        techBonus = Math.round((matchedTech / slot.techPartners.length) * 3);
      }

      // 7. Service line bonus (0-2) — aligned with backend candidates.ts
      let serviceLineBonus = 0;
      if (slot.serviceLines.length > 0 && emp.serviceLine) {
        const matched = slot.serviceLines.some((sl: string) => sl.toLowerCase() === emp.serviceLine!.toLowerCase());
        serviceLineBonus = matched ? 2 : 0;
      }

      const total = Math.round(
        gradeFit + dateOverlap + availabilityScore + skillsMatch + probBonus + techBonus + serviceLineBonus
      );

      row.push({
        slotIdx: si,
        empIdx: ei,
        empId: emp.empId,
        total: Math.min(100, total),
        gradeFit,
        dateOverlap,
        availability: availabilityScore,
        skillsMatch,
        probBonus,
        techBonus,
        serviceLineBonus,
        overlapDays: empOverlapDays,
        overlapRatio: needDays > 0 ? empOverlapDays / needDays : 0,
        freeHoursInOverlap,
      });
    }

    matrix.push(row);
  }

  return matrix;
};

// ─── Strategy definitions ─────────────────────────────────────────────────────

interface StrategyDef {
  id: StrategyId;
  name: string;
  description: string;
  weightFn: (cell: CellScore, emp: ScoringEmployee, slot: Slot) => number;
  minScore: number;
}

const STRATEGIES: StrategyDef[] = [
  {
    id: "optimalTu",
    name: "Optimal TU",
    description: "Maximizes overall TU gain by prioritizing employees below their target",
    weightFn: (cell, emp) => {
      const target = getGradeTarget(emp.grade);
      const currentTU = emp.trueUtilizationRate || 0;
      const tuGap = Math.max(0, target - currentTU) / target; // 0-1
      return cell.total * (1 + tuGap * 0.8); // boost up to 80% for employees far from target
    },
    minScore: 30,
  },
  {
    id: "bestFit",
    name: "Best Fit",
    description: "Maximizes match quality (exact grade + perfect dates)",
    weightFn: (cell) => cell.total,
    minScore: 40,
  },
  {
    id: "maxCoverage",
    name: "Max Coverage",
    description: "Maximizes the number of needs covered (accepts average fits)",
    weightFn: (cell) => cell.total,
    minScore: 15, // lower threshold
  },
  {
    id: "mplusPriority",
    name: "M+ Priority",
    description: "Prioritizes assignment of senior grades (Manager+)",
    weightFn: (cell, emp) => {
      const idx = gradeIdx(emp.grade);
      const seniorityBonus = idx <= 4 ? 1.5 : 1.0; // M+ get 50% boost
      return cell.total * seniorityBonus;
    },
    minScore: 30,
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Balances TU gain, coverage and match quality",
    weightFn: (cell, emp) => {
      const target = getGradeTarget(emp.grade);
      const currentTU = emp.trueUtilizationRate || 0;
      const tuGap = Math.max(0, target - currentTU) / target;
      return cell.total * 0.6 + tuGap * 40 * 0.4; // 60% score + 40% TU gap
    },
    minScore: 25,
  },
];

/**
 * Generate proposals using different strategies.
 */
export const generateProposals = (
  matrix: CellScore[][],
  slots: Slot[],
  employees: ScoringEmployee[],
  currentTeamTU: number,
  currentTeamNetH: number,
  currentTeamChH: number
): Proposal[] => {
  const proposals: Proposal[] = [];

  for (const strategy of STRATEGIES) {
    // Build weighted scores for all valid pairs
    const pairs: { si: number; ei: number; weight: number; cell: CellScore }[] = [];

    for (let si = 0; si < slots.length; si++) {
      for (let ei = 0; ei < employees.length; ei++) {
        const cell = matrix[si][ei];
        if (cell.total < strategy.minScore) continue;
        const weight = strategy.weightFn(cell, employees[ei], slots[si]);
        pairs.push({ si, ei, weight, cell });
      }
    }

    // Sort by weight descending
    pairs.sort((a, b) => b.weight - a.weight);

    // Greedy assignment
    const usedSlots = new Set<number>();
    const empAssignments: Map<number, Array<{ startDate: string; endDate: string }>> = new Map();
    const assignments: ProposalAssignment[] = [];
    const selectionMap = new Map<number, number>();

    for (const { si, ei, cell } of pairs) {
      if (usedSlots.has(si)) continue;

      // Check if employee has a conflicting assignment in this run
      const existing = empAssignments.get(ei) || [];
      const slot = slots[si];
      const hasConflict = existing.some((a) => datesOverlap(a.startDate, a.endDate, slot.startDate, slot.endDate));
      if (hasConflict) continue;

      // Assign
      usedSlots.add(si);
      empAssignments.set(ei, [...existing, { startDate: slot.startDate, endDate: slot.endDate }]);
      selectionMap.set(si, ei);

      const emp = employees[ei];
      assignments.push({
        slotIdx: si,
        empIdx: ei,
        empId: emp.empId,
        empName: emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        empGrade: emp.grade,
        needId: slot.needId,
        opportunityId: slot.opportunityId,
        oppLabel: slot.oppLabel,
        jobNo: slot.jobNo,
        startDate: slot.startDate,
        endDate: slot.endDate,
        score: cell.total,
      });
    }

    // Unfilled slots
    const unfilledSlots: UnfilledSlot[] = [];
    for (let si = 0; si < slots.length; si++) {
      if (!usedSlots.has(si)) {
        const slot = slots[si];
        const bestScore = Math.max(0, ...matrix[si].map((c) => c.total));
        const reason =
          bestScore < strategy.minScore
            ? `No candidate with score >= ${strategy.minScore}`
            : "All candidates already assigned";
        unfilledSlots.push({ slotIdx: si, needId: slot.needId, grade: slot.grade, oppLabel: slot.oppLabel, reason });
      }
    }

    // Projected TU delta
    const extraChH = assignments.reduce((sum, a) => {
      const overlapDays = matrix[a.slotIdx][a.empIdx].overlapDays;
      return sum + overlapDays * 8;
    }, 0);
    const projectedTU = currentTeamNetH > 0 ? ((currentTeamChH + extraChH) / currentTeamNetH) * 100 : currentTeamTU;

    proposals.push({
      id: `${strategy.id}_${Date.now()}`,
      name: strategy.name,
      strategy: strategy.id,
      description: strategy.description,
      assignments,
      unfilledSlots,
      stats: {
        totalSlots: slots.length,
        filledSlots: assignments.length,
        coverageRate: slots.length > 0 ? (assignments.length / slots.length) * 100 : 0,
        avgScore: assignments.length > 0 ? assignments.reduce((s, a) => s + a.score, 0) / assignments.length : 0,
        projectedTUDelta: projectedTU - currentTeamTU,
        projectedTU,
      },
      selectionMap,
    });
  }

  // Sort proposals by projected TU delta descending
  proposals.sort((a, b) => b.stats.projectedTUDelta - a.stats.projectedTUDelta);

  return proposals;
};

/**
 * Strategy metadata for UI display.
 */
export const STRATEGY_META: Record<StrategyId, { name: string; icon: string; color: string }> = {
  optimalTu: { name: "Optimal TU", icon: "🥇", color: "#059669" },
  bestFit: { name: "Best Fit", icon: "🥈", color: "#2563eb" },
  maxCoverage: { name: "Max Coverage", icon: "🥉", color: "#d97706" },
  mplusPriority: { name: "M+ Priority", icon: "⭐", color: "#7c3aed" },
  balanced: { name: "Balanced", icon: "⚖️", color: "#64748b" },
};

/**
 * Get cell color based on score.
 */
export const getCellColor = (score: number): { bg: string; text: string } => {
  if (score >= 70) return { bg: "#ecfdf5", text: "#047857" };
  if (score >= 40) return { bg: "#fffbeb", text: "#b45309" };
  if (score >= 10) return { bg: "#fff7ed", text: "#c2410c" };
  return { bg: "#f9fafb", text: "#9ca3af" };
};
