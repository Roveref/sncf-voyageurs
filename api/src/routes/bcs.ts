/**
 * BCS CM1 Simulator — Backend route
 *
 * GET /api/bcs/:jobcode
 * Returns SAP actuals, MDS forecast, and CRM opportunity data
 * aggregated by employee grade for CM1 projection.
 */

import { Router, Request, Response } from "express";
import db from "../db/database.js";
import { GRADE_ORDER, hpd, countWorkdays, getEffectiveGrade, GradeTransition } from "../services/staffing/shared.js";

const router = Router();

import { MAGR_TO_GRADE } from "../../../shared/staffingConstants.js";

// ── MAGR profile data (SCR + rate cards) from var_config.magrProfile ──

interface MagrProfile {
  grade: string;
  scr: number;
  rcAdvisory: number;
  rcImplementation: number;
  rcStrategy: number;
  advanced: boolean;
}

/** Load all MAGR profiles from var_config, keyed by MAGR code */
function loadMagrProfiles(): Record<string, MagrProfile> {
  try {
    const rows = db.prepare("SELECT key, value FROM var_config WHERE category = 'magrProfile'").all() as {
      key: string;
      value: string;
    }[];
    const profiles: Record<string, MagrProfile> = {};
    for (const r of rows) {
      try {
        const val = JSON.parse(r.value);
        profiles[r.key] = {
          grade: val.grade ?? "",
          scr: val.scr ?? 0,
          rcAdvisory: val.rcAdvisory ?? 0,
          rcImplementation: val.rcImplementation ?? 0,
          rcStrategy: val.rcStrategy ?? 0,
          advanced: val.advanced ?? false,
        };
      } catch {
        /* skip */
      }
    }
    return profiles;
  } catch {
    return {};
  }
}

/** Build SCR map by grade (uses standard profile, not advanced) */
function buildScrByGrade(profiles: Record<string, MagrProfile>): Record<string, number> {
  const scr: Record<string, number> = {};
  for (const p of Object.values(profiles)) {
    if (!p.advanced && p.grade && p.scr > 0) {
      scr[p.grade] = p.scr;
    }
  }
  return scr;
}

/** Build rate card by grade for a service offering */
function buildRateCard(
  profiles: Record<string, MagrProfile>,
  field: "rcAdvisory" | "rcImplementation" | "rcStrategy"
): Record<string, number> {
  const rc: Record<string, number> = {};
  for (const p of Object.values(profiles)) {
    if (!p.advanced && p.grade && p[field] > 0) {
      rc[p.grade] = p[field];
    }
  }
  return rc;
}

// ── Helpers ──

function resolveGrade(
  activityType: string | null,
  gradeHistory: GradeTransition[] | undefined,
  refDate: string,
  fallbackGrade: string | null
): string {
  // 1. MAGR code from SAP is the most accurate per-record signal
  if (activityType) {
    const mapped = MAGR_TO_GRADE[activityType];
    if (mapped) return mapped;
  }
  // 2. Grade history at the reference date
  if (gradeHistory) {
    const g = getEffectiveGrade(gradeHistory, refDate);
    if (g) return g;
  }
  // 3. Current grade from employees table
  return fallbackGrade || "Consultant";
}

function parseGradeHistory(raw: string | null): GradeTransition[] | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/** COS year: inflation applies from March 1st each year.
 *  Before 01/03 of year N → COS year N-1. From 01/03 → COS year N. */
function cosYear(dateStr: string): number {
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(5, 7), 10);
  return m < 3 ? y - 1 : y;
}

// ── GET /api/bcs/rates — Rate cards only (for blank BCS mode) ──

router.get("/rates/all", (_req: Request, res: Response) => {
  try {
    const profiles = loadMagrProfiles();
    const scrRates = buildScrByGrade(profiles);
    const rateCards: Record<string, Record<string, number>> = {
      advisory: buildRateCard(profiles, "rcAdvisory"),
      implementation: buildRateCard(profiles, "rcImplementation"),
      strategy: buildRateCard(profiles, "rcStrategy"),
    };
    res.json({ scrRates, rateCards, magrProfiles: profiles });
  } catch (err) {
    console.error("[bcs] Error loading rates:", err);
    res.status(500).json({ error: "Failed to load BCS rates" });
  }
});

// ── GET /api/bcs/:jobcode ──

router.get("/:jobcode", (req: Request, res: Response) => {
  try {
    const { jobcode } = req.params;

    // Load rates from magrProfile
    const profiles = loadMagrProfiles();
    const scrRates = buildScrByGrade(profiles);
    const rateCards: Record<string, Record<string, number>> = {
      advisory: buildRateCard(profiles, "rcAdvisory"),
      implementation: buildRateCard(profiles, "rcImplementation"),
      strategy: buildRateCard(profiles, "rcStrategy"),
    };

    // 1. CRM opportunities linked to this jobcode
    const opportunities = db
      .prepare(
        `SELECT opportunityId, opportunity, account, grossRevenue, netRevenue, cm1Pct, status,
                creationDate, bookingDate, serviceLine1
         FROM assets WHERE jobCode = ?`
      )
      .all(jobcode) as {
      opportunityId: string;
      opportunity: string;
      account: string;
      grossRevenue: number | null;
      netRevenue: number | null;
      cm1Pct: number | null;
      status: number;
      creationDate: string | null;
      bookingDate: string | null;
      serviceLine1: string | null;
    }[];

    // 2. SAP actuals — chargeable hours on this jobcode
    const sapRows = db
      .prepare(
        `SELECT s.empId, s.date, s.hours, s.activityType,
                e.name, e.grade, e.gradeHistory
         FROM sap_records s
         LEFT JOIN employees e ON s.empId = e.empId
         WHERE s.salesOrder = ? AND s.category IN ('chargeable','pending','overtime')
         ORDER BY s.empId, s.date`
      )
      .all(jobcode) as {
      empId: string;
      date: string;
      hours: number;
      activityType: string | null;
      name: string | null;
      grade: string | null;
      gradeHistory: string | null;
    }[];

    // 3. MDS forecast — chargeable assignments on this jobcode
    const mdsRows = db
      .prepare(
        `SELECT m.empId, m.startDate, m.endDate, m.utilization, m.hoursPerDay,
                e.name, e.grade, e.gradeHistory
         FROM mds_assignments m
         LEFT JOIN employees e ON m.empId = e.empId
         WHERE m.jobNo = ? AND m.category = 'chargeable'
         ORDER BY m.empId, m.startDate`
      )
      .all(jobcode) as {
      empId: string;
      startDate: string;
      endDate: string;
      utilization: number;
      hoursPerDay: number;
      name: string | null;
      grade: string | null;
      gradeHistory: string | null;
    }[];

    const todayStr = today();

    // ── Aggregate SAP by grade (with year breakdown) ──
    type YearMap = Record<number, number>; // year → days
    const sapByGrade: Record<string, { days: number; hours: number; employees: Set<string>; byYear: YearMap }> = {};
    const sapByEmployee: Record<
      string,
      { name: string; grade: string; days: number; hours: number; cosYearDays: YearMap }
    > = {};

    for (const r of sapRows) {
      const history = parseGradeHistory(r.gradeHistory);
      const grade = resolveGrade(r.activityType, history, r.date, r.grade);
      const hours = r.hours || 0;
      const days = hours / hpd(grade);
      const year = cosYear(r.date);

      if (!sapByGrade[grade]) sapByGrade[grade] = { days: 0, hours: 0, employees: new Set(), byYear: {} };
      sapByGrade[grade].days += days;
      sapByGrade[grade].hours += hours;
      sapByGrade[grade].byYear[year] = (sapByGrade[grade].byYear[year] || 0) + days;
      sapByGrade[grade].employees.add(r.empId);

      if (!sapByEmployee[r.empId])
        sapByEmployee[r.empId] = { name: r.name || r.empId, grade, days: 0, hours: 0, cosYearDays: {} };
      sapByEmployee[r.empId].days += days;
      sapByEmployee[r.empId].hours += hours;
      sapByEmployee[r.empId].cosYearDays[year] = (sapByEmployee[r.empId].cosYearDays[year] || 0) + days;
    }

    // ── Aggregate MDS forecast (from today onward) by grade, split by year ──
    const forecastByGrade: Record<string, { days: number; employees: Set<string>; byYear: YearMap }> = {};
    const forecastByEmployee: Record<string, { name: string; grade: string; days: number; cosYearDays: YearMap }> = {};

    for (const m of mdsRows) {
      const history = parseGradeHistory(m.gradeHistory);
      const grade = resolveGrade(null, history, todayStr, m.grade);

      // Only count working days from today onward
      const effectiveStart = m.startDate > todayStr ? m.startDate : todayStr;
      if (effectiveStart > m.endDate) continue;

      const utilFactor = (m.utilization || 100) / 100;

      // Split by COS year (boundary = March 1st, not January 1st)
      // COS year N covers 01/03/N → 28/02/N+1
      const startCosY = cosYear(effectiveStart);
      const endCosY = cosYear(m.endDate);

      if (!forecastByGrade[grade]) forecastByGrade[grade] = { days: 0, employees: new Set(), byYear: {} };

      let totalForecastDays = 0;
      for (let cy = startCosY; cy <= endCosY; cy++) {
        // COS year cy covers 01/03/cy → 28/02/cy+1
        const cyStart = `${cy}-03-01`;
        const cyEnd = `${cy + 1}-02-28`;
        const segStart = effectiveStart > cyStart ? effectiveStart : cyStart;
        const segEnd = m.endDate < cyEnd ? m.endDate : cyEnd;
        if (segStart > segEnd) continue;
        const wd = countWorkdays(segStart, segEnd);
        const fd = wd * utilFactor;
        if (fd > 0) {
          forecastByGrade[grade].byYear[cy] = (forecastByGrade[grade].byYear[cy] || 0) + fd;
          totalForecastDays += fd;
        }
      }

      if (totalForecastDays <= 0) continue;

      forecastByGrade[grade].days += totalForecastDays;
      forecastByGrade[grade].employees.add(m.empId);

      if (!forecastByEmployee[m.empId])
        forecastByEmployee[m.empId] = { name: m.name || m.empId, grade, days: 0, cosYearDays: {} };
      forecastByEmployee[m.empId].days += totalForecastDays;
      // Merge COS year breakdown
      for (let cy = startCosY; cy <= endCosY; cy++) {
        const cyStart2 = `${cy}-03-01`;
        const cyEnd2 = `${cy + 1}-02-28`;
        const segStart2 = effectiveStart > cyStart2 ? effectiveStart : cyStart2;
        const segEnd2 = m.endDate < cyEnd2 ? m.endDate : cyEnd2;
        if (segStart2 > segEnd2) continue;
        const wd2 = countWorkdays(segStart2, segEnd2) * utilFactor;
        if (wd2 > 0)
          forecastByEmployee[m.empId].cosYearDays[cy] = (forecastByEmployee[m.empId].cosYearDays[cy] || 0) + wd2;
      }
    }

    // ── Build per-grade breakdown ──
    const allGrades = new Set([...Object.keys(sapByGrade), ...Object.keys(forecastByGrade)]);

    const byGrade = GRADE_ORDER.filter((g) => allGrades.has(g)).map((grade) => {
      const sap = sapByGrade[grade];
      const forecast = forecastByGrade[grade];
      const actualDays = sap ? Math.round(sap.days * 10) / 10 : 0;
      const forecastDays = forecast ? Math.round(forecast.days * 10) / 10 : 0;
      const scrPerDay = scrRates[grade] || 0;

      // Merge year maps from SAP and MDS
      const actualByYear: Record<number, number> = {};
      const forecastByYear: Record<number, number> = {};
      if (sap) for (const [y, d] of Object.entries(sap.byYear)) actualByYear[Number(y)] = Math.round(d * 10) / 10;
      if (forecast)
        for (const [y, d] of Object.entries(forecast.byYear)) forecastByYear[Number(y)] = Math.round(d * 10) / 10;

      return {
        grade,
        scrPerDay,
        actualDays,
        forecastDays,
        projectedDays: Math.round((actualDays + forecastDays) * 10) / 10,
        projectedCost: Math.round((actualDays + forecastDays) * scrPerDay),
        actualByYear,
        forecastByYear,
      };
    });

    // ── Build employee list ──
    const allEmpIds = new Set([...Object.keys(sapByEmployee), ...Object.keys(forecastByEmployee)]);

    const employees = Array.from(allEmpIds).map((empId) => {
      const sap = sapByEmployee[empId];
      const forecast = forecastByEmployee[empId];
      // Determine predominant COS year from actual data
      const allCosYears: YearMap = {};
      if (sap)
        for (const [y, d] of Object.entries(sap.cosYearDays))
          allCosYears[Number(y)] = (allCosYears[Number(y)] || 0) + d;
      if (forecast)
        for (const [y, d] of Object.entries(forecast.cosYearDays))
          allCosYears[Number(y)] = (allCosYears[Number(y)] || 0) + d;
      const predominant = Object.entries(allCosYears).sort((a, b) => b[1] - a[1])[0];
      return {
        empId,
        name: sap?.name || forecast?.name || empId,
        grade: sap?.grade || forecast?.grade || "Consultant",
        actualDays: sap ? Math.round(sap.days * 10) / 10 : 0,
        forecastDays: forecast ? Math.round(forecast.days * 10) / 10 : 0,
        cosYear: predominant ? Number(predominant[0]) : cosYear(todayStr),
      };
    });

    // ── Format opportunities ──
    const opps = opportunities.map((o) => ({
      opportunityId: o.opportunityId,
      opportunity: o.opportunity,
      account: o.account,
      grossRevenue: o.grossRevenue || 0,
      netRevenue: o.netRevenue || 0,
      cm1Pct: o.cm1Pct || 0,
      status: o.status,
      creationDate: o.creationDate,
      bookingDate: o.bookingDate,
      serviceLine: o.serviceLine1,
    }));

    // ── Determine base year (earliest year in SAP or MDS data) ──
    const allYears = new Set<number>();
    for (const g of byGrade) {
      for (const y of Object.keys(g.actualByYear)) allYears.add(Number(y));
      for (const y of Object.keys(g.forecastByYear)) allYears.add(Number(y));
    }
    const baseYear = allYears.size > 0 ? Math.min(...allYears) : new Date().getFullYear();

    res.json({
      available: opps.length > 0 || byGrade.length > 0,
      opportunities: opps,
      byGrade,
      employees,
      scrRates,
      rateCards,
      magrProfiles: profiles,
      baseYear,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[bcs] Error:", err);
    res.status(500).json({ error: "BCS calculation failed" });
  }
});

export default router;
