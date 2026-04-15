import { MAGR_TO_GRADE } from "../constants";
import type { GradeTransition } from "../types";

/**
 * Result of grade detection from SAP Activity Type data.
 */
export interface SapGradeResult {
  /** Current (latest) grade detected from SAP */
  grade: string;
  /** Full grade history with transition dates */
  gradeHistory: GradeTransition[];
}

/**
 * Detect grades from SAP Activity Type (MAGR codes) for all employees.
 *
 * For each empId, scans records chronologically, maps activityType → grade,
 * and detects transitions when the grade changes between dates.
 *
 * @param sapLookup - The SAP lookup: empId → { dateStr → { records[] } }
 * @returns Map of empId → SapGradeResult
 */
export const detectGradesFromSap = (sapLookup: Record<string, any>): Record<string, SapGradeResult> => {
  const results: Record<string, SapGradeResult> = {};

  for (const empId of Object.keys(sapLookup)) {
    const dates = Object.keys(sapLookup[empId]).sort();
    let currentGrade: string | null = null;
    const history: GradeTransition[] = [];

    for (const dateStr of dates) {
      const dayData = sapLookup[empId][dateStr];
      if (!dayData?.records) continue;

      // Find the activityType from any record of this day
      let magr: string | null = null;
      for (const rec of dayData.records) {
        if (rec.activityType) {
          magr = rec.activityType.toString().trim().toUpperCase();
          break;
        }
      }
      if (!magr) continue;

      const grade = MAGR_TO_GRADE[magr];
      if (!grade) continue;

      if (grade !== currentGrade) {
        // Close previous grade's until date
        if (history.length > 0) {
          history[history.length - 1].until = dateStr; // last day is transition day; previous grade ended
        }
        currentGrade = grade;
        // Snap transition date to 1st of month when it falls on 2nd or 3rd (weekend before 1st)
        let since = dateStr;
        const day = parseInt(dateStr.slice(8, 10), 10);
        if (day >= 2 && day <= 3 && history.length > 0) {
          since = dateStr.slice(0, 8) + "01";
        }
        history.push({ grade, since });
      } else {
        // Update until to track last SAP day for this grade
        history[history.length - 1].until = dateStr;
      }
    }

    // Post-process: remove short-lived grade periods (≤ 5 calendar days = noise)
    if (history.length > 2) {
      const MIN_DAYS = 5;
      const filtered: GradeTransition[] = [];
      for (const period of history) {
        const days =
          period.until && period.since
            ? Math.round((new Date(period.until).getTime() - new Date(period.since).getTime()) / 86400000) + 1
            : Infinity; // open-ended (last period) → keep
        if (days <= MIN_DAYS && filtered.length > 0) {
          // Absorb into previous period: extend its until
          if (period.until) filtered[filtered.length - 1].until = period.until;
        } else {
          filtered.push({ ...period });
        }
      }
      // Merge consecutive same-grade periods (after noise removal)
      const merged: GradeTransition[] = [];
      for (const p of filtered) {
        if (merged.length > 0 && merged[merged.length - 1].grade === p.grade) {
          if (p.until) merged[merged.length - 1].until = p.until;
        } else {
          merged.push(p);
        }
      }
      history.length = 0;
      history.push(...merged);
      currentGrade = merged[merged.length - 1]?.grade || null;
    }

    if (currentGrade && history.length > 0) {
      results[empId] = { grade: currentGrade, gradeHistory: history };
    }
  }

  return results;
};

/**
 * Normalize a name by stripping common French/English civility prefixes
 * and lowercasing for comparison.
 */
const normalizeName = (name: string): string =>
  name
    .replace(/^(Mme|Mds|Mrs|Mr|Ms|Mlle|M)\.?\s+/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/**
 * Detect Intern → Analyst transitions where the person got a new empId.
 *
 * Identifies interns whose SAP data ends and analysts whose SAP data starts
 * around the same period, then matches by normalized name.
 *
 * @param sapLookup - The SAP lookup: empId → { dateStr → { records[] } }
 * @param gradeResults - Results from detectGradesFromSap
 * @returns Map of internEmpId → analystEmpId (for merging)
 */
export const detectInternToAnalyst = (
  sapLookup: Record<string, any>,
  gradeResults: Record<string, SapGradeResult>
): Record<string, string> => {
  // Build name lookup from SAP records
  const nameByEmpId: Record<string, string> = {};
  for (const empId of Object.keys(sapLookup)) {
    const dates = Object.keys(sapLookup[empId]);
    for (const d of dates) {
      const recs = sapLookup[empId][d]?.records;
      if (recs) {
        for (const r of recs) {
          if (r.name) {
            nameByEmpId[empId] = r.name;
            break;
          }
        }
      }
      if (nameByEmpId[empId]) break;
    }
  }

  // Find interns (last known grade = Intern) and analysts (first known grade = Analyst)
  const interns: { empId: string; name: string; lastDate: string }[] = [];
  const analysts: { empId: string; name: string; firstDate: string }[] = [];

  for (const [empId, result] of Object.entries(gradeResults)) {
    const lastGrade = result.gradeHistory[result.gradeHistory.length - 1]?.grade;
    const firstGrade = result.gradeHistory[0]?.grade;

    if (lastGrade === "Intern") {
      const dates = Object.keys(sapLookup[empId]).sort();
      const lastDate = dates[dates.length - 1] || "";
      const name = nameByEmpId[empId] || "";
      if (name) interns.push({ empId, name, lastDate });
    }

    if (firstGrade === "Analyst" && result.gradeHistory.length === 1) {
      const dates = Object.keys(sapLookup[empId]).sort();
      const firstDate = dates[0] || "";
      const name = nameByEmpId[empId] || "";
      if (name) analysts.push({ empId, name, firstDate });
    }
  }

  // Match by normalized name
  const mapping: Record<string, string> = {};
  const matchedAnalysts = new Set<string>();

  for (const intern of interns) {
    const normIntern = normalizeName(intern.name);
    for (const analyst of analysts) {
      if (matchedAnalysts.has(analyst.empId)) continue;
      const normAnalyst = normalizeName(analyst.name);
      if (normIntern === normAnalyst && analyst.firstDate >= intern.lastDate) {
        mapping[intern.empId] = analyst.empId;
        matchedAnalysts.add(analyst.empId);

        // Merge intern's grade history into analyst's
        const internHistory = gradeResults[intern.empId].gradeHistory;
        const analystResult = gradeResults[analyst.empId];
        analystResult.gradeHistory = [...internHistory, ...analystResult.gradeHistory];
        break;
      }
    }
  }

  return mapping;
};

/**
 * Detect arrival and departure dates from SAP data.
 *
 * For each employee, takes their first SAP date as arrival and last SAP date
 * as departure. Departure is only set if the last date is before the global
 * SAP maxDate (otherwise the employee is still present).
 *
 * @param sapLookup - The SAP lookup: empId → { dateStr → { records[] } }
 * @param maxDate - Global SAP max date (YYYY-MM-DD)
 * @returns Map of empId → { arrivalDate, departureDate? }
 */
export const detectPresenceDates = (
  sapLookup: Record<string, any>,
  _minDate: string,
  maxDate: string
): Record<string, { arrivalDate?: string; departureDate?: string }> => {
  const results: Record<string, { arrivalDate?: string; departureDate?: string }> = {};

  // Compute departure cutoff: M+2 tolerance.
  // Only mark as departed if the employee's last SAP date is more than 2 full months
  // before maxDate. Current month and previous month are tolerated because SAP fill
  // is progressive (some employees fill early, others haven't started yet).
  // Example: maxDate = 2026-03-30 → cutoff = 2026-01-31 (last day of January)
  //   - Last SAP in Feb → NOT departed (1 month gap, within tolerance)
  //   - Last SAP in Jan → DEPARTED (2+ month gap)
  const maxDateObj = new Date(maxDate + "T00:00:00");
  const cutoffDate = new Date(maxDateObj.getFullYear(), maxDateObj.getMonth() - 1, 0); // last day of 2 months before
  const departureCutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;

  for (const empId of Object.keys(sapLookup)) {
    const dates = Object.keys(sapLookup[empId]).sort();
    if (dates.length === 0) continue;

    const first = dates[0];
    const last = dates[dates.length - 1];
    const entry: { arrivalDate?: string; departureDate?: string } = {};

    // If first SAP date equals extract start, employee was already present before — set arrival to day before extract
    if (first > _minDate) {
      entry.arrivalDate = first;
    } else {
      const d = new Date(_minDate + "T00:00:00");
      d.setDate(d.getDate() - 1);
      entry.arrivalDate = d.toISOString().slice(0, 10);
    }

    // Only infer departure if the employee's last SAP date is at least 2 months
    // before the global maxDate. The current month and the previous month are
    // tolerated because SAP fill is progressive: some employees fill early in
    // the month while others haven't started yet (their last date = end of prev month).
    if (last < maxDate && last < departureCutoff) entry.departureDate = last;

    results[empId] = entry;
  }

  return results;
};
