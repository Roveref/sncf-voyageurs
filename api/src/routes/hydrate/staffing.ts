/**
 * Routes: GET /staffing, GET /sap
 */

import { Router, Request, Response } from "express";
import db from "../../db/database.js";
import { error } from "../../utils/logger.js";
import { categorizeJob, computeETag, handleConditionalRequest } from "./utils.js";

const router = Router();

// ── GET /api/hydrate/staffing ──

router.get("/staffing", (req: Request, res: Response) => {
  try {
    // Fast ETag check before building full payload
    const fpRow = db.prepare("SELECT COUNT(*) as cnt, MAX(updatedAt) as maxu FROM mds_assignments").get() as {
      cnt: number;
      maxu: string | null;
    };
    const fingerprint = computeETag(`staff-${fpRow.cnt}-${fpRow.maxu}`);
    if (handleConditionalRequest(req, res, fingerprint)) return;

    const rows = db
      .prepare(
        `SELECT e.empId, e.name, e.grade, e.subTeam, e.serviceLine, e.managerId,
                a.jobNo, a.jobName, a.category, a.startDate, a.endDate,
                a.utilization, a.hoursPerDay
         FROM employees e
         JOIN mds_assignments a ON e.empId = a.empId
         ORDER BY e.empId, a.startDate`
      )
      .all() as Record<string, unknown>[];

    if (rows.length === 0) {
      res.json({ available: false });
      return;
    }

    // Mapper vers le format createRecord() de useFileUpload.ts
    const records = rows.map((row) => {
      const name = String(row.name || "");
      const nameParts = name.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      const utilization = Number(row.utilization) || 0;
      const hoursPerDay = Number(row.hoursPerDay) || (utilization / 100) * 8;

      return {
        empId: String(row.empId || ""),
        lastName,
        firstName,
        jobNo: String(row.jobNo || ""),
        jobName: String(row.jobName || ""),
        startDate: String(row.startDate || ""),
        endDate: String(row.endDate || ""),
        utilization,
        status: "",
        hours: 0,
        startDateParsed: String(row.startDate || ""),
        endDateParsed: String(row.endDate || ""),
        utilPercent: String(utilization),
        workingDays: 0,
        hoursTotal: 0,
        hoursPerDay,
        category: String(row.category || "") || categorizeJob(String(row.jobNo || "")),
        // Extra fields for enrichment
        grade: String(row.grade || ""),
        subTeam: String(row.subTeam || ""),
        serviceLine: String(row.serviceLine || ""),
      };
    });

    res.json({ available: true, records });
  } catch (err) {
    error("hydrate/staffing", "Error:", err);
    res.status(500).json({ error: "Error loading staffing data." });
  }
});

// ── GET /api/hydrate/sap ──

router.get("/sap", (_req: Request, res: Response) => {
  try {
    const rows = db
      .prepare(
        "SELECT empId, date, name, salesOrder, salesOrderItem, absenceType, hours, text, category, activityType FROM sap_records ORDER BY empId, date"
      )
      .all() as Record<string, unknown>[];

    if (rows.length === 0) {
      res.json({ available: false });
      return;
    }

    // Rebuild the same structure as sapWorker.js output
    const records: Record<string, unknown>[] = [];
    const lookup: Record<
      string,
      Record<string, { records: Record<string, unknown>[]; totalHours: number; categories: Record<string, number> }>
    > = {};
    let minDate: string | null = null;
    let maxDate: string | null = null;
    const empIdSet = new Set<string>();
    const dateSet = new Set<string>();

    for (const row of rows) {
      const empId = String(row.empId || "");
      const date = String(row.date || "");
      if (!empId || !date) continue;

      const rec = {
        date,
        empId,
        name: String(row.name || ""),
        salesOrder: String(row.salesOrder || ""),
        salesOrderItem: String(row.salesOrderItem || ""),
        absenceType: String(row.absenceType || ""),
        hours: Number(row.hours) || 0,
        text: String(row.text || ""),
        category: String(row.category || ""),
        activityType: row.activityType ? String(row.activityType) : undefined,
        source: "sap",
      };

      records.push(rec);

      // Build lookup
      if (!lookup[empId]) lookup[empId] = {};
      if (!lookup[empId][date]) {
        lookup[empId][date] = { records: [], totalHours: 0, categories: {} };
      }
      const day = lookup[empId][date];
      day.records.push(rec);
      day.totalHours += rec.hours;
      if (rec.category) {
        day.categories[rec.category] = (day.categories[rec.category] || 0) + rec.hours;
      }

      empIdSet.add(empId);
      dateSet.add(date);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }

    res.json({
      available: true,
      sapData: {
        records,
        lookup,
        minDate,
        maxDate,
        totalRecords: records.length,
        totalEmployees: empIdSet.size,
        totalDays: dateSet.size,
        employeeIds: Array.from(empIdSet), // Will be converted to Set on frontend
        parseFailures: 0,
      },
    });
  } catch (err) {
    error("hydrate/sap", "Error:", err);
    res.status(500).json({ error: "Error loading SAP data." });
  }
});

export default router;
