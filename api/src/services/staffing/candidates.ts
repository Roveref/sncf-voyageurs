/**
 * Staffing candidate matching and skill search.
 *
 * Tools: findStaffingCandidates, searchSkills
 */

import db from "../../db/database.js";
import {
  type CandidateMatch,
  loadEmployees,
  loadAssignments,
  loadSkills,
  indexByEmpId,
  getSapDatesIndex,
  computeEmployeeAvailability,
  getEffectiveGrade,
  CHARGEABLE_CATS,
  hpd,
  gradeIndex,
  addDays,
  countWorkdays,
  overlapDays,
} from "./shared.js";

// ── Tool: find_staffing_candidates ──

export async function findStaffingCandidates(
  params: {
    needId?: string;
    opportunityId?: string;
    grade?: string;
    skills?: string[];
    periodStart: string;
    periodEnd: string;
    minScore?: number;
    minAvailablePct?: number;
    minSkillsMatchPct?: number;
    maxGradeDistance?: number;
    periodTolerance?: number; // 0=strict, 1=±1 mois, 2=±3 mois
  },
  onProgress?: (processed: number, total: number) => void
): Promise<CandidateMatch[]> {
  const employees = loadEmployees();
  const assignments = loadAssignments();
  const assignmentIndex = indexByEmpId(assignments);
  const allSkills = loadSkills();
  const skillIndex = indexByEmpId(allSkills);
  const sapDatesIndex = getSapDatesIndex();

  // If needId provided, load it from DB
  let needGrade = params.grade;
  let needSkills = params.skills || [];
  let needStart = params.periodStart;
  let needEnd = params.periodEnd;

  let needUtilization = 1; // default: 100% chargeable (0-1 ratio)

  if (params.needId) {
    const need = db
      .prepare(
        "SELECT opportunityId, opportunityId, grade, quantity, utilization, startDate, endDate, skills, probability FROM user_staffing_needs WHERE id = ?"
      )
      .get(params.needId) as any;
    if (need) {
      needGrade = need.profile || needGrade;
      needStart = need.startDate || needStart;
      needEnd = need.endDate || needEnd;
      if (need.utilization) needUtilization = Number(need.utilization);
      try {
        needSkills = JSON.parse(need.skills || "[]");
      } catch {
        /* */
      }
    }
  }

  // Auto-load technology partners from the opportunity for skill matching
  let techPartners: string[] = [];
  if (params.opportunityId) {
    const opp = db
      .prepare(
        "SELECT technologyPartner1, technologyPartner2, technologyPartner3 FROM crm_opportunities WHERE opportunityId = ?"
      )
      .get(params.opportunityId) as any;
    if (opp) {
      techPartners = [opp.technologyPartner1, opp.technologyPartner2, opp.technologyPartner3].filter(Boolean);
    }
  } else if (params.needId) {
    // Try to get opportunityId from the need, then load tech partners
    const needRow = db.prepare("SELECT opportunityId FROM user_staffing_needs WHERE id = ?").get(params.needId) as any;
    if (needRow?.opportunityId) {
      const opp = db
        .prepare(
          "SELECT technologyPartner1, technologyPartner2, technologyPartner3 FROM crm_opportunities WHERE opportunityId = ?"
        )
        .get(needRow.opportunityId) as any;
      if (opp) {
        techPartners = [opp.technologyPartner1, opp.technologyPartner2, opp.technologyPartner3].filter(Boolean);
      }
    }
  }

  // Auto-load service lines from the opportunity
  let oppServiceLines: string[] = [];
  if (params.opportunityId) {
    const oppSl = db
      .prepare("SELECT serviceLine1, serviceLine2, serviceLine3 FROM crm_opportunities WHERE opportunityId = ?")
      .get(params.opportunityId) as any;
    if (oppSl) oppServiceLines = [oppSl.serviceLine1, oppSl.serviceLine2, oppSl.serviceLine3].filter(Boolean);
  } else if (params.needId) {
    // Reuse needRow from techPartners block if available, otherwise query
    const needRowSl = db
      .prepare("SELECT opportunityId FROM user_staffing_needs WHERE id = ?")
      .get(params.needId) as any;
    if (needRowSl?.opportunityId) {
      const oppSl = db
        .prepare("SELECT serviceLine1, serviceLine2, serviceLine3 FROM crm_opportunities WHERE opportunityId = ?")
        .get(needRowSl.opportunityId) as any;
      if (oppSl) oppServiceLines = [oppSl.serviceLine1, oppSl.serviceLine2, oppSl.serviceLine3].filter(Boolean);
    }
  }

  // Period tolerance: extend search window
  // 0=strict (exact dates), 1=±1 month, 2=±3 months
  const periodTol = params.periodTolerance ?? 1;
  const toleranceDays = periodTol === 0 ? 0 : periodTol === 1 ? 30 : 90;
  const searchStart = toleranceDays > 0 ? addDays(needStart, -toleranceDays) : needStart;
  const searchEnd = toleranceDays > 0 ? addDays(needEnd, toleranceDays) : needEnd;
  const maxDelayDays = periodTol === 0 ? 0 : periodTol === 1 ? 22 : 66; // ~1 or ~3 months in workdays

  const needDays = countWorkdays(needStart, needEnd);
  if (needDays === 0) return [];

  // ── Dynamic scoring weights based on urgency and technicality ──
  const today = new Date().toISOString().slice(0, 10);
  const daysToStart = needStart > today ? countWorkdays(today, needStart) : 0;
  const isUrgent = daysToStart <= 15 && daysToStart >= 0;
  const isTechnical = needSkills.length >= 3;

  // Weights adapt to context (always sum to 100)
  let W_GRADE = 30,
    W_DATE = 25,
    W_DISPO = 25,
    W_SKILLS = 15,
    W_TECH = 3,
    W_SL = 2;
  let scoringMode = "standard";
  if (isUrgent) {
    // Urgent: availability is critical, dates less important (it's imminent)
    W_GRADE = 20;
    W_DATE = 15;
    W_DISPO = 35;
    W_SKILLS = 15;
    W_TECH = 8;
    W_SL = 7;
    scoringMode = "urgent";
  } else if (isTechnical) {
    // Technical: skills are the differentiator
    W_GRADE = 25;
    W_DATE = 15;
    W_DISPO = 20;
    W_SKILLS = 25;
    W_TECH = 8;
    W_SL = 7;
    scoringMode = "technical";
  }

  // ── Pre-compute client history for account bonus ──
  let accountHistorySet = new Set<string>();
  const oppIdForHistory =
    params.opportunityId ||
    (params.needId
      ? (db.prepare("SELECT opportunityId FROM user_staffing_needs WHERE id = ?").get(params.needId) as any)
          ?.opportunityId
      : null);
  if (oppIdForHistory) {
    const oppAccount = (db
      .prepare("SELECT account FROM crm_opportunities WHERE opportunityId = ?")
      .get(oppIdForHistory) ||
      db.prepare("SELECT account FROM user_opportunities WHERE opportunityId = ?").get(oppIdForHistory)) as any;
    if (oppAccount?.account) {
      const rows = db
        .prepare(
          `SELECT DISTINCT a.empId FROM mds_assignments a
         JOIN crm_opportunities o ON a.jobNo = o.jobCode
         WHERE o.account = ?`
        )
        .all(oppAccount.account) as any[];
      accountHistorySet = new Set(rows.map((r: any) => r.empId));
    }
  }

  // Score each active employee
  const candidates: CandidateMatch[] = [];

  let processedCount = 0;
  for (const emp of employees) {
    if (emp.departure && emp.departure < searchStart) continue;
    if (emp.arrival && emp.arrival > searchEnd) continue;

    // 1. Grade fit (0-W_GRADE) — dynamic weight
    // Use effective grade at need start if grade transitions exist
    const effectiveEmpGrade = getEffectiveGrade(emp.gradeHistory, needStart) || emp.grade;
    const targetGradeIdx = needGrade ? gradeIndex(needGrade) : gradeIndex(effectiveEmpGrade);
    const empGradeIdx = gradeIndex(effectiveEmpGrade);
    const gradeDist = Math.abs(empGradeIdx - targetGradeIdx);
    if (params.maxGradeDistance !== undefined && gradeDist > params.maxGradeDistance) continue;
    const gradeFit =
      gradeDist === 0
        ? W_GRADE
        : gradeDist === 1
          ? Math.round(W_GRADE * 0.67)
          : gradeDist === 2
            ? Math.round(W_GRADE * 0.33)
            : 0;

    const avail = computeEmployeeAvailability(
      emp,
      assignmentIndex.get(emp.empId) || [],
      needStart,
      needEnd,
      sapDatesIndex.get(emp.empId)
    );

    // 2. Date overlap (0-W_DATE) — dynamic weight
    const empOverlapDays = overlapDays(
      needStart,
      needEnd,
      emp.arrival || "2000-01-01",
      emp.departure || "2099-12-31"
    ).length;
    const dateOverlap = Math.round(Math.min(1, empOverlapDays / needDays) * W_DATE);

    // 3. Availability (0-W_DISPO) — dynamic weight
    const neededHours = needDays * hpd(effectiveEmpGrade);
    const availabilityScore =
      neededHours > 0 ? Math.round(Math.min(1, avail.availableHours / neededHours) * W_DISPO) : 0;

    // Threshold: availability tolerance (0=strict, 1=moyen, 2=flexible)
    // Compare employee availablePct (0-100) vs needUtilization (0-1 ratio, converted to %)
    // Strict: availablePct >= needUtilization*100 (person has enough free capacity)
    // Moyen: availablePct >= needUtilization*100 / 2
    // Flexible: no filter
    if (params.minAvailablePct !== undefined && params.minAvailablePct < 2) {
      const needUtilPct = needUtilization * 100;
      const requiredDispo = params.minAvailablePct === 0 ? needUtilPct : needUtilPct / 2;
      if (avail.availablePct < requiredDispo) continue;
    }

    // 4. Skills match (0-W_SKILLS) — dynamic weight
    const empSkills = (skillIndex.get(emp.empId) || []).map((s) => s.name.toLowerCase());
    let skillsMatch = W_SKILLS; // full credit if no skills required
    const matchedSkills: string[] = [];
    let skillsMatchPct = 100;
    if (needSkills.length > 0) {
      let matched = 0;
      for (const sk of needSkills) {
        if (empSkills.some((es) => es.includes(sk.toLowerCase()))) {
          matched++;
          matchedSkills.push(sk);
        }
      }
      skillsMatch = Math.round((matched / needSkills.length) * W_SKILLS);
      skillsMatchPct = Math.round((matched / needSkills.length) * 100);
    }

    // Threshold: skills tolerance (0=strict, 1=moyen, 2=flexible)
    // 0: must match 100% of required skills, 1: match ≥50%, 2: no filter
    if (params.minSkillsMatchPct !== undefined && params.minSkillsMatchPct < 2) {
      const requiredMatchPct = params.minSkillsMatchPct === 0 ? 100 : 50;
      if (skillsMatchPct < requiredMatchPct) continue;
    }

    // 5. Tech partner bonus (0-W_TECH) — dynamic weight
    let techBonus = 0;
    const matchedTechPartners: string[] = [];
    if (techPartners.length > 0) {
      const matchedTech = techPartners.filter((tp) => empSkills.some((es) => es.includes(tp.toLowerCase())));
      matchedTechPartners.push(...matchedTech);
      techBonus = Math.round((matchedTech.length / techPartners.length) * W_TECH);
    }

    // 6. Service line bonus (0-W_SL) — dynamic weight
    let serviceLineBonus = 0;
    if (oppServiceLines.length > 0 && emp.serviceLine) {
      const matched = oppServiceLines.some((sl) => sl.toLowerCase() === emp.serviceLine.toLowerCase());
      serviceLineBonus = matched ? W_SL : 0;
    }

    // 7. Client history bonus (+5 if employee worked for same account before)
    const clientBonus = accountHistorySet.has(emp.empId) ? 5 : 0;

    // 8. Overload malus (penalty for employees already overloaded)
    let overloadMalus = 0;
    if (avail.tuPct > 110) overloadMalus = -20;
    else if (avail.tuPct > 100) overloadMalus = -10;

    const totalScore = Math.max(
      0,
      Math.min(
        100,
        gradeFit +
          dateOverlap +
          availabilityScore +
          skillsMatch +
          techBonus +
          serviceLineBonus +
          clientBonus +
          overloadMalus
      )
    );

    if (params.minScore && totalScore < params.minScore) continue;

    const dispoCoveragePct =
      needUtilization > 0 ? Math.round((avail.availablePct / (needUtilization * 100)) * 100) : 100;

    // Analyse temporelle : quand la personne est-elle réellement dispo ?
    // Cherche la date de fin de la dernière mission chargeable qui chevauche le début du besoin
    const empBlockingAssignments = (assignmentIndex.get(emp.empId) || []).filter(
      (a) =>
        CHARGEABLE_CATS.has(a.category) && a.startDate <= needStart && a.endDate >= needStart && a.utilization >= 50
    );
    let availableFrom: string | null = null;
    let delayDays = 0;

    if (empBlockingAssignments.length > 0 && avail.availablePct < needUtilization * 100) {
      // Find the earliest date after needStart where enough capacity frees up
      const latestEnd = empBlockingAssignments.reduce((max, a) => (a.endDate > max ? a.endDate : max), "");
      if (latestEnd > needStart) {
        availableFrom = addDays(latestEnd, 1);
        delayDays = countWorkdays(needStart, latestEnd);
      }
    }

    // Filter on period tolerance: reject if delay exceeds tolerance
    if (delayDays > maxDelayDays) continue;

    candidates.push({
      empId: emp.empId,
      name: emp.name,
      grade: effectiveEmpGrade,
      totalScore,
      gradeFit,
      dateOverlap,
      availabilityScore,
      skillsMatch,
      techBonus,
      serviceLineBonus,
      serviceLineMatch: serviceLineBonus > 0,
      scoreBreakdown: {
        gradeFit,
        dateOverlap,
        availability: availabilityScore,
        skills: skillsMatch,
        tech: techBonus,
        serviceLine: serviceLineBonus,
      },
      gradeDist,
      dispoCoveragePct,
      skillsMatchPct,
      availableHours: avail.availableHours,
      availablePct: avail.availablePct,
      tuPct: avail.tuPct,
      matchedSkills,
      matchedTechPartners,
      activeAssignments: avail.activeAssignments.map((a) => a.jobName),
      availableFrom,
      delayDays,
      fragScore: avail.fragScore,
      transitionLossPoints: avail.transitionLossPoints,
      effectiveGrade: effectiveEmpGrade !== emp.grade ? effectiveEmpGrade : undefined,
      scoringMode,
      clientBonus: clientBonus > 0 ? clientBonus : undefined,
      overloadMalus: overloadMalus < 0 ? overloadMalus : undefined,
    });

    // Yield to event loop every 15 employees for SSE progress flush
    processedCount++;
    if (onProgress && processedCount % 15 === 0) {
      onProgress(processedCount, employees.length);
      await new Promise((r) => setImmediate(r));
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.totalScore - a.totalScore);
  return candidates.slice(0, 20); // Top 20
}

// ── Tool: search_skills ──

export function searchSkills(params: {
  skill: string;
  minLevel?: number;
  grade?: string;
  periodStart?: string;
  periodEnd?: string;
}): {
  empId: string;
  name: string;
  grade: string;
  serviceLine: string;
  skillName: string;
  level: number;
  availablePct?: number;
}[] {
  const allSkills = loadSkills();
  const employees = loadEmployees();
  const assignments = loadAssignments();
  const assignmentIndex = indexByEmpId(assignments);
  const sapDatesIndex = getSapDatesIndex();

  const searchLower = params.skill.toLowerCase();
  const minLevel = params.minLevel || 1;

  // Find matching skills
  const matches = allSkills.filter((s) => s.name.toLowerCase().includes(searchLower) && s.level >= minLevel);

  // Group by employee, keep highest level per skill match
  const empBest = new Map<string, { skillName: string; level: number }>();
  for (const m of matches) {
    const existing = empBest.get(m.empId);
    if (!existing || m.level > existing.level) {
      empBest.set(m.empId, { skillName: m.name, level: m.level });
    }
  }

  const results: {
    empId: string;
    name: string;
    grade: string;
    serviceLine: string;
    skillName: string;
    level: number;
    availablePct?: number;
  }[] = [];

  for (const [empId, skill] of empBest) {
    const emp = employees.find((e) => e.empId === empId);
    if (!emp) continue;
    if (emp.departure && emp.departure < new Date().toISOString().slice(0, 10)) continue;
    if (params.grade && emp.grade !== params.grade) continue;

    let availablePct: number | undefined;
    if (params.periodStart && params.periodEnd) {
      const avail = computeEmployeeAvailability(
        emp,
        assignmentIndex.get(empId) || [],
        params.periodStart,
        params.periodEnd,
        sapDatesIndex.get(empId)
      );
      availablePct = avail.availablePct;
    }

    results.push({
      empId,
      name: emp.name,
      grade: emp.grade,
      serviceLine: emp.serviceLine,
      skillName: skill.skillName,
      level: skill.level,
      availablePct,
    });
  }

  // Sort by level desc, then name
  results.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  return results.slice(0, 30);
}
