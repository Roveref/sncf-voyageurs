/**
 * Route POST /api/summarize — Summary and report generation
 */

import { Router, Request, Response } from "express";
import { ask } from "../services/llm.js";
import db from "../db/database.js";

const router = Router();

type SummaryType = "executive" | "pipeline" | "staffing" | "alerts";

interface SummarizeRequest {
  type: SummaryType;
  dateRange?: { start: string; end: string };
}

const SUMMARY_PROMPTS: Record<SummaryType, string> = {
  executive: `Executive summary for steering committee (5-8 points).
Required structure:
1. **Pipeline**: total volume, value, breakdown by status, top 3 opportunities by revenue
2. **Bookings**: number and value of booked opps, trend vs previous period
3. **Staffing**: average TU by grade (vs target), number of people on bench, overload
4. **Alerts**: opps stuck in Proposal >60d, overdue actions, missions ending <30d
5. **Recommendations**: 2-3 concrete priority actions
Use the provided numbers. No emojis.`,

  pipeline: `Detailed pipeline analysis.
Structure:
1. **Overview**: number of active opps, gross/net value, weighted booking
2. **By status**: Lead, Go, Proposal, Won — volume and value for each
3. **Top 5 opportunities** by revenue with account, status, win%, manager
4. **Concentration**: breakdown by segment (subSegmentCode) and region
5. **Dynamics**: recent opps (created <30d), stagnant opps (in Proposal >60d)
6. **Risks and recommendations**: concentrated pipeline, deals to follow up
Concrete numbers. No emojis.`,

  staffing: `Detailed staffing analysis.
Structure:
1. **Headcount**: total number, breakdown by grade with % relative to ideal pyramid
2. **Utilization**: overall average TU and by grade, gap vs target (Partner 25%, Director 50%, SM 65%, Manager 75%, SC/C/A 90%)
3. **Bench**: people without active chargeable assignment, by grade
4. **Ending missions**: missions ending in the next 30 days, people concerned
5. **Uncovered needs**: open staffing needs without assignment
6. **Overload**: people with >100% allocation
7. **Recommendations**: assignments to make, alerts, arbitrations
Concrete numbers. No emojis.`,

  alerts: `Alert and attention point summary, by priority.
Structure:
1. **Critical**: overdue actions (past dueDate, open status), Won opps without staffing, TU >100%
2. **To watch**: opps in Proposal >60d, missions ending <30d, employees on bench >30d
3. **Trends**: TU evolution, incoming vs outgoing pipeline
4. **Recommended actions**: concrete action list with priority
No emojis.`,
};

router.post("/", async (req: Request, res: Response) => {
  try {
    const { type = "executive", dateRange } = req.body as SummarizeRequest;

    if (!SUMMARY_PROMPTS[type]) {
      res.status(400).json({ error: `Invalid type. Valid types: ${Object.keys(SUMMARY_PROMPTS).join(", ")}` });
      return;
    }

    const context = gatherSummaryData(type, dateRange);

    const systemPrompt = `BearingPoint Dashboard AI Assistant. Generate professional summaries.
Respond in English, markdown format, no emojis. Use only the provided data.

${SUMMARY_PROMPTS[type]}

## Data
${context}`;

    const response = await ask(systemPrompt, `Generate the ${type} summary.`);

    res.json({
      type,
      summary: response.text,
      model: response.model,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[summarize] Error:", err);
    res.status(500).json({ error: "Error generating summary." });
  }
});

function gatherSummaryData(type: SummaryType, dateRange?: { start: string; end: string }): string {
  const blocks: string[] = [];
  const dateFilter = dateRange ? "AND creationDate >= ? AND creationDate <= ?" : "";
  const dateParams: string[] = dateRange ? [dateRange.start, dateRange.end] : [];
  const today = new Date().toISOString().slice(0, 10);

  if (type === "executive" || type === "pipeline") {
    // Pipeline by status
    const pipeline = db
      .prepare(
        `SELECT status, COUNT(*) as count, COALESCE(SUM(grossRevenue), 0) as gross, COALESCE(SUM(netRevenue), 0) as net, COALESCE(SUM(weightedBooking), 0) as weighted
       FROM crm_opportunities WHERE status NOT IN (15) ${dateFilter} GROUP BY status ORDER BY status`
      )
      .all(...dateParams);
    blocks.push(
      "Pipeline by status (status, count, gross, net, weighted):\n" +
        pipeline
          .map(
            (r: any) =>
              `status=${r.status} count=${r.count} gross=${Math.round(r.gross)} net=${Math.round(r.net)} weighted=${Math.round(r.weighted)}`
          )
          .join("\n")
    );

    // Top opportunities
    const topOpps = db
      .prepare(
        `SELECT opportunity as name, account, status, grossRevenue, winPct, manager, partner
       FROM crm_opportunities WHERE status NOT IN (14, 15) ${dateFilter}
       ORDER BY grossRevenue DESC LIMIT 5`
      )
      .all(...dateParams);
    blocks.push(
      "Top 5 opportunities:\n" +
        topOpps
          .map(
            (r: any) =>
              `${r.name} | ${r.account} | status=${r.status} | ${Math.round(r.grossRevenue)}€ | win=${r.winPct}% | mgr=${r.manager}`
          )
          .join("\n")
    );

    // By segment
    const bySegment = db
      .prepare(
        `SELECT subSegmentCode, COUNT(*) as count, SUM(grossRevenue) as gross
       FROM crm_opportunities WHERE status NOT IN (15) AND subSegmentCode IS NOT NULL ${dateFilter}
       GROUP BY subSegmentCode ORDER BY gross DESC`
      )
      .all(...dateParams);
    blocks.push(
      "By segment:\n" +
        bySegment.map((r: any) => `${r.subSegmentCode}: ${r.count} opps, ${Math.round(r.gross)}€`).join("\n")
    );

    // Stagnant proposals
    const stagnant = db
      .prepare(
        `SELECT opportunity as name, account, grossRevenue, creationDate FROM crm_opportunities
       WHERE status = 6 AND creationDate < date('now', '-60 days') ORDER BY grossRevenue DESC LIMIT 5`
      )
      .all();
    if (stagnant.length)
      blocks.push(
        "Stagnant proposals (>60d):\n" +
          stagnant
            .map((r: any) => `${r.name} | ${r.account} | ${Math.round(r.grossRevenue)}€ | created ${r.creationDate}`)
            .join("\n")
      );
  }

  if (type === "executive" || type === "staffing") {
    // Headcount by grade
    const grades = db
      .prepare(
        `SELECT grade, COUNT(*) as count FROM employees
       WHERE departure IS NULL OR departure > ? GROUP BY grade ORDER BY count DESC`
      )
      .all(today);
    blocks.push("Headcount by grade:\n" + grades.map((r: any) => `${r.grade}: ${r.count}`).join("\n"));

    // Ending missions
    const endingSoon = db
      .prepare(
        `SELECT e.name, e.grade, a.jobName, a.endDate FROM mds_assignments a
       JOIN employees e ON a.empId = e.empId
       WHERE a.category = 'chargeable' AND a.endDate BETWEEN ? AND date('now', '+30 days')
       ORDER BY a.endDate ASC LIMIT 10`
      )
      .all(today);
    if (endingSoon.length)
      blocks.push(
        "Missions ending <30d:\n" +
          endingSoon.map((r: any) => `${r.name} (${r.grade}) | ${r.jobName} | ends ${r.endDate}`).join("\n")
      );

    // Bench (no active chargeable assignment)
    const bench = db
      .prepare(
        `SELECT e.name, e.grade FROM employees e
       WHERE (e.departureDate IS NULL OR e.departureDate > ?)
       AND NOT EXISTS (
         SELECT 1 FROM mds_assignments a WHERE a.empId = e.empId
         AND a.category = 'chargeable' AND a.endDate >= ? AND a.startDate <= ?
       ) LIMIT 15`
      )
      .all(today, today, today);
    if (bench.length)
      blocks.push(
        "Bench (no active chargeable assignment):\n" + bench.map((r: any) => `${r.name} (${r.grade})`).join("\n")
      );

    // Open staffing needs
    const needs = db
      .prepare(
        `SELECT n.grade, n.quantity, n.startDate, n.endDate, o.opportunity as oppName, o.account
       FROM user_staffing_needs n JOIN crm_opportunities o ON n.opportunityId = o.opportunityId
       WHERE n.startDate >= ? ORDER BY n.startDate LIMIT 10`
      )
      .all(today);
    if (needs.length)
      blocks.push(
        "Open staffing needs:\n" +
          needs
            .map((r: any) => `${r.grade} x${r.quantity} | ${r.oppName} (${r.account}) | ${r.startDate} → ${r.endDate}`)
            .join("\n")
      );
  }

  if (type === "executive" || type === "alerts") {
    // Overdue actions
    const overdue = db
      .prepare(
        `SELECT a.description, a.owner, a.dueDate, o.opportunity as oppName FROM user_actions a
       JOIN crm_opportunities o ON a.opportunityId = o.opportunityId
       WHERE a.status != 'done' AND a.dueDate < ?
       ORDER BY a.dueDate LIMIT 10`
      )
      .all(today);
    if (overdue.length)
      blocks.push(
        "Overdue actions:\n" +
          overdue.map((r: any) => `${r.description} | ${r.owner} | due ${r.dueDate} | ${r.oppName}`).join("\n")
      );

    // Won without staffing
    const wonNoStaff = db
      .prepare(
        `SELECT o.opportunity as name, o.account, o.grossRevenue FROM crm_opportunities o
       WHERE o.status = 11 AND NOT EXISTS (
         SELECT 1 FROM user_staffing_needs n WHERE n.opportunityId = o.opportunityId
       ) LIMIT 10`
      )
      .all();
    if (wonNoStaff.length)
      blocks.push(
        "Won without staffing need:\n" +
          wonNoStaff.map((r: any) => `${r.name} | ${r.account} | ${Math.round(r.grossRevenue)}€`).join("\n")
      );

    // Recent bookings
    const recentBookings = db
      .prepare(
        `SELECT opportunity as name, account, grossRevenue, bookingDate FROM crm_opportunities
       WHERE status = 14 AND bookingDate >= date('now', '-30 days') ORDER BY bookingDate DESC LIMIT 5`
      )
      .all();
    if (recentBookings.length)
      blocks.push(
        "Recent bookings (<30d):\n" +
          recentBookings
            .map((r: any) => `${r.name} | ${r.account} | ${Math.round(r.grossRevenue)}€ | ${r.bookingDate}`)
            .join("\n")
      );
  }

  return blocks.join("\n\n");
}

export default router;
